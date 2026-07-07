// IBM ESPP Navigator & Rechner - App Logic

import { LS_KEYS, FX } from './js/constants.js';
import { escapeHtml, parseGermanNumber } from './js/format.js';
import { getAbgeltungRate, brokerFeesEUR as computeBrokerFees, estimateGrenzsteuersatz } from './js/tax.js';
import * as api from './js/api.js';

// State management
let state = {
  usdPrice: 180.00,
  eurPrice: 165.60,
  exchangeRate: 0.92,
  previousCloseUSD: 178.50,
  previousCloseEUR: 164.22,
  // Last price actually delivered by /api/stock (null until known). Used to tell
  // "the sell input is just tracking the live price" apart from a deliberate
  // user assumption, which must survive both reloads and live-price updates.
  lastLiveUSD: null,
  // false until the user sets a real salary (slider, payslip upload, or restored state);
  // until then the default 5.000 € is presented as a clearly-labeled example.
  salaryProvided: false,
  // Per-tab figures for the shared condensed sticky strip (null = show dashes).
  stickyKpisCalculator: null,
  stickyKpisPortfolio: null,
  portfolioChart: null,
  firstCalculationRevealDone: false,
  revealAnimationPlaying: false,
  portfolioKpisAnimated: false,
  initAnimationsDone: false,
  activeTab: 'calculator',
  activeStrategy: 'path-c',
  chart: null,
  porscheChart: null,
  historicalPrices: null,
  usingHistoricalData: false,
  // The user's savings goal for the tracker: { name, image, price, url }.
  // price 0 = no goal set yet → the tracker shows an empty state until the user sets one.
  goal: { name: '', image: null, price: 0, url: null }
};

// Which Rechner design is active. Classic (pre-1c, chart-first) is the DEFAULT;
// only an explicit 'modern' keeps the new 1c layout. When classic, an inline
// script in index.html stamps the classic markup into #tab-calculator BEFORE this
// module evaluates — so the elements map below only ever sees ONE design's ids.
// Switching designs persists the choice and reloads the page. If storage throws,
// both here and the inline script fall back to the 1c design.
const CALC_CLASSIC = (() => {
  try { return localStorage.getItem(LS_KEYS.calcDesign) !== 'modern'; } catch (e) { return false; }
})();

// DOM Elements
const elements = {
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  liveTicker: document.getElementById('liveTicker'),

  // Calculator Inputs (1c design: sliders live in popovers, mirrored by number fields)
  inputStockPrice: document.getElementById('inputStockPrice'),
  inputFX: document.getElementById('inputFX'),
  btnFetchStock: document.getElementById('btnFetchStock'),
  valStockPriceEUR: document.getElementById('valStockPriceEUR'),
  valExchangeRate: document.getElementById('valExchangeRate'),
  inputMonthlySalary: document.getElementById('inputMonthlySalary'),
  numSalary: document.getElementById('numSalary'),
  inputSavingsRate: document.getElementById('inputSavingsRate'),
  numRate: document.getElementById('numRate'),
  selectTaxYear: document.getElementById('selectTaxYear'),
  inputTaxRate: document.getElementById('inputTaxRate'),
  selectChurchTax: document.getElementById('selectChurchTax'),
  selectSoli: document.getElementById('selectSoli'),
  selectBroker: document.getElementById('selectBroker'),
  selectCalcMode: document.getElementById('selectCalcMode'),
  inputJoinDate: document.getElementById('inputJoinDate'),
  rangeJoinYear: document.getElementById('rangeJoinYear'),
  rangeJoinMonth: document.getElementById('rangeJoinMonth'),
  inputSellPrice: document.getElementById('inputSellPrice'),
  rangeSell: document.getElementById('rangeSell'),
  inputAccumulatedMonths: document.getElementById('inputAccumulatedMonths'),
  numMonths: document.getElementById('numMonths'),

  // Classic-design elements (null while the new 1c design is stamped; the classic
  // render/wiring paths only run when CALC_CLASSIC is true)
  valMonthlySalary: document.getElementById('valMonthlySalary'),
  valSavingsRate: document.getElementById('valSavingsRate'),
  valTaxRate: document.getElementById('valTaxRate'),
  valAccumulatedMonths: document.getElementById('valAccumulatedMonths'),
  germanBrokerNote: document.getElementById('germanBrokerNote'),
  netProfitEuro: document.getElementById('netProfitEuro'),
  netProfitPercent: document.getElementById('netProfitPercent'),
  netInvestment: document.getElementById('netInvestment'),
  lblGross500: document.getElementById('lblGross500'),
  lblTax35: document.getElementById('lblTax35'),
  lblNet276: document.getElementById('lblNet276'),
  lblInstantGain: document.getElementById('lblInstantGain'),

  // Guide Strategies
  strategyCards: document.querySelectorAll('.strategy-card'),
  pathDetails: document.getElementById('path-details'),

  // Goal Tracker Elements (internal ids kept as "porsche*")
  porscheChartYearBadge: document.getElementById('porscheChartYearBadge'),
  inputStockGrowth: document.getElementById('inputStockGrowth'),
  valStockGrowth: document.getElementById('valStockGrowth'),
  porscheProgressBadge: document.getElementById('porscheProgressBadge'),
  porscheRadialFill: document.getElementById('porscheRadialFill'),
  porscheRadialPercent: document.getElementById('porscheRadialPercent'),
  porscheCurrentSaved: document.getElementById('porscheCurrentSaved'),
  porscheRemainingAmount: document.getElementById('porscheRemainingAmount'),
  porscheTimeNeeded: document.getElementById('porscheTimeNeeded'),
  porscheTargetDate: document.getElementById('porscheTargetDate'),
  porscheSharesNeeded: document.getElementById('porscheSharesNeeded'),
  porscheSharesLabel: document.getElementById('porscheSharesLabel'),
  porscheSharesSubtitle: document.getElementById('porscheSharesSubtitle'),
  porscheCurrentSavedLabel: document.getElementById('porscheCurrentSavedLabel'),
  porscheOutPocket: document.getElementById('porscheOutPocket'),
  porscheLeverageAmount: document.getElementById('porscheLeverageAmount'),
  porscheLeveragePercent: document.getElementById('porscheLeveragePercent'),

  // Goal elements (one unified field: #goalName takes a name, search term or link)
  goalBadge: document.getElementById('goalBadge'),
  btnLoadGoal: document.getElementById('btnLoadGoal'),
  goalStatus: document.getElementById('goalStatus'),
  goalImageWrap: document.getElementById('goalImageWrap'),
  goalImage: document.getElementById('goalImage'),
  goalName: document.getElementById('goalName'),
  goalLink: document.getElementById('goalLink'),
  goalPrice: document.getElementById('goalPrice')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  syncHeaderHeightVar();
  window.addEventListener('resize', syncHeaderHeightVar);

  initTabs();
  initStrategySelector();
  initCalculator();
  fetchLiveStockPrice();
  // Keep the header ticker honest: refresh every 2 min (cheap — the server caches
  // the quote, and deliberately set Kauf-/Verkaufskurse are never overwritten).
  // The portfolio tab is NOT auto-refreshed: a background re-analysis would
  // re-render its tables and throw away the user's sorting mid-read.
  setInterval(() => fetchLiveStockPrice({ silent: true }), 120000);
  initPdfUploader();
  initPorscheTracker();
  initPortfolioModule();
  initWelcome();
  initThemeToggle();
  initSaleProcessCollapsible();
  initDetailsAnimations();
  initW8benTracker();

  // Trigger GSAP entrance timelines
  initGsapAnimations();

  // Condensed sticky KPI strip + scroll-in reveals for the Rechner tab
  initStickySummary();
  if (state.activeTab === 'calculator') setupCalcScrollReveals();

  // Details Toggle in Aktientransfer (GSAP slide instead of a hard show/hide)
  const collapseTransferCard = (card) => {
    if (!card || card.classList.contains('hidden-details')) return;
    gsapSlide(card, false, { onDone: () => card.classList.add('hidden-details') });
  };
  document.querySelectorAll('.btn-show-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      // Close all others
      document.querySelectorAll('.transfer-details-card').forEach(card => {
        if (card.id !== targetId) collapseTransferCard(card);
      });

      // Toggle current
      if (targetEl.classList.contains('hidden-details')) {
        targetEl.classList.remove('hidden-details');
        gsapSlide(targetEl, true, {
          onDone: () => targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        });
      } else {
        collapseTransferCard(targetEl);
      }
    });
  });

  document.querySelectorAll('.btn-close-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      collapseTransferCard(e.target.closest('.transfer-details-card'));
    });
  });

  // "Zum Rechner / Zur Analyse / ..." shortcuts in the Reiseführer feature cards.
  // Targets map to top-level sections directly, so 'taxes' opens the Steuern sub of Wissen.
  document.querySelectorAll('[data-goto-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-goto-tab');
      if (document.getElementById(`tab-${target}`)) {
        goToTab(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
});

// Light/Dark mode toggle. The saved theme is applied pre-paint by the inline
// <head> script; here we keep the button in sync, handle clicks, and rebuild
// the Chart.js charts so their canvas colors match the new theme.
// Persisted in localStorage[LS_KEYS.theme] so it sticks across every tab/reload.
function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const apply = (theme) => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  };

  // Reflect the theme the head-script already applied.
  apply(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem(LS_KEYS.theme, next); } catch (e) { /* ignore */ }

    // Re-create the charts with the new theme's canvas colors.
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    if (state.porscheChart) { state.porscheChart.destroy(); state.porscheChart = null; }
    if (state.portfolioChart) {
      state.portfolioChart.destroy();
      state.portfolioChart = null;
      renderPortfolioChart();
    }
    calculateESPP(); // re-renders donut + goal projection (via updateGoalTracker)
  });
}

// First-visit welcome overlay + the "what is this" capability shortcuts.
function initWelcome() {
  const overlay = document.getElementById('welcomeOverlay');
  // Robust scroll lock: body{overflow:hidden} alone is ignored by iOS Safari and leaks
  // through scroll chaining — fixing the body in place blocks every scroll path.
  let lockedScrollY = 0;
  const open = () => {
    if (!overlay) return;
    
    lockedScrollY = window.scrollY || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';

    // Prepare styles for GSAP
    overlay.style.display = 'flex';
    const startBtn = document.getElementById('welcomeStart');
    if (prefersReducedMotion()) {
      gsap.set(overlay, { opacity: 1 });
      startBtn?.focus({ preventScroll: true });
      return;
    }
    gsap.set(overlay, { opacity: 0, backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)' });

    const modal = overlay.querySelector('.welcome-modal');
    if (modal) {
      gsap.set(modal, { scale: 0.92, y: 30, opacity: 0 });

      // Feature rows stagger individually (not the list as one block); their
      // icons pop in a beat later for a layered feel.
      const children = [
        modal.querySelector('.welcome-close'),
        modal.querySelector('.welcome-logo'),
        modal.querySelector('.welcome-eyebrow'),
        modal.querySelector('#welcomeTitle'),
        modal.querySelector('.welcome-lead'),
        ...modal.querySelectorAll('.welcome-feature'),
        modal.querySelector('.welcome-privacy-card'),
        modal.querySelector('#welcomeStart'),
        modal.querySelector('.welcome-reopen-hint')
      ].filter(Boolean);
      const logo = modal.querySelector('.welcome-logo');
      const featureIcons = modal.querySelectorAll('.welcome-feature > i:first-child');

      gsap.set(children, { opacity: 0, y: 15 });
      if (logo) gsap.set(logo, { rotation: -8 });
      gsap.set(featureIcons, { opacity: 0, scale: 0.5 });

      // Play open sequence in a single cohesive timeline: the page "defocuses"
      // behind the modal, the logo drops in with a tilt, rows cascade, icons pop,
      // then a glow pulse on the logo and (after a pause) one nudge on the CTA.
      const tl = gsap.timeline({ onComplete: () => startBtn?.focus({ preventScroll: true }) });
      tl.to(overlay, {
        opacity: 1,
        backdropFilter: 'blur(6px)',
        webkitBackdropFilter: 'blur(6px)',
        duration: 0.35,
        ease: "power2.out"
      });
      tl.to(modal, {
        scale: 1,
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.5)"
      }, "-=0.2");
      tl.to(children, {
        opacity: 1,
        y: 0,
        duration: 0.45,
        stagger: 0.06,
        ease: "power2.out"
      }, "-=0.35");
      if (logo) tl.to(logo, { rotation: 0, duration: 0.6, ease: "back.out(2)" }, "<");
      tl.to(featureIcons, {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        stagger: 0.1,
        ease: "back.out(2.5)"
      }, "-=0.55");
      if (logo) {
        tl.to(logo, {
          boxShadow: '0 10px 42px rgba(0, 242, 254, 0.5)',
          duration: 0.45,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
          onComplete: () => gsap.set(logo, { clearProps: 'boxShadow' })
        }, "+=0.15");
      }
      if (startBtn) {
        tl.to(startBtn, {
          scale: 1.03,
          duration: 0.35,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
          onComplete: () => gsap.set(startBtn, { clearProps: 'scale' })
        }, "+=1.4");
      }
    } else {
      gsap.to(overlay, { opacity: 1, duration: 0.35, ease: "power2.out" });
    }
  };

  const close = () => {
    if (!overlay) return;

    const modal = overlay.querySelector('.welcome-modal');

    // Dialog etiquette: if focus is still inside the overlay, hand it back to
    // the "?" button that (re-)opens it, so keyboard users aren't stranded.
    const focusWasInside = overlay.contains(document.activeElement);

    const cleanup = () => {
      overlay.style.display = 'none';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, lockedScrollY);
      if (focusWasInside) document.getElementById('helpBtn')?.focus({ preventScroll: true });
      try { localStorage.setItem(LS_KEYS.seenWelcome, '1'); } catch (e) { /* private mode */ }
    };

    if (prefersReducedMotion()) {
      cleanup();
      return;
    }

    const tl = gsap.timeline({ onComplete: cleanup });

    if (modal) {
      tl.to(modal, { scale: 0.92, y: 20, opacity: 0, duration: 0.22, ease: "power2.in" }, 0);
    }
    tl.to(overlay, { opacity: 0, duration: 0.22, ease: "power2.in" }, 0.04);
  };

  document.getElementById('welcomeClose')?.addEventListener('click', close);
  document.getElementById('welcomeStart')?.addEventListener('click', close);
  document.getElementById('helpBtn')?.addEventListener('click', open);   // re-openable anytime
  // Feature rows are shortcuts: the global [data-goto-tab] handler switches the
  // tab; here we just close the overlay and land at the top of that tab.
  overlay?.querySelectorAll('.welcome-feature[data-goto-tab]').forEach(btn => {
    btn.addEventListener('click', () => { lockedScrollY = 0; close(); });
  });
  // Dismiss by clicking the backdrop or pressing Escape.
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') close(); });

  // Focus trap (dialog etiquette): while the overlay is open, Tab cycles within it
  // instead of wandering into the scroll-locked page behind it.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !overlay || overlay.style.display !== 'flex') return;
    const focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const inside = overlay.contains(document.activeElement);
    if (e.shiftKey && (!inside || document.activeElement === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  });

  // Show once, on the very first visit.
  let seen = false;
  try { seen = !!localStorage.getItem(LS_KEYS.seenWelcome); } catch (e) { /* private mode */ }
  if (!seen) open();
}

// W-8BEN expiry tracker (Steuern tab). A W-8BEN stays valid until 31 December of the
// third year after the signature year (e.g. signed 2022 -> valid through 2025). The
// user picks the signature year per account; stored only in localStorage.
function initW8benTracker() {
  const rows = [
    { select: document.getElementById('w8benYearEq'), status: document.getElementById('w8benStatusEq'), key: 'equateplus' },
    { select: document.getElementById('w8benYearBroker'), status: document.getElementById('w8benStatusBroker'), key: 'broker' }
  ].filter(r => r.select && r.status);
  if (!rows.length) return;

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEYS.w8ben) || '{}') || {}; } catch (e) { /* corrupt entry */ }

  const renderStatus = (row, animate = false) => {
    const year = parseInt(row.select.value, 10);
    const el = row.status;
    el.classList.remove('ok', 'warn', 'expired');
    if (!isFinite(year)) {
      el.innerHTML = '<i class="fa-solid fa-circle-question"></i> Status unbekannt';
    } else {
      const expiryYear = year + 3;
      const daysLeft = Math.ceil((new Date(expiryYear, 11, 31, 23, 59, 59) - Date.now()) / 86400000);
      if (daysLeft < 0) {
        el.classList.add('expired');
        el.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Abgelaufen am 31.12.${expiryYear} – erneuern, sonst 30&nbsp;% statt 15&nbsp;% Quellensteuer!`;
      } else if (daysLeft <= 92) {
        el.classList.add('warn');
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Läuft am 31.12.${expiryYear} ab (noch ${daysLeft} Tage) – jetzt erneuern`;
      } else {
        el.classList.add('ok');
        el.innerHTML = `<i class="fa-solid fa-circle-check"></i> Gültig bis 31.12.${expiryYear}`;
      }
    }
    // Micro-feedback on user changes only (not on the initial restore render).
    if (animate && !prefersReducedMotion()) {
      gsap.fromTo(el, { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', overwrite: true, clearProps: 'opacity,transform' });
    }
  };

  const currentYear = new Date().getFullYear();
  rows.forEach(row => {
    for (let y = currentYear; y >= currentYear - 10; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      row.select.appendChild(opt);
    }
    if (Number.isInteger(saved[row.key])) row.select.value = String(saved[row.key]);
    row.select.addEventListener('change', () => {
      const val = parseInt(row.select.value, 10);
      if (isFinite(val)) saved[row.key] = val; else delete saved[row.key];
      try { localStorage.setItem(LS_KEYS.w8ben, JSON.stringify(saved)); } catch (e) { /* private mode */ }
      renderStatus(row, true);
    });
    renderStatus(row);
  });
}

// Tab Navigation
// "Wissen" merges the former Anleitung + Steuern tabs behind one nav button. Both
// remain separate .tab-content sections (#tab-guide / #tab-taxes) switched by a
// sub-navigation; the single "Wissen" nav button stays highlighted for either.
function navTabMatches(btn, tabId) {
  const d = btn.getAttribute('data-tab');
  if (d === tabId) return true;
  return btn.dataset.tabGroup === 'wissen' && (tabId === 'guide' || tabId === 'taxes');
}

function setActiveNav(tabId) {
  elements.navTabs.forEach(t => {
    const on = navTabMatches(t, tabId);
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function syncWissenSubnav(tabId) {
  const sub = tabId === 'taxes' ? 'taxes' : 'guide';
  document.querySelectorAll('.wissen-subtab').forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === sub);
  });
}

// Switch to a top-level section by id ('calculator' | 'portfolio' | 'porsche' |
// 'guide' | 'taxes'). Shared by the nav buttons, the Wissen sub-nav and the
// [data-goto-tab] shortcuts.
function goToTab(tabId) {
  if (state.activeTab === tabId) { syncWissenSubnav(tabId); return; }
  const currentTabId = state.activeTab;
  state.activeTab = tabId;
  try { localStorage.setItem(LS_KEYS.activeTab, tabId); } catch (e) { /* private mode */ }

  setActiveNav(tabId);
  syncWissenSubnav(tabId);

  const currentContent = document.getElementById(`tab-${currentTabId}`);
  const nextContent = document.getElementById(`tab-${tabId}`);
  const afterSwap = () => {
    if (tabId === 'calculator' && state.chart) state.chart.resize();
    if (tabId === 'porsche' && state.porscheChart) state.porscheChart.resize();
  };

  if (currentContent && nextContent) {
    currentContent.classList.remove('active');
    nextContent.classList.add('active');
    if (!prefersReducedMotion()) {
      gsap.fromTo(nextContent, { opacity: 0 },
        { opacity: 1, duration: 0.15, ease: 'power1.out', onComplete: afterSwap });
    } else {
      afterSwap();
    }
  } else {
    elements.tabContents.forEach(c => c.classList.remove('active'));
    if (nextContent) nextContent.classList.add('active');
    afterSwap();
  }

  if (tabId === 'portfolio') triggerPortfolioKpisAnimation(0.1);
  if (tabId === 'calculator') setupCalcScrollReveals();
  if (tabId === 'guide' || tabId === 'taxes') setupContentScrollReveals(tabId);
  if (tabId === 'porsche') {
    animateGoalCardsIn();
    if (state.goalCelebrationPending) celebrateGoalReached();
  }

  applyStickyKpis(tabId);
  updateStickySummaryVisibility();
  if (window.ScrollTrigger) ScrollTrigger.refresh();

  const navEl = [...elements.navTabs].find(t => navTabMatches(t, tabId));
  if (navEl) navEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

function initTabs() {
  let savedTab = localStorage.getItem(LS_KEYS.activeTab);
  // Guard against a saved tab that no longer exists (e.g. the removed "transfer" tab).
  if (savedTab && !document.getElementById(`tab-${savedTab}`)) {
    savedTab = 'calculator';
    localStorage.setItem(LS_KEYS.activeTab, savedTab);
  }
  if (savedTab) {
    state.activeTab = savedTab;
    setActiveNav(savedTab);
    syncWissenSubnav(savedTab);
    elements.tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${savedTab}`));
    // Bring the restored active tab into view in the scrollable mobile nav.
    const activeTabEl = [...elements.navTabs].find(t => navTabMatches(t, savedTab));
    if (activeTabEl) activeTabEl.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => goToTab(tab.getAttribute('data-tab')));
  });
  // Wissen sub-navigation: Anleitung (#tab-guide) ⇄ Steuern (#tab-taxes).
  document.querySelectorAll('.wissen-subtab').forEach(btn => {
    btn.addEventListener('click', () => goToTab(btn.dataset.subtab === 'taxes' ? 'taxes' : 'guide'));
  });
}

// Fetch Live Stock Price.
// silent: skip the "Aktualisiere Kurs..." flicker (periodic background refresh).
// force:  the user explicitly clicked the refresh button next to the Kaufkurs —
//         overwrite the buy price even if they had typed a custom value.
async function fetchLiveStockPrice({ silent = false, force = false } = {}) {
  if (!silent) {
    elements.liveTicker.innerHTML = `<span class="pulse-dot pulse"></span> <span class="ticker-text">Aktualisiere Kurs...</span>`;
  }

  try {
    const data = await api.fetchStock();

    if (data.success || data.fallback) {
      // Decide BEFORE updating state whether the buy/sell inputs were merely
      // tracking the live price. Only then move them along — deliberately chosen
      // Kauf-/Verkaufskurse must survive the periodic background refresh.
      const sellValBefore = parseFloat(elements.inputSellPrice.value);
      const buyValBefore = parseFloat(elements.inputStockPrice.value);
      const buyTracksLive = force || state.lastLiveUSD === null ||
        !isFinite(buyValBefore) ||
        Math.abs(buyValBefore - state.lastLiveUSD) < 0.01;
      const sellTracksLive = state.lastLiveUSD === null ||
        !isFinite(sellValBefore) ||
        Math.abs(sellValBefore - state.lastLiveUSD) < 0.01 ||
        Math.abs(sellValBefore - buyValBefore) < 0.01;

      const liveUSD = data.usdPrice;
      state.exchangeRate = data.exchangeRate;
      state.previousCloseUSD = data.previousCloseUSD || data.usdPrice;
      state.previousCloseEUR = data.previousCloseEUR || data.eurPrice;
      if (buyTracksLive) {
        state.usdPrice = liveUSD;
        elements.inputStockPrice.value = liveUSD.toFixed(2);
      }
      state.eurPrice = state.usdPrice * state.exchangeRate;
      state.lastLiveUSD = liveUSD;

      // Update UI Inputs
      if (sellTracksLive) elements.inputSellPrice.value = liveUSD.toFixed(2);
      elements.valStockPriceEUR.textContent = `${state.eurPrice.toFixed(2)} €`;
      elements.valExchangeRate.textContent = state.exchangeRate.toFixed(4);

      // Render Live Ticker (always with the LIVE price, independent of the inputs)
      const isUp = liveUSD >= state.previousCloseUSD;
      const change = liveUSD - state.previousCloseUSD;
      const changePercent = (change / state.previousCloseUSD) * 100;

      elements.liveTicker.innerHTML = `
        <span class="pulse-dot"></span>
        <span class="ticker-text" style="white-space: nowrap;">
          <strong>IBM: $${liveUSD.toFixed(2)}</strong>
          (<span style="color: ${isUp ? '#4ade80' : '#f87171'}">${isUp ? '+' : ''}${changePercent.toFixed(1)}%</span>)
        </span>
      `;

      // Recalculate
      calculateESPP();
    }
  } catch (error) {
    console.error('Failed to fetch stock price:', error);
    if (!silent) {
      elements.liveTicker.innerHTML = `<span class="pulse-dot error"></span> <span class="ticker-text" style="color:#f87171">Offline (Nutze Fallback)</span>`;
    }
  }
}

// Strategy Selector in Guide Tab
const strategies = {
  'path-c': {
    title: 'Weg C: Regelmäßig verkaufen & Vermögen streuen (Empfohlen)',
    accent: 'var(--accent)',
    html: `
      <div class="strategy-header">
        <h4 style="color: var(--accent); font-size:1.3rem; margin-bottom: 10px;"><i class="fa-solid fa-rocket"></i> Weg C: Der Königsweg für Rendite-Optimierung</h4>
        <p>Du behältst die Aktien nicht unbegrenzt, sondern transferierst sie regelmäßig gebührenfrei zu einem US-Broker (CapTrader / Interactive Brokers) und verkaufst sie dort für minimale Kosten (ca. 2€ Provision).</p>
        <p style="margin-top:10px; font-size:0.9rem; color: var(--text-muted);"><i class="fa-solid fa-circle-info" style="color: var(--accent);"></i> <strong>„Regelmäßig" – welches Intervall?</strong> Es gibt keinen festen Takt. Sinnvoll ist ein Transfer immer dann, wenn sich genug <em>ganze</em> Aktien angesammelt haben (Bruchteile bleiben bei EquatePlus) – typischerweise quartalsweise, passend zum ESPP-/Dividenden-Rhythmus. Da Transfer + Verkauf zusammen nur ca. 4€ kosten, musst Du keine großen Stückzahlen bündeln; das Intervall ist Deine Entscheidung.</p>
      </div>
      <div class="grid-2col" style="margin-top: 20px;">
        <div>
          <h5 style="color:var(--text-strong); margin-bottom:10px;"><i class="fa-solid fa-circle-check text-success"></i> Deine Vorteile</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Minimale Kosten:</strong> Verkauf + Devisentausch kosten insgesamt nur ca. 4€ statt über 50$ bei EquatePlus.</li>
            <li><strong>Klumpenrisiko vermeiden:</strong> Du investierst den Erlös in breit gestreute ETFs statt alles in IBM-Aktien zu halten.</li>
            <li><strong>Voller Rabatt-Hebel:</strong> Du realisierst den 15% Rabatt (bzw. 81% Nettogewinn) sofort als echtes Geld.</li>
          </ul>
        </div>
        <div>
          <h5 style="color:var(--text-strong); margin-bottom:10px;"><i class="fa-solid fa-circle-exclamation text-warning"></i> Wichtig zu beachten</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Transfer läuft über EquatePlus:</strong> Du löst den Übertrag dort mit Broker-Code (0534) und Deiner IBKR-Kontonummer aus. Eine vorherige Empfangsanweisung bei CapTrader/IBKR ist <strong>optional</strong> – nach Nutzer-Erfahrung nicht notwendig.</li>
            <li><strong>Dividenden sind Cash – kein Verkauf nötig:</strong> Solange Aktien bei EquatePlus liegen, fallen dort Dividenden an. Du stellst nur ein, ob sie als <strong>Bargeld</strong> ausgezahlt oder <strong>reinvestiert</strong> werden – verkaufen musst Du dafür nichts. Nur reinvestierte Dividenden werden zu Aktien, die Du später bei CapTrader/IBKR mitverkaufst.</li>
            <li><strong>Steuererklärung:</strong> Du musst die Gewinne selbst in der Anlage KAP angeben, da US-Broker keine deutsche Steuer automatisch abführen.</li>
          </ul>
        </div>
      </div>
    `
  },
  'path-b': {
    title: 'Weg B: Aktien sammeln, Dividenden als Cash auszahlen',
    accent: '#38bdf8',
    html: `
      <div class="strategy-header">
        <h4 style="color: #38bdf8; font-size:1.3rem; margin-bottom: 10px;"><i class="fa-solid fa-sack-dollar"></i> Weg B: Der Sammler-Weg ohne Gebührenfalle</h4>
        <p>Du möchtest IBM Aktien langfristig halten, lehnst aber das automatische Reinvestment bei EquatePlus ab. Die Dividenden lässt Du Dir als Bargeld auszahlen, statt damit (gebührenpflichtig) neue Aktien zu kaufen.</p>
      </div>
      <div class="grid-2col" style="margin-top: 20px;">
        <div>
          <h5 style="color:var(--text-strong); margin-bottom:10px;"><i class="fa-solid fa-circle-check text-success"></i> Deine Vorteile</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Kein Zwangskauf:</strong> Du entscheidest selbst, wann Du Dividenden anlegst, und kaufst nicht ungefragt unrabattierte Aktien.</li>
            <li><strong>Keine 2&nbsp;%-Reinvest-Gebühr:</strong> Du sparst Dir die Gebühr, die EquatePlus auf jede automatisch reinvestierte Dividende einbehält.</li>
          </ul>
        </div>
        <div>
          <h5 style="color:var(--text-strong); margin-bottom:10px;"><i class="fa-solid fa-triangle-exclamation text-danger"></i> Nachteile & Gebühren</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Klumpenrisiko bleibt:</strong> Dein Vermögen hängt stark von der Entwicklung der IBM ab.</li>
            <li><strong>US-Konto nötig für günstige Cash-Auszahlung:</strong> Die Bargeld-Dividende geht nur gebührenfrei, wenn bei EquatePlus ein US-Bankkonto (z.&nbsp;B. kostenloses Wise-Konto) hinterlegt ist – sonst drohen teurer Scheck (~28&nbsp;€) oder Wire (~35&nbsp;$). CapTrader/IBKR eignet sich dafür <strong>nicht</strong>.</li>
            <li><strong>Verkauf erst später:</strong> Du realisierst Gewinne (und den 15&nbsp;%-Rabatt) nicht zeitnah. Wenn Du irgendwann verkaufst, transferiere die Aktien wie bei Weg&nbsp;C zu CapTrader/IBKR (~4&nbsp;€) – nur der Direktverkauf über EquatePlus wäre teuer (>50&nbsp;$).</li>
          </ul>
        </div>
      </div>
    `
  },
  'path-a': {
    title: 'Weg A: Aktien ansammeln & Dividenden reinvestieren (Sehr passiv)',
    accent: '#fbbf24',
    html: `
      <div class="strategy-header">
        <h4 style="color: #fbbf24; font-size:1.3rem; margin-bottom: 10px;"><i class="fa-solid fa-piggy-bank"></i> Weg A: Der passive, aber teure Weg</h4>
        <p>Du stellst bei EquatePlus die Option "Full Dividend Reinvestment" ein. Dividenden werden automatisch in neue IBM-Aktien reinvestiert. Dies erfordert die wenigsten Handgriffe, schmälert aber Deine Rendite.</p>
      </div>
      <div class="grid-2col" style="margin-top: 20px;">
        <div>
          <h5 style="color:var(--text-strong); margin-bottom:10px;"><i class="fa-solid fa-circle-check text-success"></i> Deine Vorteile</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Absolut Passiv:</strong> Du musst Dich nicht um Konten, Broker oder manuelle Übertragungen kümmern.</li>
            <li><strong>Zinseszinseffekt:</strong> Dividenden arbeiten sofort wieder in IBM-Aktien weiter.</li>
          </ul>
        </div>
        <div>
          <h5 style="color:var(--text-strong); margin-bottom:10px;"><i class="fa-solid fa-circle-xmark text-danger"></i> Die Nachteile (Hohe Kosten)</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Kein Rabatt auf Dividenden-Käufe:</strong> Über Dividenden gekaufte Aktien erhalten KEINE 15% Rabatt.</li>
            <li><strong>Zusatzgebühren:</strong> EquatePlus behält 2% Gebühr auf jede reinvestierte Dividende ein.</li>
            <li><strong>Steuerpflicht bleibt:</strong> Trotz Reinvestition müssen Dividenden jährlich in Deutschland versteuert werden!</li>
          </ul>
        </div>
      </div>
    `
  }
};

function initStrategySelector() {
  elements.strategyCards.forEach(card => {
    card.addEventListener('click', () => {
      const strategyId = card.getAttribute('data-strategy');
      state.activeStrategy = strategyId;
      
      elements.strategyCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      renderStrategyDetails(strategyId);
    });
  });
  
  // Initial render
  renderStrategyDetails(state.activeStrategy);
}

function renderStrategyDetails(strategyId) {
  const strat = strategies[strategyId];
  if (strat) {
    elements.pathDetails.innerHTML = strat.html;
    elements.pathDetails.style.borderColor = strat.accent;
  }
}

function saveCalculatorState() {
  const btnClearCalculator = document.getElementById('btnClearCalculator');
  
  const serialized = {
    monthlySalary: elements.inputMonthlySalary.value,
    savingsRate: elements.inputSavingsRate.value,
    taxYear: elements.selectTaxYear.value,
    taxRate: elements.inputTaxRate.value,
    churchTax: elements.selectChurchTax.value,
    soli: elements.selectSoli.value,
    broker: elements.selectBroker.value,
    sellPrice: elements.inputSellPrice.value,
    // Market snapshot: without it, a reload falls back to the hardcoded 180 $ /
    // 0.92 defaults until /api/stock answers — which made the one spread-dependent
    // row (Kapitalertragsteuer beim Verkauf) visibly lag behind the others.
    stockPrice: elements.inputStockPrice.value,
    marketFX: state.exchangeRate,
    lastLiveUSD: state.lastLiveUSD,
    accumulatedMonths: elements.inputAccumulatedMonths.value,
    salaryProvided: state.salaryProvided,
    calcMode: elements.selectCalcMode ? elements.selectCalcMode.value : 'forecast',
    joinDate: elements.inputJoinDate ? elements.inputJoinDate.dataset.value : ''
  };

  localStorage.setItem(LS_KEYS.calculatorState, JSON.stringify(serialized));
  
  if (btnClearCalculator) {
    btnClearCalculator.style.display = 'block';
  }
}

function loadCalculatorState() {
  try {
    const raw = localStorage.getItem(LS_KEYS.calculatorState);
    const btnClearCalculator = document.getElementById('btnClearCalculator');
    
    if (!raw) {
      if (btnClearCalculator) btnClearCalculator.style.display = 'none';
      return;
    }
    
    const parsed = JSON.parse(raw);
    if (!parsed) return;

    if (parsed.monthlySalary !== undefined) {
      elements.inputMonthlySalary.value = parsed.monthlySalary;
      if (elements.valMonthlySalary) elements.valMonthlySalary.value = `${parseInt(parsed.monthlySalary).toLocaleString('de-DE')} €`;
    }
    // Restore the "real salary entered" flag; older saved states (without the flag) count as
    // user-provided only if the stored salary differs from the 5.000 € example default.
    state.salaryProvided = parsed.salaryProvided === true ||
      (parsed.salaryProvided === undefined && parsed.monthlySalary !== undefined && String(parsed.monthlySalary) !== '5000');
    if (parsed.savingsRate !== undefined) {
      elements.inputSavingsRate.value = parsed.savingsRate;
      if (elements.valSavingsRate) elements.valSavingsRate.value = `${parsed.savingsRate} %`;
    }
    if (parsed.taxYear !== undefined) {
      elements.selectTaxYear.value = parsed.taxYear;
    }
    if (parsed.taxRate !== undefined) {
      elements.inputTaxRate.value = parsed.taxRate;
      if (elements.valTaxRate) elements.valTaxRate.value = `${parsed.taxRate} %`;
    }
    if (parsed.churchTax !== undefined) {
      elements.selectChurchTax.value = parsed.churchTax;
    }
    if (parsed.soli !== undefined) {
      elements.selectSoli.value = parsed.soli;
    }
    if (parsed.broker !== undefined) {
      elements.selectBroker.value = parsed.broker;
    }
    if (parsed.sellPrice !== undefined) {
      elements.inputSellPrice.value = parsed.sellPrice;
    }
    // Restore the market snapshot so the very first (synchronous) calculation
    // already uses last session's real prices instead of the 180 $ defaults.
    // The live fetch then only nudges values by the actual intraday move.
    if (parsed.stockPrice !== undefined) {
      const savedBuy = parseFloat(parsed.stockPrice);
      const savedFX = parseFloat(parsed.marketFX);
      if (isFinite(savedBuy) && savedBuy > 0) {
        elements.inputStockPrice.value = parsed.stockPrice;
        state.usdPrice = savedBuy;
        if (isFinite(savedFX) && savedFX > 0) state.exchangeRate = savedFX;
        state.eurPrice = state.usdPrice * state.exchangeRate;
        const savedLive = parseFloat(parsed.lastLiveUSD);
        state.lastLiveUSD = isFinite(savedLive) ? savedLive : null;
        if (elements.valStockPriceEUR) elements.valStockPriceEUR.textContent = `${state.eurPrice.toFixed(2)} €`;
        if (elements.valExchangeRate) elements.valExchangeRate.textContent = state.exchangeRate.toFixed(4);
      }
    }
    if (parsed.accumulatedMonths !== undefined) {
      elements.inputAccumulatedMonths.value = parsed.accumulatedMonths;
      if (elements.valAccumulatedMonths) elements.valAccumulatedMonths.value = formatMonthsLabel(parseInt(parsed.accumulatedMonths));
    }

    if (parsed.calcMode && elements.selectCalcMode) {
      elements.selectCalcMode.value = parsed.calcMode;
    }
    if (parsed.joinDate && elements.inputJoinDate) {
      setJoinDateValue(parsed.joinDate);
    }
    applyCalcModeUI();
    if (elements.selectCalcMode && elements.selectCalcMode.value === 'historical') {
      ensureHistoricalData(); // async; re-runs calculateESPP when the series arrives
    }

    // omit loading uploadStatusHTML as it should not persist across reloads
    
    if (btnClearCalculator) {
      btnClearCalculator.style.display = 'block';
    }
  } catch (err) {
    console.error('Error loading calculator state from localStorage:', err);
  }
}

// Calculator Logic
// ===== Historical mode (Rechner): real monthly IBM prices & FX since the join date =====
// histState.months: [{ month: 'YYYY-MM', priceUSD, fx }] — monthly average close + avg USD->EUR rate.
let histState = { key: null, months: null, loading: false, error: null };

function setHistStatus(html, type) {
  const el = document.getElementById('histStatus');
  if (!el) return;
  if (!html) { el.className = 'c1c-hist-status hidden-status'; el.innerHTML = ''; return; }
  el.className = 'c1c-hist-status ' + (type || '');
  el.innerHTML = type === 'loading' ? `<span class="loading-spinner"></span> ${html}` : html;
}

// 'YYYY-MM' → 'Jan. 2021' (same short form as the sentence token).
function fmtMonthDE(ym) {
  const m = parseInt(ym.slice(5, 7), 10);
  return `${MONTH_NAMES_DE[m - 1].slice(0, 3)}. ${ym.slice(0, 4)}`;
}

// Show/hide the mode-dependent inputs (join date vs. buy price + holding period).
function applyCalcModeUI() {
  const historical = elements.selectCalcMode && elements.selectCalcMode.value === 'historical';

  // Swap the mode-specific sentence clauses (forecast: "verkaufe nach 12 Monaten";
  // historical: "seit Jan. 2022 … verkaufe heute alle N Aktien") and recolor the
  // tokens from green (forecast) to blue (historical) via the .is-hist class.
  const root = document.getElementById('calc1c');
  if (root) root.classList.toggle('is-hist', historical);
  document.querySelectorAll('.calc1c [data-mode]').forEach(el => {
    const forThis = el.dataset.mode === (historical ? 'hist' : 'forecast');
    el.style.display = forThis ? '' : 'none';
  });

  // Classic design: swap the mode-dependent input groups (join date vs. buy price +
  // holding period) and sync the segmented toggle in the output panel.
  const joinGroup = document.getElementById('joinDateGroup');
  const buyGroup = document.getElementById('buyPriceGroup');
  const holdGroup = document.getElementById('holdingGroup');
  if (joinGroup) joinGroup.style.display = historical ? '' : 'none';
  if (buyGroup) buyGroup.style.display = historical ? 'none' : '';
  if (holdGroup) holdGroup.style.display = historical ? 'none' : '';
  document.querySelectorAll('#calcModeToggle .mode-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.mode === 'historical') === historical);
  });

  // Mode switch lives in the subline: a plain-language text link plus a
  // HISTORISCH badge while the historical mode is active.
  const modeLink = document.getElementById('btnModeToggle');
  if (modeLink) {
    modeLink.textContent = historical
      ? 'Zurück zur Prognose'
      : 'Mit echten IBM-Kursen seit meinem Beitritt rechnen';
    modeLink.classList.toggle('c1c-link-blue', !historical);
  }
  const histBadge = document.getElementById('histBadge');
  if (histBadge) histBadge.style.display = historical ? '' : 'none';

  // Close any open popover — a token may have just been hidden by the swap.
  closeAllCalcPops();

  // The historical loading/success status line only matters in historical mode.
  const hs = document.getElementById('histStatus');
  if (hs && !historical) { hs.className = 'c1c-hist-status hidden-status'; hs.innerHTML = ''; }
}

// Persisted copy of the last fetched series. Monthly averages barely change
// (only the current month drifts), so a reload can paint the real numbers
// synchronously from this cache instead of waiting seconds on Yahoo.
const HIST_CACHE_LS_KEY = LS_KEYS.histCache;

function readHistCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(HIST_CACHE_LS_KEY) || 'null');
    if (cached && cached.key === key && Array.isArray(cached.months) && cached.months.length > 0) {
      return cached.months;
    }
  } catch (e) { /* corrupt cache — ignore */ }
  return null;
}

// Fetch (and cache) the monthly price + FX series from the join month until today.
async function ensureHistoricalData() {
  if (!elements.inputJoinDate) return;
  const joinVal = getJoinDateValue(); // 'YYYY-MM'
  const join = new Date(parseInt(joinVal.slice(0, 4)), parseInt(joinVal.slice(5, 7)) - 1, 1);
  const now = new Date();
  const monthsCount = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth()) + 1;
  if (monthsCount < 1) { setHistStatus('Der Beitritt liegt in der Zukunft.', 'error'); return; }
  const key = `${joinVal}_${monthsCount}`;
  if (histState.key === key && (histState.months || histState.loading)) return;

  // Hydrate synchronously from the cache (the key embeds the month count, so a
  // new calendar month automatically invalidates it). The fresh fetch below then
  // only nudges the numbers instead of making the whole list jump.
  const cachedMonths = readHistCache(key);
  histState = { key, months: cachedMonths, loading: true, error: null };
  if (cachedMonths) {
    setHistStatus(`<span class="ok">✓</span> ${cachedMonths.length} Monatskäufe simuliert (zwischengespeichert) – aktualisiere im Hintergrund…`, 'success');
  } else {
    setHistStatus('Lade historische IBM-Kurse & Wechselkurse…', 'loading');
  }
  try {
    const period1 = Math.floor(join.getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const [stockResp, fxResp] = await Promise.all([
      api.fetchHistorical(monthsCount),
      api.fetchForexRange(period1, period2).catch(() => null)
    ]);
    if (!stockResp || !stockResp.success || !Array.isArray(stockResp.months) || stockResp.months.length === 0) {
      throw new Error('keine Kursdaten erhalten');
    }
    // Average the daily USD->EUR rates per month (purchase-month FX for the EUR cost basis).
    const fxByMonth = {};
    if (fxResp && fxResp.success && Array.isArray(fxResp.rates)) {
      const groups = {};
      fxResp.rates.forEach(r => {
        const d = new Date(r.timestamp);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        (groups[k] = groups[k] || []).push(r.rate);
      });
      Object.keys(groups).forEach(k => { fxByMonth[k] = groups[k].reduce((a, b) => a + b, 0) / groups[k].length; });
    }
    // FX fallback for months before the USD/EUR history begins (Yahoo: 2003-12):
    // use the chronologically nearest known rate instead of today's rate.
    const fxKeys = Object.keys(fxByMonth).sort();
    const nearestFx = (key) => {
      if (fxByMonth[key]) return fxByMonth[key];
      let prev = null;
      for (const k of fxKeys) { if (k <= key) prev = k; else break; }
      const pick = prev || fxKeys[0];
      return pick ? fxByMonth[pick] : (stockResp.exchangeRate || state.exchangeRate);
    };

    const months = stockResp.months
      .filter(m => m.month >= joinVal)
      .map(m => ({
        month: m.month,
        priceUSD: m.averagePrice,
        fx: nearestFx(m.month)
      }));
    if (months.length === 0) throw new Error('keine Kursdaten für den Zeitraum');
    histState = { key, months, loading: false, error: null };
    try {
      localStorage.setItem(HIST_CACHE_LS_KEY, JSON.stringify({ key, months }));
    } catch (e) { /* storage full / private mode — cache is best-effort */ }

    let note = '';
    if (months[0].month > joinVal) {
      note += ` · Kursdaten erst ab ${fmtMonthDE(months[0].month)} verfügbar`;
    }
    if (fxKeys.length > 0 && months[0].month < fxKeys[0]) {
      note += ` · USD/EUR-Kurse erst ab ${fmtMonthDE(fxKeys[0])} – frühere Käufe nutzen den ältesten Kurs`;
    }
    setHistStatus(`<span class="ok">✓</span> ${months.length} Monatskäufe mit echten Kursen simuliert — ${fmtMonthDE(months[0].month)} bis ${fmtMonthDE(months[months.length - 1].month)}${note}`, 'success');
  } catch (e) {
    // Keep the cached series usable when the refresh fails — stale beats empty.
    histState = { key, months: cachedMonths, loading: false, error: e.message };
    if (cachedMonths) {
      setHistStatus(`<span class="ok">✓</span> ${cachedMonths.length} Monatskäufe simuliert (zwischengespeicherte Kurse – Aktualisierung fehlgeschlagen)`, 'warning');
    } else {
      setHistStatus('Historische Kurse konnten nicht geladen werden: ' + e.message, 'error');
    }
  }
  calculateESPP();
}

// The join-date field is a readonly TEXT input (a real type="month" would trigger the
// native iOS wheel picker alongside our popover). The machine value ('YYYY-MM') lives in
// data-value; the visible value is a localized label like "Januar 2022".
const MONTH_NAMES_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function getJoinDateValue() {
  return (elements.inputJoinDate && elements.inputJoinDate.dataset.value) || '2022-01';
}

function setJoinDateValue(val) {
  if (!elements.inputJoinDate || !/^\d{4}-\d{2}$/.test(val)) return;
  elements.inputJoinDate.dataset.value = val;
  elements.inputJoinDate.value = `${MONTH_NAMES_DE[parseInt(val.slice(5, 7), 10) - 1]} ${val.slice(0, 4)}`;
}

// Custom month picker (the native popup is unstylable and iOS shows its own wheel).
// Renders a small popover with year navigation + a 12-month grid, themed via CSS vars.
function initMonthPicker(input) {
  const wrap = input.closest('.month-field');
  if (!wrap) return;

  const pop = document.createElement('div');
  pop.className = 'month-pop';
  pop.style.display = 'none';
  wrap.appendChild(pop);

  const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  let viewYear = null;

  const limits = () => {
    const min = input.dataset.min || '1990-01';
    const max = new Date().toISOString().slice(0, 7); // purchases can't start in the future
    return {
      minY: parseInt(min.slice(0, 4)), minM: parseInt(min.slice(5, 7)),
      maxY: parseInt(max.slice(0, 4)), maxM: parseInt(max.slice(5, 7))
    };
  };

  const render = () => {
    const { minY, minM, maxY, maxM } = limits();
    const sel = input.dataset.value || '';
    const selY = sel ? parseInt(sel.slice(0, 4)) : null;
    const selM = sel ? parseInt(sel.slice(5, 7)) : null;
    if (viewYear === null) viewYear = selY || maxY;
    viewYear = Math.min(Math.max(viewYear, minY), maxY);

    let html = `
      <div class="month-pop-head">
        <span class="month-pop-navgroup">
          <button type="button" class="month-pop-nav" data-nav="-10" ${viewYear <= minY ? 'disabled' : ''} aria-label="10 Jahre zurück"><i class="fa-solid fa-angles-left"></i></button>
          <button type="button" class="month-pop-nav" data-nav="-1" ${viewYear <= minY ? 'disabled' : ''} aria-label="Vorheriges Jahr"><i class="fa-solid fa-chevron-left"></i></button>
        </span>
        <span class="month-pop-year">${viewYear}</span>
        <span class="month-pop-navgroup">
          <button type="button" class="month-pop-nav" data-nav="1" ${viewYear >= maxY ? 'disabled' : ''} aria-label="Nächstes Jahr"><i class="fa-solid fa-chevron-right"></i></button>
          <button type="button" class="month-pop-nav" data-nav="10" ${viewYear >= maxY ? 'disabled' : ''} aria-label="10 Jahre vor"><i class="fa-solid fa-angles-right"></i></button>
        </span>
      </div>
      <div class="month-pop-grid">`;
    for (let m = 1; m <= 12; m++) {
      const disabled = (viewYear === minY && m < minM) || (viewYear === maxY && m > maxM) || viewYear < minY || viewYear > maxY;
      const selected = viewYear === selY && m === selM;
      html += `<button type="button" class="month-pop-month${selected ? ' selected' : ''}" data-m="${m}" ${disabled ? 'disabled' : ''}>${MONTHS[m - 1]}</button>`;
    }
    html += '</div>';
    pop.innerHTML = html;
  };

  const open = () => {
    viewYear = null;
    render();
    pop.style.display = 'block';
    input.blur(); // avoid the native month-segment highlight while the popover is open
  };
  const close = () => { pop.style.display = 'none'; };
  const isOpen = () => pop.style.display !== 'none';

  input.addEventListener('click', (e) => { e.preventDefault(); isOpen() ? close() : open(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen() ? close() : open(); }
    if (e.key === 'Escape') close();
  });
  pop.addEventListener('click', (e) => {
    const nav = e.target.closest('.month-pop-nav');
    if (nav && !nav.disabled) { viewYear += parseInt(nav.dataset.nav); render(); return; }
    const mBtn = e.target.closest('.month-pop-month');
    if (mBtn && !mBtn.disabled) {
      setJoinDateValue(`${viewYear}-${String(mBtn.dataset.m).padStart(2, '0')}`);
      close();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  // Outside-close on pointerdown: the click-handler above re-renders the popover's DOM,
  // so by the time a click bubbles here its target may be detached (which would falsely
  // read as "outside"). pointerdown fires before any re-render.
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// Collapsible step cards, shared by the Rechner and Portfolio input panels.
// Open/closed states persist per tab in localStorage; `defaultOpen` overrides the
// DOM defaults when nothing is saved yet (e.g. collapse the import steps once
// portfolio data has been restored — returning users start at the results).
function initCollapsibleSteps(containerSelector, storageKey, defaultOpen = null) {
  const stepCards = document.querySelectorAll(`${containerSelector} .collapsible-step`);
  if (!stepCards.length) return;

  // The intended state lives in aria-expanded (set synchronously); the 'open'
  // class can lag behind it while the GSAP collapse animation finishes.
  const isOpen = (card) =>
    card.querySelector('.input-group-header')?.getAttribute('aria-expanded') === 'true';

  const applyOpen = (card, open, animate = false) => {
    const head = card.querySelector('.input-group-header');
    const body = card.querySelector('.input-group-body');
    if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!animate || !body) {
      card.classList.toggle('open', open);
      card.classList.remove('closing');
      return;
    }
    if (open) {
      card.classList.remove('closing');
      card.classList.add('open'); // CSS switches the body to display:block…
      gsapSlide(body, true);      // …then GSAP slides it in
    } else {
      card.classList.add('closing'); // rotates the chevron back right away (CSS)
      gsapSlide(body, false, { onDone: () => card.classList.remove('open', 'closing') });
    }
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey,
        JSON.stringify([...stepCards].map(isOpen)));
    } catch (e) { /* private mode */ }
  };

  // Normalise aria-expanded to the DOM defaults, then let saved/default
  // states override (all without animation — this runs on load).
  stepCards.forEach(card => applyOpen(card, card.classList.contains('open')));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (e) { /* corrupt entry */ }
  if (Array.isArray(saved)) {
    stepCards.forEach((card, i) => { if (typeof saved[i] === 'boolean') applyOpen(card, saved[i]); });
  } else if (Array.isArray(defaultOpen)) {
    stepCards.forEach((card, i) => { if (typeof defaultOpen[i] === 'boolean') applyOpen(card, defaultOpen[i]); });
  }

  stepCards.forEach(card => {
    const head = card.querySelector('.input-group-header');
    if (!head) return;
    const toggle = () => {
      applyOpen(card, !isOpen(card), true);
      save();
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

// Close every open value-token popover in the guided sentence.
function closeAllCalcPops() {
  document.querySelectorAll('.calc1c .tok-wrap.open').forEach(w => w.classList.remove('open'));
}

// Small trailing debounce used to avoid hammering the historical-price fetch while
// the year/month join sliders are being dragged.
function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function initCalculator() {
  const btnClearCalculator = document.getElementById('btnClearCalculator');
  if (btnClearCalculator) {
    btnClearCalculator.addEventListener('click', () => {
      localStorage.removeItem(LS_KEYS.calculatorState);
      window.location.reload();
    });
  }

  // First-visit hint under the sentence ("tap the values") — shown until the
  // user has opened a token popover once, then dismissed for good.
  const calcHint = document.getElementById('c1cHint');
  if (calcHint && !localStorage.getItem(LS_KEYS.calcHintSeen)) calcHint.style.display = '';
  const dismissCalcHint = () => {
    if (!calcHint || calcHint.style.display === 'none') return;
    calcHint.style.display = 'none';
    localStorage.setItem(LS_KEYS.calcHintSeen, '1');
  };

  // ---- Value-token popovers: click a token to open its slider/field popover.
  // Only one popover is open at a time; a mousedown anywhere outside closes it.
  document.querySelectorAll('.calc1c .c1c-tok').forEach(tok => {
    tok.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = tok.closest('.tok-wrap');
      const wasOpen = wrap.classList.contains('open');
      closeAllCalcPops();
      if (!wasOpen) wrap.classList.add('open');
      dismissCalcHint();
    });
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.tok-wrap')) closeAllCalcPops();
  });

  // ---- Couple a range slider with its number field (shared min/max, range canonical).
  const coupleRangeNumber = (rangeEl, numEl, onChange) => {
    if (!rangeEl || !numEl) return;
    const min = parseFloat(rangeEl.min), max = parseFloat(rangeEl.max);
    rangeEl.addEventListener('input', () => {
      numEl.value = rangeEl.value;
      if (onChange) onChange();
      calculateESPP();
    });
    numEl.addEventListener('input', () => {
      const v = parseFloat(numEl.value);
      if (!isFinite(v) || v < min) return; // apply only once a valid in-range number is typed
      rangeEl.value = Math.min(max, v);
      if (onChange) onChange();
      calculateESPP();
    });
    numEl.addEventListener('blur', () => { numEl.value = rangeEl.value; });
  };

  coupleRangeNumber(elements.inputMonthlySalary, elements.numSalary, () => { state.salaryProvided = true; });
  coupleRangeNumber(elements.inputSavingsRate, elements.numRate);
  coupleRangeNumber(elements.inputAccumulatedMonths, elements.numMonths);

  // Grenzsteuersatz slider — live value next to the label (classic: value chip).
  if (elements.inputTaxRate) {
    elements.inputTaxRate.addEventListener('input', (e) => {
      if (elements.valTaxRate) elements.valTaxRate.value = `${e.target.value} %`;
      calculateESPP();
    });
  }

  // Verkaufskurs: number field is canonical (calculateESPP reads inputSellPrice);
  // the 1c range slider just mirrors it within its 50–600 window.
  if (elements.inputSellPrice) {
    elements.inputSellPrice.addEventListener('input', () => {
      const v = parseFloat(elements.inputSellPrice.value);
      if (elements.rangeSell && isFinite(v)) {
        const lo = parseFloat(elements.rangeSell.min), hi = parseFloat(elements.rangeSell.max);
        elements.rangeSell.value = Math.min(hi, Math.max(lo, v));
      }
      calculateESPP();
    });
  }
  if (elements.rangeSell && elements.inputSellPrice) {
    elements.rangeSell.addEventListener('input', () => {
      elements.inputSellPrice.value = elements.rangeSell.value;
      calculateESPP();
    });
  }
  // "Auf Live-Kurs setzen" — snap the sell price to the current live IBM quote.
  const btnSellLive = document.getElementById('btnSellLive');
  if (btnSellLive) {
    btnSellLive.addEventListener('click', () => {
      const live = state.lastLiveUSD || state.usdPrice;
      if (live > 0) {
        elements.inputSellPrice.value = live.toFixed(2);
        if (elements.rangeSell) {
          const lo = parseFloat(elements.rangeSell.min), hi = parseFloat(elements.rangeSell.max);
          elements.rangeSell.value = Math.min(hi, Math.max(lo, live));
        }
        calculateESPP();
      }
    });
  }

  // Buy price + FX (settings panel) and the LIVE badges.
  elements.inputStockPrice.addEventListener('input', (e) => {
    state.usdPrice = parseFloat(e.target.value) || 0;
    state.eurPrice = state.usdPrice * state.exchangeRate;
    if (elements.valStockPriceEUR) elements.valStockPriceEUR.textContent = `${state.eurPrice.toFixed(2)} €`;
    calculateESPP();
  });
  if (elements.inputFX) {
    elements.inputFX.addEventListener('input', (e) => {
      const fx = parseFloat(e.target.value);
      if (isFinite(fx) && fx > 0) {
        state.exchangeRate = fx;
        state.eurPrice = state.usdPrice * state.exchangeRate;
        calculateESPP();
      }
    });
  }
  // Both LIVE controls pull the current quote + FX (force overwrites a custom buy price).
  if (elements.btnFetchStock) elements.btnFetchStock.addEventListener('click', () => fetchLiveStockPrice({ force: true }));
  const btnBuyLive = document.getElementById('btnBuyLive');
  if (btnBuyLive) btnBuyLive.addEventListener('click', () => fetchLiveStockPrice({ force: true }));

  // Tax-profile selects.
  elements.selectTaxYear.addEventListener('change', calculateESPP);
  elements.selectChurchTax.addEventListener('change', calculateESPP);
  elements.selectSoli.addEventListener('change', calculateESPP);
  elements.selectBroker.addEventListener('change', calculateESPP);

  // ---- Mode switch (Prognose ⇄ Historisch) via the text link in the subline.
  if (elements.selectCalcMode) {
    elements.selectCalcMode.addEventListener('change', () => {
      applyCalcModeUI();
      if (elements.selectCalcMode.value === 'historical') ensureHistoricalData();
      calculateESPP();
    });
  }
  const btnModeToggle = document.getElementById('btnModeToggle');
  if (btnModeToggle && elements.selectCalcMode) {
    btnModeToggle.addEventListener('click', () => {
      elements.selectCalcMode.value = elements.selectCalcMode.value === 'historical' ? 'forecast' : 'historical';
      elements.selectCalcMode.dispatchEvent(new Event('change'));
    });
  }

  // ---- ESPP join date (historical): two sliders write the 'YYYY-MM' machine value.
  const debouncedHist = debounce(() => ensureHistoricalData(), 400);
  const onJoinSlider = () => {
    const y = parseInt(elements.rangeJoinYear.value, 10);
    const m = parseInt(elements.rangeJoinMonth.value, 10);
    setJoinDateValue(`${y}-${String(m).padStart(2, '0')}`);
    const yl = document.getElementById('joinYearLabel');
    const ml = document.getElementById('joinMonthLabel');
    if (yl) yl.textContent = y;
    if (ml) ml.textContent = MONTH_NAMES_DE[m - 1];
    calculateESPP();       // instant feedback with the currently-loaded series
    debouncedHist();       // fetch the real series for the new range shortly after
  };
  if (elements.rangeJoinYear) elements.rangeJoinYear.addEventListener('input', onJoinSlider);
  if (elements.rangeJoinMonth) elements.rangeJoinMonth.addEventListener('input', onJoinSlider);
  setJoinDateValue(elements.inputJoinDate ? (elements.inputJoinDate.dataset.value || '2022-01') : '2022-01');

  // ---- Settings panel toggle ("anpassen" / "schließen").
  const btnSettingsToggle = document.getElementById('btnSettingsToggle');
  const settingsPanel = document.getElementById('c1cSettings');
  if (btnSettingsToggle && settingsPanel) {
    btnSettingsToggle.addEventListener('click', () => {
      const open = settingsPanel.style.display === 'none';
      btnSettingsToggle.textContent = open ? 'schließen' : 'anpassen';
      if (open) {
        settingsPanel.style.display = '';
        gsapSlide(settingsPanel, true);
      } else {
        gsapSlide(settingsPanel, false, { onDone: () => { settingsPanel.style.display = 'none'; } });
      }
    });
  }

  // ---- Breakdown details toggle.
  const btnDetails = document.getElementById('btnDetails');
  const detailsPanel = document.getElementById('calcDetails');
  if (btnDetails && detailsPanel) {
    btnDetails.addEventListener('click', () => {
      const open = detailsPanel.style.display === 'none';
      btnDetails.textContent = open ? 'Aufschlüsselung ausblenden' : 'Detaillierte Aufschlüsselung ansehen';
      if (open) {
        detailsPanel.style.display = '';
        gsapSlide(detailsPanel, true);
      } else {
        gsapSlide(detailsPanel, false, { onDone: () => { detailsPanel.style.display = 'none'; } });
      }
    });
  }

  // ---- Design switch (new 1c ⇄ classic chart-first): persist + reload, so the
  // inline stamping script in index.html swaps the markup before app.js re-inits.
  const btnDesignSwitch = document.getElementById('btnDesignSwitch');
  if (btnDesignSwitch) {
    const lbl = document.getElementById('designSwitchLabel');
    if (lbl) lbl.textContent = CALC_CLASSIC ? 'Neues Design' : 'Klassisches Design';
    btnDesignSwitch.addEventListener('click', () => {
      try { localStorage.setItem(LS_KEYS.calcDesign, CALC_CLASSIC ? 'modern' : 'classic'); } catch (e) { /* no storage */ }
      window.location.reload();
    });
  }

  // Classic design: its own controls (value chips, segmented mode toggle,
  // collapsible steps, month picker) — the 1c popover wiring above no-ops there.
  if (CALC_CLASSIC) initCalculatorClassicUI();

  // Load saved state if any, then run the first calculation.
  loadCalculatorState();
  applyCalcModeUI(); // sync the mode toggle + description on a fresh visit too
  calculateESPP();
}

// Wiring for the classic (pre-1c) Rechner design. Runs only when the classic
// markup is stamped, so element access here may assume the classic ids exist.
function initCalculatorClassicUI() {
  // "Zur Eingabe in Schritt 1" shortcuts (results empty state + the data notice): scroll
  // to step 1 and briefly highlight the upload zone instead of duplicating inputs elsewhere.
  const gotoStep1 = () => {
    const step1 = document.querySelector('#tab-calculator .group-stocks-savings');
    const uploadZone = document.getElementById('uploadZone');
    if (step1 && !step1.classList.contains('open')) {
      const header = step1.querySelector('.input-group-header');
      if (header) {
        header.click();
      } else {
        step1.classList.add('open');
      }
    }
    step1?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (uploadZone) {
      uploadZone.classList.remove('pulse-highlight');
      void uploadZone.offsetWidth; // restart the animation on repeated clicks
      uploadZone.classList.add('pulse-highlight');
      setTimeout(() => uploadZone.classList.remove('pulse-highlight'), 2400);
    }
  };
  document.querySelectorAll('.goto-step1').forEach(btn => btn.addEventListener('click', gotoStep1));

  // Collapsible step cards with persisted open/closed state.
  initCollapsibleSteps('#tab-calculator', 'espp_open_steps');

  // Sliders update their value chips live.
  elements.inputMonthlySalary.addEventListener('input', (e) => {
    state.salaryProvided = true; // user set a real salary
    elements.valMonthlySalary.value = `${parseInt(e.target.value).toLocaleString('de-DE')} €`;
    calculateESPP();
  });
  elements.inputSavingsRate.addEventListener('input', (e) => {
    elements.valSavingsRate.value = `${e.target.value} %`;
    calculateESPP();
  });
  elements.inputAccumulatedMonths.addEventListener('input', (e) => {
    elements.valAccumulatedMonths.value = formatMonthsLabel(parseInt(e.target.value));
    calculateESPP();
  });

  // Editable value chips: every slider value can also be typed directly.
  initEditableSliderChip(elements.valMonthlySalary, elements.inputMonthlySalary, {
    display: () => state.salaryProvided
      ? `${parseInt(elements.inputMonthlySalary.value).toLocaleString('de-DE')} €`
      : '', // empty → placeholder "eintippen" shows
    rawForEdit: () => state.salaryProvided ? String(parseInt(elements.inputMonthlySalary.value)) : '',
    onApply: () => { state.salaryProvided = true; }
  });
  initEditableSliderChip(elements.valSavingsRate, elements.inputSavingsRate, {
    display: () => `${parseInt(elements.inputSavingsRate.value)} %`
  });
  initEditableSliderChip(elements.valTaxRate, elements.inputTaxRate, {
    display: () => `${parseInt(elements.inputTaxRate.value)} %`
  });
  initEditableSliderChip(elements.valAccumulatedMonths, elements.inputAccumulatedMonths, {
    display: () => formatMonthsLabel(parseInt(elements.inputAccumulatedMonths.value))
  });
  fitAllSliderChips();
  // Re-measure once the webfont (Outfit) is in — fallback-font metrics differ slightly.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAllSliderChips);

  // Mode controls in the output panel (segmented toggle + scenario-strip switch link):
  // both just drive the Berechnungsmodus select so all existing wiring applies.
  const setCalcMode = (mode) => {
    if (!elements.selectCalcMode || elements.selectCalcMode.value === mode) return;
    elements.selectCalcMode.value = mode;
    elements.selectCalcMode.dispatchEvent(new Event('change'));
  };
  document.querySelectorAll('#calcModeToggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setCalcMode(btn.dataset.mode));
  });
  const scenarioSwitch = document.getElementById('scenarioSwitch');
  if (scenarioSwitch && elements.selectCalcMode) {
    scenarioSwitch.addEventListener('click', () => {
      setCalcMode(elements.selectCalcMode.value === 'historical' ? 'forecast' : 'historical');
    });
  }

  // Scenario chips jump to the control in step 3 that defines the clicked assumption.
  const scenarioChips = document.getElementById('scenarioChips');
  if (scenarioChips) {
    scenarioChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.scenario-chip');
      if (!chip || !chip.dataset.target) return;
      const step3 = document.querySelector('#tab-calculator .group-selling');
      if (step3 && !step3.classList.contains('open')) {
        const header = step3.querySelector('.input-group-header');
        if (header) header.click(); else step3.classList.add('open');
      }
      const target = document.getElementById(chip.dataset.target);
      const flashEl = target ? (target.closest('.form-group') || target) : step3;
      flashEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (flashEl) {
        flashEl.classList.remove('pulse-highlight');
        void flashEl.offsetWidth; // restart the animation on repeated clicks
        flashEl.classList.add('pulse-highlight');
        setTimeout(() => flashEl.classList.remove('pulse-highlight'), 2400);
      }
    });
  }

  // ESPP join date: custom month-picker popover on the readonly text input.
  if (elements.inputJoinDate) {
    elements.inputJoinDate.addEventListener('change', () => {
      ensureHistoricalData();
      calculateESPP();
    });
    initMonthPicker(elements.inputJoinDate);
  }
}


// Auto-size an editable slider chip to its text (measured in px), so it hugs
// its content exactly like a static value chip would.
function fitSliderChip(el) {
  if (!el || el.tagName !== 'INPUT') return;
  const text = el.value || el.placeholder || '';
  const cs = getComputedStyle(el);
  const ctx = fitSliderChip._ctx || (fitSliderChip._ctx = document.createElement('canvas').getContext('2d'));
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
                 parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  // Quantize to 6px steps: while the slider is dragged, tiny per-value width
  // differences would otherwise make the chip (and the row layout) jitter.
  el.style.width = `${Math.ceil((ctx.measureText(text).width + chrome + 2) / 6) * 6}px`;
}

function fitAllSliderChips() {
  ['valMonthlySalary', 'valSavingsRate', 'valTaxRate', 'valAccumulatedMonths', 'valStockGrowth']
    .forEach(id => fitSliderChip(document.getElementById(id)));
}

// "8 Monate" / "24 Monate (2 Jahre)" / "14 Monate (1J 2M)" — shared by the
// Haltedauer slider handler, the chip display and the state restore.
function formatMonthsLabel(months) {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths === 0
      ? `${months} Monate (${years} ${years === 1 ? 'Jahr' : 'Jahre'})`
      : `${months} Monate (${years}J ${remMonths}M)`;
  }
  return `${months} Monate`;
}

// Editable slider chips: each value chip is a text input — click and type, or drag
// the slider; both stay in sync. While focused the chip shows the bare number;
// Enter or blur restores the formatted label from the slider (the source of truth),
// which also discards incomplete entries and clamps out-of-range input.
function initEditableSliderChip(chipEl, sliderEl, { display, rawForEdit, onApply } = {}) {
  if (!chipEl || chipEl.tagName !== 'INPUT' || !sliderEl) return;
  const min = parseInt(sliderEl.min, 10) || 0;
  const max = parseInt(sliderEl.max, 10) || Infinity;

  chipEl.addEventListener('focus', () => {
    chipEl.value = rawForEdit ? rawForEdit() : String(parseInt(sliderEl.value, 10));
    fitSliderChip(chipEl);
    chipEl.select();
  });
  chipEl.addEventListener('input', () => {
    fitSliderChip(chipEl);
    const raw = parseInt(chipEl.value.replace(/[^\d]/g, ''), 10);
    // Apply only once the typed number reaches the slider minimum — clamping
    // mid-keystroke (the "3" of "35") would jump the results around.
    if (!isFinite(raw) || raw < min) return;
    sliderEl.value = Math.min(max, raw);
    if (onApply) onApply();
    calculateESPP();
  });
  chipEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); chipEl.blur(); }
  });
  chipEl.addEventListener('blur', () => {
    chipEl.value = display ? display() : String(parseInt(sliderEl.value, 10));
    fitSliderChip(chipEl);
  });
}

function calculateESPP() {
  const stockPriceUSD = state.usdPrice;
  const sellPriceUSD = parseFloat(elements.inputSellPrice.value) || stockPriceUSD;
  
  const monthlySalary = parseFloat(elements.inputMonthlySalary.value) || 5000;
  const savingsRate = parseFloat(elements.inputSavingsRate.value) || 10;
  const monthlyGrossContribution = monthlySalary * (savingsRate / 100);
  
  const baseTaxRate = (parseFloat(elements.inputTaxRate.value) || 35) / 100;
  const churchTaxRate = (parseFloat(elements.selectChurchTax.value) || 0) / 100;
  const soliRate = (parseFloat(elements.selectSoli.value) || 0) / 100;
  
  // Effective marginal tax rate takes into account church tax and soli as a percentage of the base tax
  const effectiveTaxRate = baseTaxRate * (1 + churchTaxRate + soliRate);
  
  const taxYear = elements.selectTaxYear.value;
  const broker = elements.selectBroker.value;
  const exchangeRate = state.exchangeRate;

  // Historical mode: simulate each monthly purchase at the REAL monthly average IBM price
  // and the USD/EUR rate of that month (series loaded by ensureHistoricalData).
  const calcMode = elements.selectCalcMode ? elements.selectCalcMode.value : 'forecast';
  const histMonths = (calcMode === 'historical' && histState.months && histState.months.length > 0)
    ? histState.months
    : null;

  let accumulatedMonths = histMonths
    ? histMonths.length
    : (parseInt(elements.inputAccumulatedMonths.value) || 12);

  // German employees purchase stock at 15% discount.
  // The monthly contribution is subtracted from Gross salary.
  // Discount is calculated on the market price.
  // If the gross contribution is X, the market value of shares bought is X / 0.85.
  // The discount benefit is (X / 0.85) - X = X * 0.15 / 0.85 = X * 17.65%.
  const monthlyMarketValueEUR = monthlyGrossContribution / 0.85;
  const monthlyDiscountBenefitEUR = monthlyMarketValueEUR - monthlyGrossContribution;

  // Total Accumulations (the EUR sums are price-independent: each month buys exactly
  // X/0.85 worth of stock, whatever the price happens to be)
  const totalGrossContribution = monthlyGrossContribution * accumulatedMonths;
  const totalMarketValueEUR = monthlyMarketValueEUR * accumulatedMonths;
  const totalDiscountBenefitEUR = monthlyDiscountBenefitEUR * accumulatedMonths;

  // Lohnabrechnung-Effekt: The net salary reduction is only gross * (1 - effectiveTaxRate)
  const totalNetContribution = totalGrossContribution * (1 - effectiveTaxRate);

  // Taxation on purchase (Geldwerter Vorteil):
  // Freibetrag § 3 Nr. 39 EStG: 2.000€ (ab 2024) or 1.440€ (bis 2023) per year.
  let purchaseTaxPaid;
  if (histMonths) {
    // Exact per-calendar-year check using the real purchase months.
    const monthsPerYear = {};
    histMonths.forEach(m => {
      const y = parseInt(m.month.slice(0, 4));
      monthsPerYear[y] = (monthsPerYear[y] || 0) + 1;
    });
    let taxableDiscount = 0;
    Object.keys(monthsPerYear).forEach(y => {
      const frei = (parseInt(y) <= 2023) ? 1440 : 2000;
      taxableDiscount += Math.max(0, monthsPerYear[y] * monthlyDiscountBenefitEUR - frei);
    });
    purchaseTaxPaid = taxableDiscount * effectiveTaxRate;
  } else {
    // The Freibetrag applies PER YEAR — model the months as consecutive 12-month
    // blocks and apply it per block. (Aggregating ceil(months/12) allowances let the
    // unused allowance of a short partial year wrongly offset another year's excess.)
    const annualFreibetrag = (taxYear === '2026' || taxYear === '2024') ? 2000 : 1440;
    let taxableDiscountBenefit = 0;
    for (let remaining = accumulatedMonths; remaining > 0; remaining -= 12) {
      const monthsThisYear = Math.min(12, remaining);
      taxableDiscountBenefit += Math.max(0, monthsThisYear * monthlyDiscountBenefitEUR - annualFreibetrag);
    }
    purchaseTaxPaid = taxableDiscountBenefit * effectiveTaxRate;
  }

  // Number of shares acquired
  let sharePriceUSD, sharePriceEUR, totalShares;
  if (histMonths) {
    // Each month buys X / (0.85 × price_EUR(m)) shares at that month's price and FX rate.
    totalShares = 0;
    let totalPurchaseValueUSD = 0;
    histMonths.forEach(m => {
      const priceEUR = m.priceUSD * m.fx;
      if (!(priceEUR > 0)) return;
      const shares = monthlyGrossContribution / (0.85 * priceEUR);
      totalShares += shares;
      totalPurchaseValueUSD += shares * m.priceUSD;
    });
    // Weighted average purchase price (display + per-share cost basis)
    sharePriceUSD = totalShares > 0 ? totalPurchaseValueUSD / totalShares : stockPriceUSD;
    sharePriceEUR = totalShares > 0 ? totalMarketValueEUR / totalShares : stockPriceUSD * exchangeRate;
  } else {
    sharePriceUSD = stockPriceUSD;
    sharePriceEUR = sharePriceUSD * exchangeRate;
    totalShares = totalMarketValueEUR / sharePriceEUR;
  }
  
  // Sale calculations
  const sellPriceEUR = sellPriceUSD * exchangeRate;
  const grossSaleRevenueEUR = totalShares * sellPriceEUR;
  
  // Cost basis for German Capital Gains (Abgeltungsteuer) is the undiscounted buying price
  const costBasisEUR = totalShares * sharePriceEUR;
  
  // Capital Gains
  const capitalGainsEUR = Math.max(0, grossSaleRevenueEUR - costBasisEUR);
  
  // Capital Gains tax: 25% Abgeltungsteuer + 5.5% Soli (of tax) = 26.375%.
  // If church tax is applicable to capital gains, it increases the total tax to 27.82% or 27.99%
  // Let's compute capital gains tax rate:
  // Base: 25%. Soli: 5.5% of tax (1.375%). Church tax: e.g. 9% of tax (2.25%).
  // Total rate with Soli + Church Tax = 25% * (1 + soliRate + churchTaxRate)
  // E.g. with 9% Church Tax and 5.5% Soli: 25% * 1.145 = 28.625%
  // Wait, in Germany, if church tax is paid on capital gains, the income tax itself is reduced (Sonderausgabenabzug).
  // The actual formula with church tax on capital gains:
  // Tax rate = (25 + Soli + ChurchTax) / (1 + ChurchTax)
  // We can simplify this to: 25% * (1 + Soli + Church Tax) or use the exact German tax reduction formula:
  // If church tax is 9%: (25% + 1.375% + 2.25%) / 1.09 = 26.275% (approx, wait, the standard rate is 27.996% in 9% states and 27.8186% in 8% states).
  // Yes! The exact rates are:
  // - 26.375% (no church tax)
  // - 27.8186% (8% church tax)
  // - 27.9951% (9% church tax)
  // Let's implement this standard calculation exactly!
  const abgeltungRate = getAbgeltungRate(churchTaxRate);

  let capGainsTaxRate = abgeltungRate;
  // Günstigerprüfung: If the personal effective marginal tax rate is lower than the flat-rate capital gains tax,
  // the taxpayer can opt to pay the personal rate instead.
  if (effectiveTaxRate < capGainsTaxRate) {
    capGainsTaxRate = effectiveTaxRate;
  }

  // Capital gains tax.
  // German broker "Steuer-Falle" (§ 43a Abs. 2 Satz 7 EStG): when shares are transferred to a
  // German Depot without a known cost basis, the bank withholds Abgeltungsteuer on the
  // Ersatzbemessungsgrundlage = 30% of the gross proceeds (at the full rate, no Günstigerprüfung).
  // For a typical modest gain that OVER-withholds vs. 26,375% on the real gain (the part that's
  // reclaimable via the Steuererklärung). But for a long, highly-appreciated holding the real gain
  // exceeds 30% of proceeds — and you still owe Abgeltungsteuer on the FULL real gain, so the 30%
  // base UNDER-withholds and the rest is due on your return. The amount you actually bear is the
  // higher of the two; modelling only the 30% base wrongly made the German Depot look cheapest for
  // big historical gains. Taking max() keeps it correctly never better than a known cost basis.
  let capitalGainsTaxPaid;
  if (broker === 'german') {
    const ersatzWithholding = grossSaleRevenueEUR * 0.30 * abgeltungRate; // what the bank keeps at sale
    const realGainTax = capitalGainsEUR * capGainsTaxRate;                // true final liability on the gain
    capitalGainsTaxPaid = Math.max(ersatzWithholding, realGainTax);
  } else {
    capitalGainsTaxPaid = capitalGainsEUR * capGainsTaxRate;
  }
  
  // Broker fees (single source: js/tax.js — shared with the Steuerreport).
  const brokerFeesEUR = computeBrokerFees(broker, grossSaleRevenueEUR, exchangeRate);

  // Net Cash returned to pocket
  const netCashReceived = grossSaleRevenueEUR - capitalGainsTaxPaid - brokerFeesEUR;
  
  // Net Profit: Cash returned minus the real net investment from paycheck and any taxes paid afterwards
  const totalEmployeeCost = totalNetContribution + purchaseTaxPaid;
  const netProfitEUR = netCashReceived - totalEmployeeCost;
  
  // Return percentages
  const netReturnOnNetCapital = totalEmployeeCost > 0 ? (netProfitEUR / totalEmployeeCost) * 100 : 0;

  // ===== Classic design: render the chart-first UI from the same economics.
  // The 1c setters further below are all id-guarded, so they no-op while the
  // classic markup is stamped (their target elements don't exist). =====
  if (CALC_CLASSIC) {
    renderClassicCalc({
      monthlySalary, savingsRate, monthlyGrossContribution, monthlyMarketValueEUR,
      effectiveTaxRate, baseTaxRate, soliRate, broker, exchangeRate, calcMode,
      histMonths, accumulatedMonths,
      totalGrossContribution, totalNetContribution, totalDiscountBenefitEUR, purchaseTaxPaid,
      totalShares, sharePriceUSD, sharePriceEUR, totalMarketValueEUR,
      sellPriceUSD, sellPriceEUR, grossSaleRevenueEUR, costBasisEUR, capitalGainsEUR,
      abgeltungRate, capGainsTaxRate, capitalGainsTaxPaid, brokerFeesEUR,
      netCashReceived, totalEmployeeCost, netProfitEUR, netReturnOnNetCapital
    });
  }

  // ===== Render the guided "1c" UI from the freshly computed economics =====
  const isHist = !!histMonths;
  const profitPos = netProfitEUR >= 0;

  // Formatting helpers (flow cards: whole €, breakdown: 2 decimals, de-DE)
  const NBSP = ' ';
  const eur0 = (v) => `${Math.round(v).toLocaleString('de-DE')}${NBSP}€`;
  const eur2 = (v) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NBSP}€`;
  const usd = (v) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const setIfBlur = (el, val) => { if (el && document.activeElement !== el) el.value = val; };

  const brokerNames = { captrader: 'CapTrader / IBKR', equateplus: 'EquatePlus / Computershare', german: 'Deutscher Broker' };
  const brokerName = brokerNames[broker] || broker;
  const churchPct = parseFloat(elements.selectChurchTax.value) || 0;

  // ---- Sync the input mirrors (number fields ⇄ sliders, FX field, tax %) ----
  setIfBlur(elements.numSalary, Math.round(monthlySalary));
  setIfBlur(elements.numRate, savingsRate);
  setIfBlur(elements.numMonths, accumulatedMonths);
  if (elements.rangeSell) {
    const lo = parseFloat(elements.rangeSell.min), hi = parseFloat(elements.rangeSell.max);
    elements.rangeSell.value = Math.min(hi, Math.max(lo, sellPriceUSD));
  }
  setIfBlur(elements.inputFX, exchangeRate.toFixed(4));
  setText('valTaxRatePct', `${Math.round(baseTaxRate * 100)}${NBSP}%`);

  // Historical join sliders + labels mirror the machine value.
  const joinVal = getJoinDateValue();
  const jY = parseInt(joinVal.slice(0, 4), 10), jM = parseInt(joinVal.slice(5, 7), 10);
  if (elements.rangeJoinYear && document.activeElement !== elements.rangeJoinYear) elements.rangeJoinYear.value = jY;
  if (elements.rangeJoinMonth && document.activeElement !== elements.rangeJoinMonth) elements.rangeJoinMonth.value = jM;
  setText('joinYearLabel', jY);
  setText('joinMonthLabel', MONTH_NAMES_DE[jM - 1]);

  // ---- Token labels in the guided sentence ----
  setHtml('tokSalary', `${Math.round(monthlySalary).toLocaleString('de-DE')}${NBSP}€`);
  setHtml('tokRate', `${savingsRate}${NBSP}%`);
  setHtml('tokMonths', `${accumulatedMonths}${NBSP}Monaten`);
  setHtml('tokSell', usd(sellPriceUSD));
  const monShort = MONTH_NAMES_DE[jM - 1].slice(0, 3);
  setHtml('tokJoin', `${monShort}.${NBSP}${jY}`);
  setText('tokShares', totalShares.toFixed(1).replace('.', ','));

  // ---- Sub-line summary + settings note ----
  const churchLabel = churchPct === 0 ? 'keine Kirche' : `Kirche ${churchPct}${NBSP}%`;
  const soliLabel = soliRate > 0 ? ` · Soli` : '';
  setHtml('taxSummary', `${Math.round(baseTaxRate * 100)}${NBSP}% · ${churchLabel}${soliLabel} · ${brokerName}`);
  setHtml('buyEurNote', `${eur2(state.usdPrice * exchangeRate)} je Aktie`);
  setHtml('rateMonthly', `= ${eur0(monthlyGrossContribution)} / Monat`);
  const live = state.lastLiveUSD || state.usdPrice;
  setText('sellLivePrice', usd(live));

  // ---- Money-flow cards ----
  const maxV = Math.max(totalEmployeeCost, totalMarketValueEUR, netCashReceived, 1);
  const barPct = (v) => `${Math.max(2, Math.min(100, (v / maxV) * 100)).toFixed(1)}%`;
  const setBar = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = barPct(v); };

  setText('f1Val', eur0(totalEmployeeCost));
  setHtml('f1Sub', `${eur0(totalGrossContribution)} vom Brutto — Dein Netto sinkt nur um ${eur0(totalNetContribution)}` +
    (purchaseTaxPaid > 0.005 ? ` · inkl. ${eur0(purchaseTaxPaid)} Lohnsteuer auf den Rabatt` : ''));
  setBar('f1Bar', totalEmployeeCost);

  setText('f2Val', eur0(totalMarketValueEUR));
  const sharesDe = totalShares.toFixed(2).replace('.', ',');
  setHtml('f2Sub', isHist
    ? `${sharesDe} Stk. zu echten Monatskursen (Ø ${usd(sharePriceUSD)})`
    : `${sharesDe} Stk. — 15${NBSP}% Rabatt + Kauf vom Brutto`);
  setBar('f2Bar', totalMarketValueEUR);

  setText('f3Val', eur0(netCashReceived));
  setHtml('f3Sub', `${eur0(grossSaleRevenueEUR)} Erlös − ${eur0(capitalGainsTaxPaid)} Steuer − ${eur0(brokerFeesEUR)} Gebühren`);
  setBar('f3Bar', netCashReceived);

  const profitCard = document.getElementById('flowProfit');
  if (profitCard) profitCard.classList.toggle('is-loss', !profitPos);
  setText('f4Label', profitPos ? 'Dein Gewinn' : 'Dein Verlust');
  setText('f4Val', `${profitPos ? '+' : '−'}${eur0(Math.abs(netProfitEUR))}`);
  setHtml('f4Sub', `${netReturnOnNetCapital >= 0 ? '+' : ''}${netReturnOnNetCapital.toFixed(0)}${NBSP}% auf Deinen Netto-Einsatz — nach allen Steuern & Gebühren`);
  setBar('f4Bar', Math.abs(netProfitEUR));

  // ---- Stats line: Sofort-Hebel · Break-even · Freibetrag ----
  const hebel = effectiveTaxRate < 1 ? ((1 / 0.85) / (1 - effectiveTaxRate) - 1) * 100 : 0;
  setText('statHebel', `+${hebel.toFixed(0)}${NBSP}%`);

  const netAt = (priceUSD) => {
    const grossEUR = totalShares * priceUSD * exchangeRate;
    const gainEUR = Math.max(0, grossEUR - costBasisEUR);
    const tax = broker === 'german'
      ? Math.max(grossEUR * 0.30 * abgeltungRate, gainEUR * capGainsTaxRate)
      : gainEUR * capGainsTaxRate;
    return grossEUR - tax - computeBrokerFees(broker, grossEUR, exchangeRate) - totalEmployeeCost;
  };
  let beStr = '';
  if (totalShares > 0 && exchangeRate > 0 && sellPriceUSD > 0) {
    let lo = 0, hi = Math.max(sellPriceUSD, costBasisEUR / (totalShares * exchangeRate)) * 4 + 100;
    if (netAt(hi) < 0) {
      beStr = 'Break-even: nicht erreichbar';
    } else {
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (netAt(mid) < 0) lo = mid; else hi = mid; }
      const be = hi;
      beStr = sellPriceUSD > be
        ? `Break-even bei ${usd(be)} — Kurs darf ${Math.round((1 - be / sellPriceUSD) * 100)}${NBSP}% fallen`
        : `Break-even erst bei ${usd(be)} — aktuell Verlustzone`;
    }
  }
  setText('statBE', beStr);

  const freiCap = isHist ? 2000 : ((taxYear === '2026' || taxYear === '2024') ? 2000 : 1440);
  const firstYearMonths = Math.min(12, accumulatedMonths);
  const firstYearDisc = firstYearMonths * monthlyDiscountBenefitEUR;
  const freiOver = firstYearDisc - freiCap;
  setText('statFrei', freiOver > 0
    ? `Freibetrag überschritten: Rabatt ${eur0(freiOver)} über ${eur0(freiCap)}/Jahr`
    : `Freibetrag genutzt: ${eur0(Math.min(firstYearDisc, freiCap))} von ${eur0(freiCap)}`);

  // ---- Detailed breakdown tables ----
  const sharesLabel = `${totalShares.toFixed(2).replace('.', ',')} Stk.`;
  setText('dCard1H', `1 · Kauf — ${accumulatedMonths} Monatskäufe`);
  setText('dGross', eur2(totalGrossContribution));
  setText('dNet', eur2(totalNetContribution));
  setText('dDisc', `+${eur2(totalDiscountBenefitEUR)}`);
  setText('dPurchTax', `−${eur2(purchaseTaxPaid)}`);
  setText('dShares', sharesLabel);
  setText('dBuyPriceLabel', isHist ? 'Ø Kaufkurs (gewichtet)' : 'Kaufkurs je Aktie');
  setText('dBuyPrice', `${eur2(sharePriceEUR)} (${usd(sharePriceUSD)})`);
  setText('dDiscPrice', eur2(sharePriceEUR * 0.85));

  setText('dCard2H', `2 · Verkauf & Steuern — ${brokerName}`);
  setHtml('dRevLabel', `Verkaufserlös (${sharesLabel} × ${usd(sellPriceUSD)})`);
  setText('dRevenue', eur2(grossSaleRevenueEUR));
  setText('dCost', eur2(costBasisEUR));
  setText('dGain', eur2(capitalGainsEUR));
  setText('dCapRate', `${(capGainsTaxRate * 100).toFixed(2).replace('.', ',')}${NBSP}%`);
  setText('dCapTax', `−${eur2(capitalGainsTaxPaid)}`);
  setText('dFees', `−${eur2(brokerFeesEUR)}`);
  setText('dNetCash', eur2(netCashReceived));
  const dProfitEl = document.getElementById('dProfit');
  if (dProfitEl) {
    dProfitEl.textContent = `${profitPos ? '+' : '−'}${eur2(Math.abs(netProfitEUR))}`;
    dProfitEl.classList.toggle('neg', !profitPos);
  }

  // ---- Situational info boxes ----
  const showBox = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };
  showBox('boxGuenstiger', effectiveTaxRate < abgeltungRate);
  showBox('boxGerman', broker === 'german');
  showBox('boxHist', isHist);

  // ---- Feed the goal tracker (hypothetical future shares) and persist state ----
  rechnerEconomics = {
    shares: totalShares,
    netProfitEUR,
    netCashReceived,
    sharePriceEUR,
    sellPriceEUR,
    monthlyGrossContribution,
    effectiveTaxRate,
    capGainsTaxRate,
    brokerFeesEUR,
    totalEmployeeCost,
    accumulatedMonths
  };
  updateGoalTracker();

  // Save calculator state to localStorage
  saveCalculatorState();
}

// ===== Classic (pre-1c) Rechner design: chart-first output panel. =====
// Faithful port of the original render tail of calculateESPP — donut + KPI banner,
// counter-animated breakdown rows, empty state, scenario strip and break-even tile.
// Runs only while the classic markup is stamped (see CALC_CLASSIC).
function renderClassicCalc({
  monthlySalary, savingsRate, monthlyGrossContribution, monthlyMarketValueEUR,
  effectiveTaxRate, baseTaxRate, soliRate, broker, exchangeRate, calcMode,
  histMonths, accumulatedMonths,
  totalGrossContribution, totalNetContribution, totalDiscountBenefitEUR, purchaseTaxPaid,
  totalShares, sharePriceUSD, sharePriceEUR, totalMarketValueEUR,
  sellPriceUSD, sellPriceEUR, grossSaleRevenueEUR, costBasisEUR, capitalGainsEUR,
  abgeltungRate, capGainsTaxRate, capitalGainsTaxPaid, brokerFeesEUR,
  netCashReceived, totalEmployeeCost, netProfitEUR, netReturnOnNetCapital
}) {
  // Show the German-broker 30% withholding warning only when that broker is selected.
  if (elements.germanBrokerNote) {
    elements.germanBrokerNote.style.display = broker === 'german' ? 'block' : 'none';
  }

  // Update Outputs in UI
  const isPlaceholder = !state.salaryProvided;

  // Slider drags fire many recalcs per second — counters shorten so they track the thumb.
  const nowTs = performance.now();
  state.rapidRecalc = nowTs - (state.lastCalcTs || 0) < 250;
  state.lastCalcTs = nowTs;

  // Color the banner figures: green return / default profit when positive, red when negative
  if (netProfitEUR >= 0) {
    elements.netProfitPercent.style.color = "var(--success)";
    elements.netProfitEuro.style.color = "";
  } else {
    elements.netProfitPercent.style.color = "#f87171";
    elements.netProfitEuro.style.color = "#f87171";
  }

  // One quick pulse when the profit flips sign — the color swap alone is easy to
  // miss, and this is the most decision-relevant state change in the tab.
  if (!isPlaceholder) {
    const profitPositive = netProfitEUR >= 0;
    if (state.lastProfitSign !== undefined && state.lastProfitSign !== profitPositive) {
      pulseElement(document.querySelector('#tab-calculator .chart-center'));
      pulseElement(document.querySelector('.calc-summary-banner .csb-item.primary'));
    }
    state.lastProfitSign = profitPositive;
  } else {
    state.lastProfitSign = undefined; // reset: the first real result must not pulse
  }

  // Update Outputs in UI (animated if not placeholder)
  if (!isPlaceholder) {
    const fmtEUR = (val) => `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    const fmtPercent = (val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

    animateNumberValue('netProfitEuro', netProfitEUR, fmtEUR);
    animateNumberValue('netInvestment', totalEmployeeCost, fmtEUR);
    animateNumberValue('netProfitPercent', netReturnOnNetCapital, fmtPercent);

    // Mirror the headline figures into the condensed sticky strip
    state.stickyKpisCalculator = {
      netProfitEUR,
      returnPct: netReturnOnNetCapital,
      investEUR: totalEmployeeCost,
      shares: totalShares,
      investLabel: 'Einsatz'
    };
    if (state.activeTab === 'calculator') applyStickyKpis('calculator');
  } else {
    elements.netProfitEuro.textContent = '–';
    elements.netProfitPercent.textContent = '–';
    elements.netInvestment.textContent = '–';
  }

  // Breakdown + sale-process rows: counter-animated, with a soft highlight pulse
  // on every row whose value actually changed (so slider input is traceable).
  const fmtEUR = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUSD = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRowEuro = (v) => `${fmtEUR(v)} €`;
  const setRow = (id, value, formatFn) => setBreakdownValue(id, value, formatFn, isPlaceholder);

  setRow('rowGrossContribution', totalGrossContribution, fmtRowEuro);
  setRow('rowNetContribution', totalNetContribution, fmtRowEuro);
  setRow('rowDiscountBenefit', totalDiscountBenefitEUR, fmtRowEuro);
  setRow('rowDiscountTax', purchaseTaxPaid, fmtRowEuro);
  setRow('rowCapitalGainsTax', capitalGainsTaxPaid, fmtRowEuro);
  setRow('rowFees', brokerFeesEUR, fmtRowEuro);

  // Update Sale Process Detail section
  const discountedPricePerShare = sharePriceEUR * 0.85;
  const discountedPricePerShareUSD = sharePriceUSD * 0.85; // avg purchase price in historical mode

  setRow('rowShareCount', totalShares, (v) => `${fmtEUR(v)} Stk.`);
  setRow('rowBuyPriceEUR', sharePriceEUR, fmtRowEuro);
  setRow('rowBuyPriceUSD', sharePriceUSD, (v) => `($${fmtUSD(v)})`);
  setRow('rowDiscountedPrice', discountedPricePerShare, fmtRowEuro);
  setRow('rowDiscountedPriceUSD', discountedPricePerShareUSD, (v) => `($${fmtUSD(v)})`);
  setRow('rowTotalMarketValue', totalMarketValueEUR, fmtRowEuro);
  setRow('rowSellPriceEUR', sellPriceEUR, fmtRowEuro);
  setRow('rowSellPriceUSD', sellPriceUSD, (v) => `($${fmtUSD(v)})`);
  setRow('rowGrossSaleRevenue', grossSaleRevenueEUR, fmtRowEuro);

  // Color the capital gains based on positive/negative
  setRow('rowCapitalGainsAmount', capitalGainsEUR, (v) => `${v > 0 ? '+' : ''}${fmtEUR(v)} €`);

  setRow('rowCapGainsTaxSale', capitalGainsTaxPaid, (v) => `${v > 0 ? '− ' : ''}${fmtEUR(v)} €`);
  setRow('rowDiscountTaxSale', purchaseTaxPaid, (v) => `${v > 0 ? '− ' : ''}${fmtEUR(v)} €`);
  setRow('rowBrokerFeesSale', brokerFeesEUR, (v) => `${v > 0 ? '− ' : ''}${fmtEUR(v)} €`);

  setRow('rowNetSaleProceeds', netCashReceived, fmtRowEuro);
  setRow('rowNetCostsSale', totalNetContribution, (v) => `− ${fmtEUR(v)} €`);
  setRow('rowDiscountTaxSale2', purchaseTaxPaid, (v) => `− ${fmtEUR(v)} €`);

  setRow('rowFinalNetProfit', netProfitEUR, fmtRowEuro);

  // Update dynamic months labels in breakdown
  document.querySelectorAll('.months-count').forEach(el => {
    el.textContent = accumulatedMonths;
  });

  // "Sofort-Hebel" tile: instant gain at purchase from the gross-salary effect + discount.
  elements.lblGross500.textContent = `${monthlyGrossContribution.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
  if (elements.lblTax35) elements.lblTax35.textContent = `${(effectiveTaxRate*100).toFixed(1)}%`;

  const monthlyNetDeduction = monthlyGrossContribution * (1 - effectiveTaxRate);
  elements.lblNet276.textContent = `${monthlyNetDeduction.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

  // Calculate instant profit margin: (Market Value - Net Deduction) / Net Deduction
  // Counter-animated like every other figure, so the tile glides with the sliders.
  const instantGain = ((monthlyMarketValueEUR - monthlyNetDeduction) / monthlyNetDeduction) * 100;
  animateNumberValue('lblInstantGain', instantGain, (v) => `+${v.toFixed(0)} %`);

  // Mirror the headline figure into the donut center and fill the summary-banner extras
  const chartCenterProfit = document.getElementById('chartCenterProfit');
  if (chartCenterProfit) {
    if (elements.netProfitEuro.style.color) {
      chartCenterProfit.style.color = elements.netProfitEuro.style.color;
    } else {
      chartCenterProfit.style.color = "";
    }
  }

  const bannerShares = document.getElementById('bannerShares');
  const bannerSharesSub = document.getElementById('bannerSharesSub');

  if (!isPlaceholder) {
    const fmtEUR2 = (val) => `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    const fmtShares = (val) => `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Stk.`;
    const fmtMarketVal = (val) => `Marktwert: ${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

    if (chartCenterProfit) {
      animateNumberValue('chartCenterProfit', netProfitEUR, fmtEUR2);
    }
    if (bannerShares) {
      animateNumberValue('bannerShares', totalShares, fmtShares);
    }
    if (bannerSharesSub) {
      animateNumberValue('bannerSharesSub', totalMarketValueEUR, fmtMarketVal);
    }
  } else {
    if (chartCenterProfit) chartCenterProfit.textContent = '–';
    if (bannerShares) bannerShares.textContent = '–';
    if (bannerSharesSub) bannerSharesSub.textContent = 'Warte auf Deine Daten…';
  }

  // Placeholder mode: until a real salary is set, show no computed numbers at all.
  // The banner stays hidden and the analysis panel shows an inviting empty state
  // that prompts for the salary (or a payslip upload).
  const calcEmptyState = document.getElementById('calcEmptyState');
  const calcResultsContent = document.getElementById('calcResultsContent');
  if (calcEmptyState && calcResultsContent) {
    const showResults = !isPlaceholder;
    if (showResults !== state.resultsShown) {
      state.resultsShown = showResults;
      if (showResults) {
        // The "it worked" moment: choreographed reveal instead of an abrupt swap
        revealCalcResults(calcEmptyState, calcResultsContent, netProfitEUR);
      } else {
        calcResultsContent.style.display = 'none';
        calcEmptyState.style.display = 'flex';
        if (!prefersReducedMotion()) {
          gsap.fromTo(calcEmptyState, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out', clearProps: 'opacity' });
        }
      }
    } else {
      calcEmptyState.style.display = showResults ? 'none' : 'flex';
      calcResultsContent.style.display = showResults ? 'block' : 'none';
    }
  }
  // The KPI banner carries no information in placeholder mode (four dashes) — hide it
  // entirely so a fresh visitor goes straight from the notice to step 1.
  const summaryBanner = document.querySelector('.calc-summary-banner');
  if (summaryBanner) {
    const wasHidden = summaryBanner.style.display === 'none';
    if (isPlaceholder) {
      summaryBanner.style.display = 'none';
      state.firstCalculationRevealDone = false;
      state.revealAnimationPlaying = false;
    } else {
      summaryBanner.style.display = '';
      const kpis = summaryBanner.querySelectorAll('.csb-item');
      if (kpis.length >= 4) {
        if (wasHidden || !state.firstCalculationRevealDone) {
          if (!state.revealAnimationPlaying && !prefersReducedMotion()) {
            state.revealAnimationPlaying = true;
            state.firstCalculationRevealDone = true;

            // Force clean initial state before launching GSAP staggered entrance
            gsap.killTweensOf(kpis);
            gsap.set(kpis, { opacity: 0, scale: 0.8, y: 30 });

            gsap.to(kpis, {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.65,
              stagger: 0.08,
              ease: "back.out(1.5)",
              clearProps: "all",
              onComplete: () => {
                state.revealAnimationPlaying = false;
              }
            });
          } else if (prefersReducedMotion()) {
            state.firstCalculationRevealDone = true;
          }
        }
      }
    }
    // The strip mirrors the banner: re-evaluate whenever the banner is toggled.
    updateStickySummaryVisibility();
  }
  if (isPlaceholder) {
    // Kill running counters to prevent conflicts
    gsap.killTweensOf(counterAnimations.get('netProfitEuro') || {});
    gsap.killTweensOf(counterAnimations.get('chartCenterProfit') || {});
    gsap.killTweensOf(counterAnimations.get('netInvestment') || {});
    gsap.killTweensOf(counterAnimations.get('netProfitPercent') || {});
    gsap.killTweensOf(counterAnimations.get('bannerShares') || {});
    gsap.killTweensOf(counterAnimations.get('bannerSharesSub') || {});

    elements.valMonthlySalary.value = ''; // placeholder "eintippen" shows instead
    elements.netProfitEuro.textContent = '–';
    elements.netProfitEuro.style.color = '';
    elements.netProfitPercent.textContent = '–';
    elements.netProfitPercent.style.color = '';
    elements.netInvestment.textContent = '–';
    if (bannerShares) bannerShares.textContent = '–';
    if (bannerSharesSub) bannerSharesSub.textContent = 'Warte auf Deine Daten…';

    state.stickyKpisCalculator = null;
    if (state.activeTab === 'calculator') applyStickyKpis('calculator');
  }

  // Live value summaries in the (collapsible) step headers
  const summaryStep1 = document.getElementById('summaryStep1');
  if (summaryStep1) {
    summaryStep1.textContent = state.salaryProvided
      ? `${monthlySalary.toLocaleString('de-DE')} € · ${savingsRate} % Sparquote`
      : 'Bitte Dein Gehalt einstellen';
  }
  const summaryStep2 = document.getElementById('summaryStep2');
  if (summaryStep2) {
    const churchPct = parseFloat(elements.selectChurchTax.value) || 0;
    summaryStep2.textContent = `${(baseTaxRate * 100).toFixed(0)} % ESt` +
      (churchPct ? ` · ${churchPct} % KiSt` : '') +
      (soliRate > 0 ? ' · Soli' : '');
  }
  const summaryStep3 = document.getElementById('summaryStep3');
  if (summaryStep3) {
    const brokerNames = { captrader: 'CapTrader/IBKR', equateplus: 'EquatePlus', german: 'Dt. Broker' };
    const buyLabel = histMonths ? `Ø $${sharePriceUSD.toFixed(0)}` : `$${sharePriceUSD.toFixed(0)}`;
    summaryStep3.textContent = `${buyLabel} → $${sellPriceUSD.toFixed(0)} · ${accumulatedMonths} Mon. · ${brokerNames[broker] || broker}`;
  }

  // Scenario context around the results: strip, KPI subtitle, sticky tag, explainer.
  updateScenarioUI({
    historical: calcMode === 'historical',
    histMonths,
    accumulatedMonths,
    sharePriceUSD,
    sellPriceUSD,
    isPlaceholder
  });

  // Break-even sell price: how far the price may fall before the net profit turns negative.
  updateBreakEven({
    isPlaceholder,
    totalShares,
    exchangeRate,
    costBasisEUR,
    broker,
    abgeltungRate,
    capGainsTaxRate,
    totalEmployeeCost,
    sellPriceUSD
  });

  // Draw or update Chart.js visualization (skipped while the results are hidden behind the
  // empty state — the chart is created on the first calculation with real data instead)
  if (!isPlaceholder) {
    updateChart(totalNetContribution, purchaseTaxPaid, capitalGainsTaxPaid + brokerFeesEUR, netProfitEUR);
  }

  fitAllSliderChips();
}

// Scenario-context UI in the output panel: names the assumptions that produce the
// numbers shown (Prognose simulation vs. real historical prices), so the headline
// "Netto-Gewinn" can't be mistaken for real data. Re-rendered on every recalc.
function updateScenarioUI({ historical, histMonths, accumulatedMonths, sharePriceUSD, sellPriceUSD, isPlaceholder }) {
  const strip = document.getElementById('scenarioStrip');
  if (!strip) return;

  const joinVal = getJoinDateValue(); // 'YYYY-MM'
  const joinLabel = `${joinVal.slice(5, 7)}/${joinVal.slice(0, 4)}`;
  const sellLabel = `$${sellPriceUSD.toFixed(0)}`;

  const chip = (icon, text, target) =>
    `<button type="button" class="scenario-chip"${target ? ` data-target="${target}"` : ' disabled'} ` +
    `title="In Schritt 3 anpassen"><i class="fa-solid ${icon}"></i>${text}</button>`;

  strip.classList.toggle('historical', historical);
  const label = document.getElementById('scenarioLabel');
  const chipsEl = document.getElementById('scenarioChips');
  const switchBtn = document.getElementById('scenarioSwitch');

  if (historical) {
    if (label) label.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Historische Berechnung – echte IBM-Kurse:';
    if (chipsEl) {
      chipsEl.innerHTML = histMonths
        ? chip('fa-calendar-check', `dabei seit ${joinLabel}`, 'inputJoinDate') +
          chip('fa-cart-shopping', `${accumulatedMonths} Monatskäufe · Ø $${sharePriceUSD.toFixed(0)}`, 'inputJoinDate') +
          chip('fa-money-bill-trend-up', `Verkauf zu ${sellLabel}`, 'inputSellPrice')
        : chip('fa-calendar-check', `dabei seit ${joinLabel}`, 'inputJoinDate') +
          chip('fa-hourglass-half', 'echte Kurse werden geladen…', null);
    }
    if (switchBtn) switchBtn.innerHTML = 'Eigene Annahmen? <i class="fa-solid fa-arrow-right"></i> Prognose-Modus';
  } else {
    if (label) label.innerHTML = '<i class="fa-solid fa-flask"></i> Prognose-Szenario – angenommene Werte:';
    if (chipsEl) {
      chipsEl.innerHTML =
        chip('fa-clock', `${accumulatedMonths} Monate sparen`, 'inputAccumulatedMonths') +
        chip('fa-cart-shopping', `Kauf zu $${sharePriceUSD.toFixed(0)}`, 'inputStockPrice') +
        chip('fa-money-bill-trend-up', `Verkauf zu ${sellLabel}`, 'inputSellPrice');
    }
    if (switchBtn) switchBtn.innerHTML = 'Echte Kurse? <i class="fa-solid fa-arrow-right"></i> Historisch-Modus';
  }

  // The headline KPI carries the same context in words.
  const netProfitSub = document.getElementById('netProfitSub');
  if (netProfitSub) {
    netProfitSub.textContent = historical
      ? `nach Steuern & Gebühren – echte Kaufkurse seit ${joinLabel}, Verkauf zu ${sellLabel}`
      : `nach Steuern & Gebühren – angenommener Verkauf zu ${sellLabel} nach ${accumulatedMonths} Monaten Sparen`;
  }

  // Micro-fade when the MODE flips — but never on plain recalcs: slider drags
  // re-render this strip many times per second.
  if (state.lastScenarioHistorical !== undefined && state.lastScenarioHistorical !== historical && !prefersReducedMotion()) {
    gsap.fromTo(strip, { opacity: 0.35, y: -6 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true, clearProps: 'opacity,transform' });
  }
  state.lastScenarioHistorical = historical;

  // Tiny mode tag in the condensed sticky KPI strip.
  const stickyTag = document.getElementById('stickyModeTag');
  if (stickyTag) {
    stickyTag.textContent = historical ? 'Historisch' : 'Prognose';
    stickyTag.classList.toggle('historical', historical);
  }

}

// Break-even Verkaufskurs: the USD sell price at which the net profit is exactly zero.
// Uses the same sale-side model as calculateESPP (Abgeltungsteuer with Günstigerprüfung,
// broker fees, German-broker Ersatzbemessungsgrundlage). The purchase side (net
// contribution + GwV tax = totalEmployeeCost) is fixed, and the net profit rises
// monotonically with the sell price, so a simple bisection finds the zero.
function updateBreakEven({ isPlaceholder, totalShares, exchangeRate, costBasisEUR, broker, abgeltungRate, capGainsTaxRate, totalEmployeeCost, sellPriceUSD }) {
  const note = document.getElementById('breakEvenNote');
  if (!note) return;
  if (isPlaceholder || !(totalShares > 0) || !(exchangeRate > 0) || !(sellPriceUSD > 0)) {
    note.style.display = 'none';
    state.lastBreakEvenInProfit = undefined; // reset: the next real result must not pulse
    return;
  }

  const netAt = (priceUSD) => {
    const grossEUR = totalShares * priceUSD * exchangeRate;
    const gainEUR = Math.max(0, grossEUR - costBasisEUR);
    const tax = broker === 'german'
      ? Math.max(grossEUR * 0.30 * abgeltungRate, gainEUR * capGainsTaxRate)
      : gainEUR * capGainsTaxRate;
    return grossEUR - tax - computeBrokerFees(broker, grossEUR, exchangeRate) - totalEmployeeCost;
  };

  // Bracket the zero: at $0 the net is negative (fees + paid-in capital), then it
  // only grows. If even a generous upper bound stays negative, hide the note.
  let lo = 0;
  let hi = Math.max(sellPriceUSD, costBasisEUR / (totalShares * exchangeRate)) * 4 + 100;
  if (netAt(hi) < 0) { note.style.display = 'none'; return; }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netAt(mid) < 0) lo = mid; else hi = mid;
  }
  const breakEvenUSD = hi;

  // Render into the "Sicherheitspuffer" KPI tile: one percentage + one short line.
  const fmtUSD = (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const inProfit = breakEvenUSD < sellPriceUSD;
  const diffPct = ((breakEvenUSD - sellPriceUSD) / sellPriceUSD) * 100;

  note.style.display = '';
  note.classList.toggle('negative', !inProfit);
  document.getElementById('beLabel').textContent = inProfit ? 'Sicherheitspuffer' : 'Bis zum Gewinn';

  // Pulse the tile when it flips between buffer and loss — mirrors the donut pulse.
  if (state.lastBreakEvenInProfit !== undefined && state.lastBreakEvenInProfit !== inProfit) {
    pulseElement(note);
  }
  state.lastBreakEvenInProfit = inProfit;

  const val = document.getElementById('beValue');
  animateNumberValue('beValue', Math.abs(diffPct), (v) => inProfit ? `${v.toFixed(0)} %` : `+${v.toFixed(0)} %`);
  val.classList.toggle('positive', inProfit);
  val.classList.toggle('negative', !inProfit);

  document.getElementById('beSub').textContent = inProfit
    ? `Verlust erst, wenn der Kurs unter ${fmtUSD(breakEvenUSD)} fällt`
    : `Gewinn erst ab einem Verkaufskurs von ${fmtUSD(breakEvenUSD)}`;
}

// Stacked horizontal bar above the breakdown — same data & order as the donut.
function updateCompositionBar(dataValues) {
  const segmentIds = ['compSavings', 'compTax', 'compFees', 'compProfit'];
  const total = dataValues.reduce((sum, v) => sum + v, 0);
  segmentIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.width = total > 0 ? `${(dataValues[i] / total) * 100}%` : '0%';
  });
}

// Donut chart of the classic output panel (net invest / taxes / fees / profit).
function updateChart(netInvest, payrollTax, sellCosts, netProfit) {
  const ctx = document.getElementById('profitChart').getContext('2d');

  const dataValues = [
    parseFloat(netInvest.toFixed(2)),
    parseFloat(payrollTax.toFixed(2)),
    parseFloat(sellCosts.toFixed(2)),
    parseFloat(Math.max(0, netProfit).toFixed(2))
  ];

  updateCompositionBar(dataValues);

  if (state.chart) {
    state.chart.data.datasets[0].data = dataValues;
    state.chart.update();
  } else {
    state.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Netto-Sparrate', 'Lohnsteuer (AKP GwV)', 'Gebühren & Abgeltungsteuer', 'Netto-Gewinn'],
        datasets: [{
          data: dataValues,
          backgroundColor: chartPalette(),
          borderColor: chartThemeColors().donutBorder,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false  // custom HTML legend is rendered under the donut (see .chart-legend)
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` ${context.label}: ${context.raw.toLocaleString('de-DE')} €`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

// Theme-dependent canvas colors for Chart.js (canvas can't resolve CSS variables).
// Charts are destroyed and re-created on theme toggle so these get re-read.
function chartThemeColors() {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    donutBorder: light ? '#ffffff' : '#10162e',
    grid: light ? 'rgba(15, 23, 42, 0.09)' : 'rgba(255, 255, 255, 0.05)',
    tick: light ? '#5b6573' : '#9ca3af',
    accentLine: light ? '#0891b2' : '#00f2fe',
    accentFill: light ? 'rgba(8, 145, 178, 0.06)' : 'rgba(0, 242, 254, 0.04)'
  };
}

// Donut/legend/composition palette from the CSS design system, so the canvas
// follows the active theme (charts are re-created on theme toggle).
function chartPalette() {
  const styles = getComputedStyle(document.documentElement);
  return ['--chart-savings', '--chart-tax', '--chart-fees', '--chart-profit']
    .map(name => styles.getPropertyValue(name).trim());
}

// 100% Client-Side PDF Upload and Extraction (Data Privacy Guaranteed)
function initPdfUploader() {
  const uploadZone = document.getElementById('uploadZone');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const uploadStatus = document.getElementById('uploadStatus');

  if (!uploadZone || !pdfFileInput) return;

  // Click to open file dialog
  uploadZone.addEventListener('click', () => pdfFileInput.click());

  // Drag & Drop events
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handlePdfFile(files[0]);
    }
  });

  // File dialog selection
  pdfFileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handlePdfFile(files[0]);
    }
  });

  async function handlePdfFile(file) {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      showStatus('<i class="fa-solid fa-circle-xmark"></i> Fehler: Bitte wähle eine PDF-Datei aus.', 'error');
      return;
    }

    showStatus('<i class="fa-solid fa-spinner fa-spin"></i> Analysiere Abrechnung lokal im Browser...', 'loading');

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const arrayBuffer = e.target.result;
        
        // Configure PDF.js worker
        if (typeof pdfjsLib === 'undefined') {
          throw new Error('PDF.js Bibliothek konnte nicht geladen werden.');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const strings = textContent.items.map(item => item.str);
          fullText += strings.join(' ') + '\n';
        }
        
        parsePayslipText(fullText);
      } catch (error) {
        console.error('PDF parsing error:', error);
        showStatus('<i class="fa-solid fa-triangle-exclamation"></i> Fehler beim Lesen der PDF: ' + error.message, 'error');
      }
    };
    reader.onerror = () => {
      showStatus('<i class="fa-solid fa-circle-xmark"></i> Fehler beim Einlesen der Datei.', 'error');
    };
    reader.readAsArrayBuffer(file);
  }

  function showStatus(html, type) {
    uploadStatus.innerHTML = html;
    uploadStatus.className = `upload-status-message ${type}`;
  }

  function parsePayslipText(text) {
    // 1. Gross Salary (Grundgehalt, code 1101)
    // Matches: "1101 Grundgehalt LSG 5.519,11"
    // A payslip can contain MULTIPLE Grundgehalt lines (all code 1101), e.g. when a
    // retroactive correction is split across several rows. We sum them all so the
    // Grundgehalt — and therefore the derived Grenzsteuersatz — reflects the full base.
    // A trailing "-" marks a negative (correction) amount and is subtracted.
    const salaryRegex = /(?:1101\s+)?Grundgehalt\s+(?:[A-Z\s#$/]+\s+)?([\d\.,]+)(-?)/gi;
    const salaryMatches = [...text.matchAll(salaryRegex)];
    
    // 2. AKP Gehaltsabzug (ESPP contribution, code 76Z2)
    // Matches: "76Z2 AKP Gehaltsabzug lauf L G 286,40-"
    const akpRegex = /76Z2\s+AKP\s+Gehaltsabzug\s+lauf\s+(?:[A-Z\s#$/]+\s+)?([\d\.,]+)-?/i;
    const akpMatch = text.match(akpRegex);
    
    // 3. Steuerklasse
    // Matches: "ST-Klasse/Fakt./Kinder 1/ /"
    const taxClassRegex = /ST-Klasse\/Fakt\.\/Kinder\s*(\d)/i;
    const taxClassMatch = text.match(taxClassRegex);
    
    // 4. Kirchensteuer
    // Matches: "Kirchensteuer -- /" or "Kirchensteuer RK /"
    const churchTaxRegex = /Kirchensteuer\s+(\S+)\s*\//i;
    const churchTaxMatch = text.match(churchTaxRegex);

    let extractedSalary = null;
    let baseSalary = null; // regular current-month base (first 1101 line) — used for the Sparquote
    let extractedSavingsRate = null;
    let extractedChurchTax = 0;
    let extractedTaxClass = 1;

    if (salaryMatches.length > 0) {
      // Total Grundgehalt = sum of all 1101 lines (incl. retroactive corrections).
      // Drives the displayed salary and the Grenzsteuersatz.
      extractedSalary = salaryMatches.reduce((sum, m) => {
        const value = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        if (isNaN(value)) return sum;
        return sum + (m[2] === '-' ? -value : value);
      }, 0);
      // The ESPP deduction (76Z2) is a percent of the regular monthly base only, not of
      // back-pay corrections. The first 1101 line is the current-month base, so the
      // Sparquote must be computed against it — NOT the summed total.
      const baseVal = parseFloat(salaryMatches[0][1].replace(/\./g, '').replace(',', '.'));
      baseSalary = isNaN(baseVal) ? null : baseVal;
    }

    if (akpMatch && baseSalary) {
      const akpStr = akpMatch[1].replace(/\./g, '').replace(',', '.');
      const akpValue = parseFloat(akpStr);
      // Sparquote = (AKP / regular monthly base) * 100
      // We subtract 0.3 before rounding to compensate for upward skew caused by variable/commission lag
      extractedSavingsRate = Math.round(((akpValue / baseSalary) * 100) - 0.3);
      // Bound between 1 and 10
      extractedSavingsRate = Math.max(1, Math.min(10, extractedSavingsRate));
    }

    if (taxClassMatch) {
      extractedTaxClass = parseInt(taxClassMatch[1]) || 1;
    }

    if (churchTaxMatch) {
      const ctCode = churchTaxMatch[1].trim().toUpperCase();
      if (ctCode === '--') {
        extractedChurchTax = 0;
      } else {
        // Standard in Germany is 9% (EV/RK), except BY and BW which are 8%.
        extractedChurchTax = 9;
      }
    }

    if (!extractedSalary) {
      showStatus('<i class="fa-solid fa-circle-exclamation"></i> Warnung: Grundgehalt konnte nicht identifiziert werden. Bitte prüfe das PDF-Format.', 'error');
      return;
    }

    // Apply values to inputs (the guided-sentence tokens + number mirrors are
    // refreshed by calculateESPP() below; the classic value chips are set here).
    state.salaryProvided = true; // real salary from the uploaded payslip
    elements.inputMonthlySalary.value = extractedSalary;
    if (elements.valMonthlySalary) elements.valMonthlySalary.value = `${parseInt(extractedSalary).toLocaleString('de-DE')} €`;

    if (extractedSavingsRate !== null) {
      elements.inputSavingsRate.value = extractedSavingsRate;
      if (elements.valSavingsRate) elements.valSavingsRate.value = `${extractedSavingsRate} %`;
    } else {
      elements.inputSavingsRate.value = 10;
      if (elements.valSavingsRate) elements.valSavingsRate.value = '10 %';
    }

    elements.selectChurchTax.value = extractedChurchTax.toString();

    // Detect tax year from specific headers in the payslip (robust against retroactive correction texts)
    let extractedYear = '2026'; // default fallback
    
    const statementYearMatch = text.match(/Entgeltabrechnung\s+für\s+[a-zA-ZäöüÄÖÜß]+\s+(20\d{2})/i);
    const datumYearMatch = text.match(/Datum\s+\d{2}\.\d{2}\.(20\d{2})/);
    
    let yearFound = null;
    if (statementYearMatch) {
      yearFound = parseInt(statementYearMatch[1]);
    } else if (datumYearMatch) {
      yearFound = parseInt(datumYearMatch[1]);
    }
    
    if (yearFound) {
      if (yearFound <= 2023) {
        extractedYear = '2023';
      } else if (yearFound === 2024 || yearFound === 2025) {
        extractedYear = '2024';
      } else if (yearFound >= 2026) {
        extractedYear = '2026';
      }
    } else {
      // Fallback simple search starting with the most recent year to prevent false positives for older years
      if (text.includes('2026')) {
        extractedYear = '2026';
      } else if (text.includes('2025') || text.includes('2024')) {
        extractedYear = '2024';
      } else if (text.includes('2023')) {
        extractedYear = '2023';
      }
    }
    elements.selectTaxYear.value = extractedYear;

    // Estimate marginal tax rate based on German linear tax progression formula
    const estimatedMarginalRate = estimateGrenzsteuersatz(extractedSalary, extractedTaxClass, elements.selectTaxYear.value);
    elements.inputTaxRate.value = estimatedMarginalRate;
    if (elements.valTaxRate) elements.valTaxRate.value = `${estimatedMarginalRate} %`;

    // Recalculate everything
    calculateESPP();

    let successMsg = `<strong><i class="fa-solid fa-circle-check"></i> Daten erfolgreich aus PDF importiert!</strong>`;
      
    showStatus(successMsg, 'success');
    saveCalculatorState();
  }

  // estimateGrenzsteuersatz is imported from ./js/tax.js (called above with the tax year).
}

// Goal Tracker Logic
function initPorscheTracker() {
  if (elements.inputStockGrowth) {
    elements.inputStockGrowth.addEventListener('input', (e) => {
      elements.valStockGrowth.value = `${e.target.value} %`;
      calculateESPP();
    });
    initEditableSliderChip(elements.valStockGrowth, elements.inputStockGrowth, {
      display: () => `${parseInt(elements.inputStockGrowth.value)} %`
    });
  }

  document.querySelectorAll('.jump-to-porsche').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabBtn = document.querySelector('.nav-tab[data-tab="porsche"]');
      if (tabBtn) tabBtn.click();
    });
  });

  // ----- Goal inputs -----
  if (elements.btnLoadGoal) elements.btnLoadGoal.addEventListener('click', loadGoalFromUrl);
  if (elements.goalName) {
    elements.goalName.addEventListener('input', () => {
      state.goal.name = elements.goalName.value;
      saveGoal();
      renderGoal();
      updateGoalTracker();
    });
    // Enter fetches price & image for whatever is in the field (link or search term),
    // same as clicking "Preis & Bild laden".
    elements.goalName.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      loadGoalFromUrl();
    });
  }
  if (elements.goalPrice) {
    elements.goalPrice.addEventListener('focus', () => {
      const g = state.goal || {};
      if (g.price > 0) {
        elements.goalPrice.value = g.price.toString();
      }
    });
    elements.goalPrice.addEventListener('blur', () => {
      renderGoal();
    });
    elements.goalPrice.addEventListener('input', () => {
      state.goal.price = parseGermanNumber(elements.goalPrice.value) || 0;
      saveGoal();
      const btnClearGoal = document.getElementById('btnClearGoal');
      if (btnClearGoal) {
        const hasGoal = state.goal.price > 0 || (state.goal.name && state.goal.name.trim() !== '');
        btnClearGoal.style.display = hasGoal ? 'block' : 'none';
      }
      calculateESPP();
    });
  }

  const btnClearGoal = document.getElementById('btnClearGoal');
  if (btnClearGoal) {
    btnClearGoal.addEventListener('click', () => {
      localStorage.removeItem(GOAL_LS_KEY);
      window.location.reload();
    });
  }

  // Restore a previously saved goal (persisted across reloads).
  try {
    const saved = localStorage.getItem(GOAL_LS_KEY);
    if (saved) {
      const g = JSON.parse(saved);
      if (g && typeof g.price !== 'undefined') {
        state.goal = { name: g.name || '', image: g.image || null, price: g.price, url: g.url || null };
      }
    }
  } catch (e) { /* ignore */ }
  renderGoal();
  updateGoalTracker();
}

const GOAL_LS_KEY = LS_KEYS.goal;

function goalBadgeText(name) {
  if (!name) return 'Ziel';
  return name.length > 22 ? name.slice(0, 22) + '…' : name;
}

function saveGoal() {
  try { localStorage.setItem(GOAL_LS_KEY, JSON.stringify(state.goal)); } catch (e) { /* ignore */ }
}

function showGoalStatus(html, type) {
  if (!elements.goalStatus) return;
  elements.goalStatus.className = 'goal-status' + (type ? ' ' + type : '');
  elements.goalStatus.innerHTML = html;
}

// Sync the goal inputs / badge / image to state.goal.
function renderGoal() {
  const g = state.goal || {};
  if (elements.goalBadge) elements.goalBadge.textContent = goalBadgeText(g.name);
  if (elements.goalName && document.activeElement !== elements.goalName) elements.goalName.value = g.name || '';
  if (elements.goalPrice && document.activeElement !== elements.goalPrice) {
    // Format the price nicely in German format (e.g. 50.000) when not editing.
    elements.goalPrice.value = (g.price > 0) ? Number(g.price).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '';
  }
  // Photo card: only when a fetched goal has a real product image. Manual goals
  // show no card — the name lives in the field, the numbers on the right.
  if (elements.goalImageWrap && elements.goalImage) {
    const wrap = elements.goalImageWrap;
    const wasHidden = wrap.style.display === 'none';
    if (g.image) {
      elements.goalImage.src = g.image;
      wrap.style.setProperty('--goal-img', `url("${String(g.image).replace(/"/g, '%22')}")`); // blurred backdrop
      wrap.style.display = '';
      if (wasHidden) popGoalPreview();
    } else {
      elements.goalImage.removeAttribute('src');
      wrap.style.removeProperty('--goal-img');
      wrap.style.display = 'none';
    }
  }
  if (elements.goalLink) {
    if (g.url) { elements.goalLink.href = g.url; elements.goalLink.style.display = ''; }
    else { elements.goalLink.style.display = 'none'; }
  }

  const btnClearGoal = document.getElementById('btnClearGoal');
  if (btnClearGoal) {
    const hasGoal = g.price > 0 || (g.name && g.name.trim() !== '');
    btnClearGoal.style.display = hasGoal ? 'block' : 'none';
  }
}

function setCustomGoal(goal) {
  state.goal = { name: goal.name, image: goal.image, price: goal.price, url: goal.url };
  saveGoal();
  renderGoal();
  calculateESPP();
}

// "It worked" moment: pop the goal preview card when it appears or its content
// is replaced by a freshly fetched product.
function popGoalPreview() {
  const wrap = elements.goalImageWrap;
  if (!wrap || wrap.style.display === 'none' || prefersReducedMotion()) return;
  gsap.fromTo(wrap,
    { opacity: 0, scale: 0.94, y: 12 },
    { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)', overwrite: true, clearProps: 'opacity,scale,y' }
  );
}

// Enrich the goal from the unified #goalName field: a pasted link (any shop) →
// /api/product, free text → /api/resolve-goal (SearXNG finds product, price, image).
async function loadGoalFromUrl() {
  const input = (elements.goalName && elements.goalName.value || '').trim();
  if (!input) { showGoalStatus('Bitte gib zuerst Dein Ziel ein – Name, Suchbegriff oder Produktlink.', 'error'); return; }

  const isUrl = /^https?:\/\//i.test(input);
  showGoalStatus(`<span class="loading-spinner"></span> ${isUrl ? 'Lade Produktdaten…' : 'Suche Dein Ziel…'}`, 'loading');

  try {
    const data = await (isUrl ? api.fetchProduct(input) : api.fetchResolveGoal(input));

    if (!data || (!data.title && !data.price && !data.image)) {
      showGoalStatus(data && data.message
        ? escapeHtml(data.message)
        : (data && data.blocked ? 'Die Seite hat die Anfrage blockiert. Bitte Preis manuell eintragen.' : 'Konnte keine Produktdaten finden.'), 'error');
      return;
    }

    // Convert to EUR (the tracker works in EUR). EUR + backend-normalized exotic currencies
    // arrive as 'EUR'; only USD/GBP still need converting here.
    let priceEUR = data.price || 0;
    if (data.currency === 'USD') priceEUR *= (state.exchangeRate || FX.USD_EUR_FALLBACK);
    else if (data.currency === 'GBP') priceEUR *= FX.GBP_EUR;

    setCustomGoal({
      name: data.title || input,
      image: data.image || null,
      price: priceEUR ? Math.round(priceEUR * 100) / 100 : 0,
      url: isUrl ? input : (data.sourceUrl || null)
    });
    popGoalPreview(); // celebrate the fetched product even if the card was already visible

    const nm = (data.title || input);
    // Escape: nm/data.* originate from scraped, attacker-influenceable pages and are
    // interpolated into innerHTML by showGoalStatus.
    const short = escapeHtml(nm.length > 45 ? nm.slice(0, 45) + '…' : nm);
    const fxNote = data.originalCurrency ? ` (umgerechnet aus ${escapeHtml(data.originalCurrency)})` : '';
    if (!data.price) {
      showGoalStatus(`Ziel „${short}“ geladen, aber Preis nicht gefunden – bitte als Zielbetrag eintragen.`, 'warning');
    } else if (data.currency && data.currency !== 'EUR' && data.currency !== 'USD' && data.currency !== 'GBP') {
      showGoalStatus(`Ziel „${short}“ geladen – Preis in ${escapeHtml(data.currency)}, bitte prüfen.`, 'warning');
    } else {
      showGoalStatus(`✓ Ziel geladen: ${short}${fxNote}`, 'success');
    }
  } catch (e) {
    showGoalStatus('Fehler beim Laden. Läuft der Server (und ist SearXNG erreichbar)?', 'error');
  }
}

// parseGermanNumber is imported from ./js/format.js

// The tracker's target amount = the user's goal price.
function getTargetPrice() {
  return parseGermanNumber(elements.goalPrice && elements.goalPrice.value) || (state.goal && state.goal.price) || 0;
}

// Rechner economics for the goal tracker's future projection (set by calculateESPP).
let rechnerEconomics = null;

// Min (fractional) number of held shares to sell so the net cashout covers the goal.
function solveSharesToSell(heldLots, goalPrice, priceUSD, broker) {
  const total = heldLots.reduce((s, l) => s + (l.remainingQuantity ?? l.quantity), 0);
  if (total <= 0 || simulateSale(heldLots, total, priceUSD, broker).cashoutEUR < goalPrice) return total;
  let lo = 0, hi = total;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (simulateSale(heldLots, mid, priceUSD, broker).cashoutEUR >= goalPrice) hi = mid; else lo = mid;
  }
  return hi;
}

// Goal tracker. Prefers the REAL portfolio holdings (from the Portfolio-Analyse tab) and shows how
// many of YOUR shares to sell to afford the goal. Falls back to the Rechner's hypothetical model
// when no statements have been uploaded.
// Radial ring + center percentage driven by ONE shared GSAP value, so the number
// never runs ahead of (or behind) the sweep.
const radialAnim = { p: 0 };
function setRadialProgress(percent) {
  const fill = elements.porscheRadialFill;
  const label = elements.porscheRadialPercent;
  if (!fill || !label) return;
  const circ = 2 * Math.PI * 42;
  const fmt = (p) => ((p > 0 && p < 10) ? p.toFixed(1) : Math.round(p)) + '%';
  if (prefersReducedMotion()) {
    radialAnim.p = percent;
    fill.style.strokeDashoffset = circ - (percent / 100) * circ;
    label.textContent = fmt(percent);
    return;
  }
  gsap.to(radialAnim, {
    p: percent,
    duration: state.rapidRecalc ? 0.18 : 0.8,
    ease: 'power2.out',
    overwrite: true,
    onUpdate: () => {
      fill.style.strokeDashoffset = circ - (radialAnim.p / 100) * circ;
      label.textContent = fmt(radialAnim.p);
    }
  });
}

// Confetti over the radial widget the first time the goal flips to "Jetzt leistbar!".
function celebrateGoalReached() {
  if (state.goalCelebrated || prefersReducedMotion()) return;
  try {
    if (sessionStorage.getItem('espp_goal_celebrated')) { state.goalCelebrated = true; return; }
    sessionStorage.setItem('espp_goal_celebrated', '1');
  } catch (e) { /* private mode: in-memory flag below still guards */ }
  state.goalCelebrated = true;
  state.goalCelebrationPending = false;
  const widget = document.querySelector('#tab-porsche .radial-progress-widget');
  if (widget) confettiBurst(widget);
}

// Subtle stagger of the result cards each time the tab is entered (skipped while
// the empty state is showing — there is nothing to stagger then).
function animateGoalCardsIn() {
  if (prefersReducedMotion()) return;
  const content = document.getElementById('goalTrackerContent');
  if (!content || content.style.display === 'none') return;
  gsap.fromTo(content.querySelectorAll('.porsche-card'),
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out', overwrite: true, clearProps: 'opacity,transform' }
  );
}

function updateGoalTracker() {
  if (!rechnerEconomics || !elements.inputStockGrowth) return;
  const e = rechnerEconomics;
  const targetPrice = getTargetPrice();

  // Show the tracker if a price is set OR if a goal name is manually entered.
  const goalEmptyState = document.getElementById('goalEmptyState');
  const goalTrackerContent = document.getElementById('goalTrackerContent');
  if (goalEmptyState && goalTrackerContent) {
    const goalSet = targetPrice > 0 || (state.goal && state.goal.name && state.goal.name.trim() !== '');
    goalEmptyState.style.display = goalSet ? 'none' : 'block';
    goalTrackerContent.style.display = goalSet ? '' : 'none';
    if (!goalSet) return;
  }

  const growthRate = parseFloat(elements.inputStockGrowth.value) || 7;
  const r = (growthRate / 100) / 12;

  const heldLots = portfolioState.heldLots || [];
  const usePortfolio = heldLots.length > 0 && (portfolioState.totalCombinedShares || 0) > 0;

  let currentShares, currentValueNet, costBasisPerShareEUR, currentPriceEUR, sharesPerMonth, outOfPocketNow;
  let capRate = e.capGainsTaxRate;
  let brokerFee = e.brokerFeesEUR;
  let sharesText, sharesSubtitle, sharesLabel = 'Zu verkaufende IBM Aktien';

  if (usePortfolio) {
    // ---- REAL holdings ----
    const priceUSD = portfolioState.currentPrice;
    const rate = portfolioState.exchangeRate;
    currentPriceEUR = priceUSD * rate;
    currentShares = portfolioState.totalCombinedShares;
    const all = simulateSale(heldLots, currentShares, priceUSD, 'broker-c');
    currentValueNet = all.cashoutEUR;                 // net cash from selling ALL holdings now
    brokerFee = all.totalFeesEUR || 4;
    outOfPocketNow = all.totalCashCostEUR;            // what you actually paid for them
    const taxBasisUSD = heldLots.reduce((s, l) => s + (l.remainingQuantity ?? l.quantity) * l.fmvUSD, 0);
    costBasisPerShareEUR = currentShares > 0 ? (taxBasisUSD / currentShares) * rate : currentPriceEUR;
    sharesPerMonth = currentPriceEUR > 0 ? (e.monthlyGrossContribution / 0.85) / currentPriceEUR : 0;

    if (targetPrice > 0 && currentValueNet >= targetPrice) {
      const n = solveSharesToSell(heldLots, targetPrice, priceUSD, 'broker-c');
      sharesText = `${(Math.ceil(n * 100) / 100).toLocaleString('de-DE')} von ${currentShares.toFixed(2)}`;
      sharesSubtitle = 'Aktien aus Deinem Bestand verkaufen';
    } else {
      // Goal exceeds what your current holdings would net. Show how many MORE shares are
      // needed at today's price.
      const deficitEUR = Math.max(0, targetPrice - currentValueNet);
      const moreShares = currentPriceEUR > 0 ? deficitEUR / currentPriceEUR : 0;
      sharesLabel = 'Zusätzlich nötige Aktien';
      sharesText = `+${moreShares.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Aktien`;
      sharesSubtitle = `Du hast ${currentShares.toFixed(2)} (netto ${currentValueNet.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €) – es fehlen ${deficitEUR.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
    }
  } else {
    // ---- Rechner hypothetical fallback ----
    currentPriceEUR = e.sharePriceEUR;
    currentShares = e.shares;
    // Same semantics as the portfolio path: net cash if everything were sold now
    // (NOT the net profit — progress toward the goal is funded by the full proceeds).
    currentValueNet = e.netCashReceived;
    costBasisPerShareEUR = e.sharePriceEUR;
    outOfPocketNow = e.totalEmployeeCost;
    sharesPerMonth = currentPriceEUR > 0 ? (e.monthlyGrossContribution / 0.85) / currentPriceEUR : 0;
    const gainPerShare = Math.max(0, e.sellPriceEUR - e.sharePriceEUR);
    const netPerShare = e.sellPriceEUR - gainPerShare * capRate;
    const n = netPerShare > 0 ? (targetPrice + brokerFee) / netPerShare : 0;
    sharesText = n > 0 ? `${Math.ceil(n).toLocaleString('de-DE')} Aktien` : '–';
    sharesSubtitle = 'hypothetisch – lade Statements für echte Zahlen';
  }

  const fmtEUR2 = (v) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const fmtEUR0 = (v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

  // Guard for name-only goals (price not set yet)
  if (targetPrice <= 0) {
    if (elements.porscheProgressBadge) elements.porscheProgressBadge.textContent = 'Warte auf Zielbetrag';
    setRadialProgress(0);
    if (elements.porscheCurrentSavedLabel) elements.porscheCurrentSavedLabel.textContent = usePortfolio ? 'Netto-Verkaufswert Deiner Aktien' : 'Erwarteter Netto-Verkaufswert (Rechner)';
    animateNumberValue('porscheCurrentSaved', currentValueNet, fmtEUR2);
    if (elements.porscheRemainingAmount) elements.porscheRemainingAmount.textContent = '–';

    if (elements.porscheTimeNeeded) elements.porscheTimeNeeded.textContent = 'Bitte Zielbetrag eingeben';
    if (elements.porscheTargetDate) elements.porscheTargetDate.textContent = 'Berechnung ausstehend';

    if (elements.porscheSharesLabel) elements.porscheSharesLabel.textContent = 'Zu verkaufende IBM Aktien';
    if (elements.porscheSharesNeeded) elements.porscheSharesNeeded.textContent = '–';
    if (elements.porscheSharesSubtitle) elements.porscheSharesSubtitle.textContent = 'Bitte Zielbetrag eingeben';

    if (elements.porscheOutPocket) elements.porscheOutPocket.textContent = '–';
    if (elements.porscheLeverageAmount) elements.porscheLeverageAmount.textContent = '–';
    if (elements.porscheLeveragePercent) elements.porscheLeveragePercent.textContent = '–';

    updatePorscheGrowthChart(
      0, currentShares, costBasisPerShareEUR, currentPriceEUR,
      e.monthlyGrossContribution, e.effectiveTaxRate, capRate, brokerFee,
      growthRate, 0, outOfPocketNow
    );
    return;
  }

  // ---- Progress ----
  const progressPercent = Math.max(0, Math.min(100, (currentValueNet / targetPrice) * 100));
  animateNumberValue('porscheProgressBadge', progressPercent, (p) => `${p.toFixed(1)}% Erreicht`);
  setRadialProgress(progressPercent);
  if (elements.porscheCurrentSavedLabel) elements.porscheCurrentSavedLabel.textContent = usePortfolio ? 'Netto-Verkaufswert Deiner Aktien' : 'Erwarteter Netto-Verkaufswert (Rechner)';
  animateNumberValue('porscheCurrentSaved', currentValueNet, fmtEUR2);
  animateNumberValue('porscheRemainingAmount', Math.max(0, targetPrice - currentValueNet), fmtEUR2);

  // ---- Time-to-goal: accumulate ESPP shares until the net sellable value covers the goal ----
  let monthsNeeded = 0;
  let achieved = currentValueNet >= targetPrice;
  if (!achieved) {
    for (let t = 1; t <= 1200; t++) {
      const shares = currentShares + t * sharesPerMonth;
      const grossEUR = shares * currentPriceEUR * Math.pow(1 + r, t);
      const gainEUR = Math.max(0, grossEUR - shares * costBasisPerShareEUR);
      const cashout = grossEUR - gainEUR * capRate - brokerFee;
      if (cashout >= targetPrice) { achieved = true; monthsNeeded = t; break; }
    }
  }

  // The "made it" moment: confetti over the radial, once per session. If the tab
  // isn't visible right now, remember it and fire on the next tab entry.
  if (achieved && monthsNeeded === 0 && !state.goalCelebrated) {
    if (state.activeTab === 'porsche') celebrateGoalReached();
    else state.goalCelebrationPending = true;
  }

  if (elements.porscheTimeNeeded) {
    if (achieved && monthsNeeded === 0) elements.porscheTimeNeeded.textContent = 'Jetzt leistbar! 🎉';
    else if (achieved) {
      const years = Math.floor(monthsNeeded / 12), rem = monthsNeeded % 12;
      let str = '';
      if (years > 0) str += `${years} ${years === 1 ? 'Jahr' : 'Jahre'}`;
      if (rem > 0) { if (str) str += ' und '; str += `${rem} ${rem === 1 ? 'Monat' : 'Monate'}`; }
      elements.porscheTimeNeeded.textContent = years > 0 ? `${str} (${monthsNeeded} Monate)` : str;
    } else elements.porscheTimeNeeded.textContent = 'Nicht erreichbar';
  }
  if (elements.porscheTargetDate) {
    if (achieved && monthsNeeded === 0) elements.porscheTargetDate.textContent = 'Du kannst es Dir jetzt leisten!';
    else if (achieved) {
      const d = new Date(); d.setMonth(d.getMonth() + monthsNeeded);
      elements.porscheTargetDate.textContent = `Erreicht ca. ${d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}`;
    } else elements.porscheTargetDate.textContent = 'Ziel bei aktuellen Parametern unerreichbar';
  }

  if (elements.porscheSharesLabel) elements.porscheSharesLabel.textContent = sharesLabel;
  if (elements.porscheSharesNeeded) elements.porscheSharesNeeded.textContent = sharesText;
  if (elements.porscheSharesSubtitle) elements.porscheSharesSubtitle.textContent = sharesSubtitle;

  // ---- Spar-Hebel (what you paid out of pocket vs. the goal value) ----
  // Future months cost the real monthly NET salary deduction. (Dividing the PAST
  // out-of-pocket cost by the Rechner's month slider was wrong whenever real
  // portfolio holdings span a different period than the slider value.)
  const monthlyOut = e.monthlyGrossContribution * (1 - e.effectiveTaxRate);
  const totalOutPocket = outOfPocketNow + ((achieved && monthsNeeded > 0) ? monthsNeeded * monthlyOut : 0);
  const leverageAmount = Math.max(0, targetPrice - totalOutPocket);
  const leveragePercent = (leverageAmount / targetPrice) * 100;
  animateNumberValue('porscheOutPocket', totalOutPocket, fmtEUR0);
  animateNumberValue('porscheLeverageAmount', leverageAmount, fmtEUR0);
  animateNumberValue('porscheLeveragePercent', leveragePercent, (v) => `${v.toFixed(0)}%`);

  // ---- Projection chart ----
  updatePorscheGrowthChart(
    monthsNeeded, currentShares, costBasisPerShareEUR, currentPriceEUR,
    e.monthlyGrossContribution, e.effectiveTaxRate, capRate, brokerFee,
    growthRate, targetPrice, outOfPocketNow
  );
}

function updatePorscheGrowthChart(monthsNeeded, currentShares, sharePriceEUR, sellPriceEUR, monthlyGrossContribution, effectiveTaxRate, capGainsTaxRate, brokerFees, growthRate, targetPrice, totalEmployeeCost) {
  const ctx = document.getElementById('porscheGrowthChart').getContext('2d');
  
  let steps = 12;
  let monthsProj = Math.max(12, monthsNeeded);
  let stepSize = Math.ceil(monthsProj / steps);
  
  let labels = [];
  let outOfPocketData = [];
  let portfolioValueData = [];
  let targetLineData = [];
  
  const monthlyMarketValueEUR = monthlyGrossContribution / 0.85;
  const sharesAcquiredPerMonth = monthlyMarketValueEUR / sharePriceEUR;
  
  // Future months cost the actual monthly net salary deduction (consistent with the
  // Spar-Hebel figure — not the past cost divided by the Rechner's month slider).
  const monthlyOutPocket = monthlyGrossContribution * (1 - effectiveTaxRate);
  
  for (let i = 0; i <= steps; i++) {
    let t = i * stepSize;
    if (t > monthsProj) t = monthsProj;
    
    let labelStr = "";
    if (t === 0) {
      labelStr = "Heute";
    } else {
      let yrs = t / 12;
      if (Number.isInteger(yrs)) {
        labelStr = `${yrs} ${yrs === 1 ? 'Jahr' : 'Jahre'}`;
      } else {
        labelStr = `${t} M.`;
      }
    }
    labels.push(labelStr);
    
    let oop = totalEmployeeCost + t * monthlyOutPocket;
    outOfPocketData.push(parseFloat(oop.toFixed(0)));
    
    let r = (growthRate / 100) / 12;
    let currentStockPriceEUR_t = sharePriceEUR * Math.pow(1 + r, t);
    let currentSellPriceEUR_t = sellPriceEUR * Math.pow(1 + r, t);
    
    let accumulatedShares = currentShares;
    if (t > 0) {
      if (r === 0) {
        accumulatedShares += t * sharesAcquiredPerMonth;
      } else {
        accumulatedShares += sharesAcquiredPerMonth * (1 - Math.pow(1 + r, -t)) / r;
      }
    }
    
    let grossSaleRevenue = accumulatedShares * currentSellPriceEUR_t;
    let costBasis = (currentShares + t * sharesAcquiredPerMonth) * sharePriceEUR;
    let capitalGains = Math.max(0, grossSaleRevenue - costBasis);
    let capitalGainsTax = capitalGains * capGainsTaxRate;
    let netCash = grossSaleRevenue - capitalGainsTax - brokerFees;
    
    portfolioValueData.push(parseFloat(Math.max(0, netCash).toFixed(0)));
    targetLineData.push(targetPrice > 0 ? targetPrice : null);
    
    if (t === monthsProj) break;
  }
  
  if (elements.porscheChartYearBadge) {
    if (targetPrice <= 0) {
      elements.porscheChartYearBadge.textContent = "Zielbetrag fehlt";
    } else if (monthsNeeded > 0) {
      const yrs = (monthsNeeded / 12).toFixed(1);
      elements.porscheChartYearBadge.textContent = `${yrs} Jahre Projektion`;
    } else {
      elements.porscheChartYearBadge.textContent = "Bereits erreicht";
    }
  }
  
  const targetLabel = targetPrice > 0 ? 'Zielbetrag' : 'Kein Zielbetrag';

  if (state.porscheChart) {
    state.porscheChart.data.labels = labels;
    state.porscheChart.data.datasets[0].data = portfolioValueData;
    state.porscheChart.data.datasets[1].data = outOfPocketData;
    state.porscheChart.data.datasets[2].data = targetLineData;
    state.porscheChart.data.datasets[2].label = targetLabel;
    state.porscheChart.update();
  } else {
    state.porscheChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Netto-Depotwert (Verkauf)',
            data: portfolioValueData,
            borderColor: chartThemeColors().accentLine,
            backgroundColor: chartThemeColors().accentFill,
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: chartThemeColors().accentLine,
            pointHoverRadius: 7
          },
          {
            label: 'Deine Einzahlung (Netto)',
            data: outOfPocketData,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            pointBackgroundColor: '#3b82f6'
          },
          {
            label: targetLabel,
            data: targetLineData,
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: chartThemeColors().tick,
              font: { family: 'Outfit', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.raw.toLocaleString('de-DE')} €`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: chartThemeColors().grid },
            ticks: { color: chartThemeColors().tick, font: { family: 'Inter' } }
          },
          y: {
            grid: { color: chartThemeColors().grid },
            ticks: {
              color: chartThemeColors().tick,
              font: { family: 'Inter' },
              callback: function(value) {
                return value.toLocaleString('de-DE') + ' €';
              }
            }
          }
        }
      }
    });
  }
}


// ========================================
// PORTFOLIO ANALYSIS MODULE
// ========================================

const portfolioState = {
  transactions: [],
  currentPrice: 180.00,
  exchangeRate: 0.92,
  // Last price actually delivered by /api/stock/current (null until known) — used to
  // tell "input is just tracking the live price" apart from a deliberate user value.
  lastLivePrice: null,
  isPdfSource: false,
  enrichedTransactions: [],
  equatePlusTransfers: [],

  // EquatePlus held balance (parsed directly from the most recent Plan Holdings Statement, Page 2)
  equatePlusHoldings: [],        // individual lots still held in EquatePlus
  equatePlusHeld: 0,             // sum of equatePlusHoldings quantities
  latestEquatePlusDate: null,    // statement end-date the holdings were read from
  activeLots: [],                // FIFO-remaining real lots (incl. synthetic bridge) for the sell simulator

  // CapTrader fields
  capTraderFiles: [],
  capTraderTransfers: [],
  capTraderSells: [],
  capTraderPositions: {},
  capTraderDates: {},            // year -> statement end-date (Date) of each CapTrader statement
  capTraderCash: {}              // year -> { usd, eur, totalEUR } ending cash balances
};

function savePortfolioState() {
  const btnClearPortfolio = document.getElementById('btnClearPortfolio');
  const serialized = {
    transactions: (portfolioState.transactions || []).map(t => ({
      ...t,
      date: t.date ? (t.date instanceof Date ? t.date.getTime() : new Date(t.date).getTime()) : null
    })),
    currentPrice: portfolioState.currentPrice,
    exchangeRate: portfolioState.exchangeRate,
    lastLivePrice: portfolioState.lastLivePrice,
    isPdfSource: portfolioState.isPdfSource,
    equatePlusTransfers: (portfolioState.equatePlusTransfers || []).map(et => ({
      ...et,
      date: et.date ? (et.date instanceof Date ? et.date.getTime() : new Date(et.date).getTime()) : null
    })),
    equatePlusHoldings: (portfolioState.equatePlusHoldings || []).map(h => ({
      ...h,
      date: h.date ? (h.date instanceof Date ? h.date.getTime() : new Date(h.date).getTime()) : null
    })),
    equatePlusHeld: portfolioState.equatePlusHeld,
    latestEquatePlusDate: portfolioState.latestEquatePlusDate ? (portfolioState.latestEquatePlusDate instanceof Date ? portfolioState.latestEquatePlusDate.getTime() : new Date(portfolioState.latestEquatePlusDate).getTime()) : null,
    capTraderFiles: portfolioState.capTraderFiles || [],
    capTraderTransfers: portfolioState.capTraderTransfers || [],
    capTraderSells: portfolioState.capTraderSells || [],
    capTraderPositions: portfolioState.capTraderPositions || {},
    capTraderCash: portfolioState.capTraderCash || {},
    capTraderDates: Object.keys(portfolioState.capTraderDates || {}).reduce((acc, year) => {
      const d = portfolioState.capTraderDates[year];
      acc[year] = d ? (d instanceof Date ? d.getTime() : new Date(d).getTime()) : null;
      return acc;
    }, {}),
    sellQuantity: portfolioElements.sellQuantity ? portfolioElements.sellQuantity.value : '',
    sellPrice: portfolioElements.sellPrice ? portfolioElements.sellPrice.value : '',
    sellBroker: portfolioElements.sellBroker ? portfolioElements.sellBroker.value : ''
  };
  localStorage.setItem(LS_KEYS.portfolioState, JSON.stringify(serialized));
  
  if (btnClearPortfolio) {
    btnClearPortfolio.style.display = 'block';
  }
}

function loadPortfolioState() {
  try {
    const raw = localStorage.getItem(LS_KEYS.portfolioState);
    const btnClearPortfolio = document.getElementById('btnClearPortfolio');
    
    if (!raw) {
      if (btnClearPortfolio) btnClearPortfolio.style.display = 'none';
      return;
    }
    
    const parsed = JSON.parse(raw);
    if (!parsed) return;

    if (Array.isArray(parsed.transactions)) {
      portfolioState.transactions = parsed.transactions.map(t => ({
        ...t,
        date: t.date ? new Date(t.date) : null
      }));
    }
    portfolioState.currentPrice = parsed.currentPrice ?? 180.00;
    portfolioState.exchangeRate = parsed.exchangeRate ?? 0.92;
    portfolioState.lastLivePrice = Number.isFinite(parsed.lastLivePrice) ? parsed.lastLivePrice : null;
    portfolioState.isPdfSource = parsed.isPdfSource ?? false;
    
    if (Array.isArray(parsed.equatePlusTransfers)) {
      portfolioState.equatePlusTransfers = parsed.equatePlusTransfers.map(et => ({
        ...et,
        date: et.date ? new Date(et.date) : null
      }));
    }
    if (Array.isArray(parsed.equatePlusHoldings)) {
      portfolioState.equatePlusHoldings = parsed.equatePlusHoldings.map(h => ({
        ...h,
        date: h.date ? new Date(h.date) : null
      }));
    }
    portfolioState.equatePlusHeld = parsed.equatePlusHeld ?? 0;
    portfolioState.latestEquatePlusDate = parsed.latestEquatePlusDate ? new Date(parsed.latestEquatePlusDate) : null;
    
    portfolioState.capTraderFiles = parsed.capTraderFiles ?? [];
    portfolioState.capTraderTransfers = parsed.capTraderTransfers ?? [];
    portfolioState.capTraderSells = parsed.capTraderSells ?? [];
    portfolioState.capTraderPositions = parsed.capTraderPositions ?? {};
    portfolioState.capTraderCash = parsed.capTraderCash ?? {};

    portfolioState.capTraderDates = {};
    if (parsed.capTraderDates) {
      Object.keys(parsed.capTraderDates).forEach(year => {
        const val = parsed.capTraderDates[year];
        portfolioState.capTraderDates[year] = val ? new Date(val) : null;
      });
    }

    if (portfolioState.transactions.length > 0 || Object.keys(portfolioState.capTraderPositions).length > 0) {
      // Show the restored valuation context (the live fetch replaces it shortly).
      updatePortfolioPriceLine();

      // Restore simulator values
      if (parsed.sellQuantity !== undefined && portfolioElements.sellQuantity) {
        portfolioElements.sellQuantity.value = parsed.sellQuantity;
        if (portfolioElements.sellQuantitySlider) {
          portfolioElements.sellQuantitySlider.value = parsed.sellQuantity;
        }
      }
      if (parsed.sellPrice !== undefined && portfolioElements.sellPrice) {
        portfolioElements.sellPrice.value = parsed.sellPrice;
      }
      if (parsed.sellBroker !== undefined && portfolioElements.sellBroker) {
        portfolioElements.sellBroker.value = parsed.sellBroker;
      }

      // Re-run the analysis silently: on reload this is background restoration, not an
      // action the user just took — no "✓ Analyse abgeschlossen" toast (the Rechner
      // behaves the same way with its upload status).
      analyzePortfolio({ silent: true });
    }
    
    if (btnClearPortfolio) {
      btnClearPortfolio.style.display = 'block';
    }
  } catch (err) {
    console.error('Error loading portfolio state from localStorage:', err);
  }
}

// Shares that left EquatePlus but have not yet arrived at CapTrader.
// = EquatePlus transfers-out with no matching CapTrader FOP-In (qty within tolerance, within a date window).
function getInTransitShares() {
  let inTransit = 0;
  portfolioState.equatePlusTransfers.forEach(et => {
    const matched = portfolioState.capTraderTransfers.some(ct => {
      const ctDate = new Date(ct.dateStr);
      const dayDiff = Math.abs(et.date - ctDate) / (1000 * 60 * 60 * 24);
      return Math.abs(et.quantity - ct.quantity) < 0.5 && dayDiff <= 10;
    });
    if (!matched) inTransit += et.quantity;
  });
  return inTransit;
}

// Make this global so all portfolio functions can access it
let portfolioElements = {};

// Initialize Portfolio Module
function initPortfolioModule() {
  // Populate the global object now that the DOM is ready
  portfolioElements = {
    csvUploadZone: document.getElementById('csvUploadZone'),
    csvFileInput: document.getElementById('csvFileInput'),
    csvUploadStatus: document.getElementById('csvUploadStatus'),
    portfolioPriceText: document.getElementById('portfolioPriceText'),
    btnFetchPortfolioPrice: document.getElementById('btnFetchPortfolioPrice'),
    portfolioResults: document.getElementById('portfolioResults'),
    portfolioTransactionsCard: document.getElementById('portfolioTransactionsCard'),
    portfolioTaxReportCard: document.getElementById('portfolioTaxReportCard'),
    taxReportContent: document.getElementById('taxReportContent'),
    taxReportBadge: document.getElementById('taxReportBadge'),
    equateplusBuyBody: document.getElementById('equateplusBuyBody'),
    equateplusBuyFoot: document.getElementById('equateplusBuyFoot'),
    equateplusBuyNote: document.getElementById('equateplusBuyNote'),
    capTraderHoldingBlock: document.getElementById('capTraderHoldingBlock'),
    capTraderCashBlock: document.getElementById('capTraderCashBlock'),
    sellHistoryBody: document.getElementById('sellHistoryBody'),
    sellHistoryFoot: document.getElementById('sellHistoryFoot'),
    transactionCount: document.getElementById('transactionCount'),
    
    // Sell Simulator elements
    portfolioSellSimulatorCard: document.getElementById('portfolioSellSimulatorCard'),
    sellQuantity: document.getElementById('sellQuantity'),
    sellQuantitySlider: document.getElementById('sellQuantitySlider'),
    sellPrice: document.getElementById('sellPrice'),
    sellBroker: document.getElementById('sellBroker'),
    maxSellQuantityLabel: document.getElementById('maxSellQuantityLabel'),
    simValProceeds: document.getElementById('simValProceeds'),
    simValCashCost: document.getElementById('simValCashCost'),
    simValTaxableGain: document.getElementById('simValTaxableGain'),
    simValTax: document.getElementById('simValTax'),
    simValFees: document.getElementById('simValFees'),
    simValNetProfit: document.getElementById('simValNetProfit'),
    simValCashout: document.getElementById('simValCashout'),
    fifoLotBreakdownContainer: document.getElementById('fifoLotBreakdownContainer'),
    fifoLotBreakdownBody: document.getElementById('fifoLotBreakdownBody'),

    // Depot-Konsolidierung elements
    portfolioConsolidationCard: document.getElementById('portfolioConsolidationCard'),
    consolidationEqPercent: document.getElementById('consolidationEqPercent'),
    consolidationCtPercent: document.getElementById('consolidationCtPercent'),
    consolidationEqBar: document.getElementById('consolidationEqBar'),
    consolidationCtBar: document.getElementById('consolidationCtBar'),
    consolidationEqShares: document.getElementById('consolidationEqShares'),
    consolidationEqValue: document.getElementById('consolidationEqValue'),
    consolidationEqItems: document.getElementById('consolidationEqItems'),
    consolidationEqDate: document.getElementById('consolidationEqDate'),
    consolidationCtShares: document.getElementById('consolidationCtShares'),
    consolidationCtValue: document.getElementById('consolidationCtValue'),
    consolidationCtRealized: document.getElementById('consolidationCtRealized'),
    consolidationCtStats: document.getElementById('consolidationCtStats'),
    consolidationCtDate: document.getElementById('consolidationCtDate'),
    consolidationDateWarning: document.getElementById('consolidationDateWarning'),
    consolidationDateWarningText: document.getElementById('consolidationDateWarningText'),
    btnToggleCapTraderDetails: document.getElementById('btnToggleCapTraderDetails'),
    capTraderActivityDetails: document.getElementById('capTraderActivityDetails'),
    capTraderSellsBody: document.getElementById('capTraderSellsBody'),
    capTraderTransfersBody: document.getElementById('capTraderTransfersBody'),
    equatePlusTransfersBody: document.getElementById('equatePlusTransfersBody')
  };
  
  if (!portfolioElements.csvUploadZone) {
    console.error('Portfolio elements not found in DOM');
    return;
  }

  // Upload zone click
  portfolioElements.csvUploadZone.addEventListener('click', () => {
    portfolioElements.csvFileInput.click();
  });

  // File input change
  portfolioElements.csvFileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleMultipleUploadedFiles(files);
    }
  });

  // Drag and drop
  portfolioElements.csvUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    portfolioElements.csvUploadZone.classList.add('dragover');
  });

  portfolioElements.csvUploadZone.addEventListener('dragleave', () => {
    portfolioElements.csvUploadZone.classList.remove('dragover');
  });

  portfolioElements.csvUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    portfolioElements.csvUploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleMultipleUploadedFiles(files);
    }
  });

  // Fetch current price button
  portfolioElements.btnFetchPortfolioPrice.addEventListener('click', () => fetchPortfolioPrice());

  // Sell Simulator event listeners
  portfolioElements.sellQuantity.addEventListener('input', () => {
    portfolioElements.sellQuantitySlider.value = portfolioElements.sellQuantity.value;
    updateSellSimulation();
  });
  portfolioElements.sellQuantitySlider.addEventListener('input', () => {
    portfolioElements.sellQuantity.value = portfolioElements.sellQuantitySlider.value;
    updateSellSimulation();
  });
  portfolioElements.sellPrice.addEventListener('input', updateSellSimulation);
  portfolioElements.sellBroker.addEventListener('change', updateSellSimulation);

  // Quick Select buttons
  document.querySelectorAll('.btn-quick-sell').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const percent = parseFloat(e.target.dataset.percent);
      const totalShares = portfolioState.totalCombinedShares !== undefined
        ? portfolioState.totalCombinedShares
        : portfolioState.enrichedTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const targetQty = (totalShares * percent) / 100;
      portfolioElements.sellQuantity.value = targetQty.toFixed(5);
      portfolioElements.sellQuantitySlider.value = targetQty;
      updateSellSimulation();
    });
  });

  // Toggle CapTrader details collapsible (GSAP height expand instead of a hard flip)
  if (portfolioElements.btnToggleCapTraderDetails) {
    portfolioElements.btnToggleCapTraderDetails.addEventListener('click', () => {
      const details = portfolioElements.capTraderActivityDetails;
      const isHidden = details.style.display === 'none';
      const dur = prefersReducedMotion() ? 0 : 0.28;
      portfolioElements.btnToggleCapTraderDetails.innerHTML = isHidden ?
        `<i class="fa-solid fa-folder-closed"></i> CapTrader-/IBKR-Transaktionsdetails ausblenden` :
        `<i class="fa-solid fa-folder-open"></i> CapTrader-/IBKR-Transaktionsdetails anzeigen`;

      gsap.killTweensOf(details);
      if (isHidden) {
        details.style.display = 'block';
        details.style.overflow = 'hidden';
        gsap.fromTo(details,
          { height: 0, opacity: 0 },
          {
            height: details.scrollHeight, opacity: 1, duration: dur, ease: 'power1.out',
            onComplete: () => { details.style.height = 'auto'; details.style.overflow = ''; }
          }
        );
      } else {
        details.style.overflow = 'hidden';
        gsap.fromTo(details,
          { height: details.scrollHeight },
          {
            height: 0, opacity: 0, duration: dur, ease: 'power1.out',
            onComplete: () => {
              details.style.display = 'none';
              details.style.height = 'auto';
              details.style.overflow = '';
              gsap.set(details, { clearProps: 'opacity' });
            }
          }
        );
      }
    });
  }

  // Sync with main calculator price as an initial placeholder...
  portfolioState.currentPrice = state.usdPrice;
  portfolioState.exchangeRate = state.exchangeRate;

  const btnClearPortfolio = document.getElementById('btnClearPortfolio');
  if (btnClearPortfolio) {
    btnClearPortfolio.addEventListener('click', () => {
      localStorage.removeItem(LS_KEYS.portfolioState);
      window.location.reload();
    });
  }

  // Load saved portfolio state if any
  loadPortfolioState();

  // Collapsible import step with persisted open/closed state. It stays open unless
  // the user collapses it themselves — auto-collapsing it after a data restore
  // looked like the page had "forgotten" the state on reload.
  initCollapsibleSteps('#tab-portfolio', 'espp_portfolio_open_steps');

  // ...then immediately replace it with the live IBM price on load.
  fetchPortfolioPrice({ silent: true });
}

// Fetch the current IBM price + USD/EUR rate and apply it to the portfolio inputs.
// silent: don't show a status toast (used for the automatic fetch on page load).
async function fetchPortfolioPrice({ silent = false } = {}) {
  try {
    const data = await api.fetchCurrentStock();
    if (!data.success) throw new Error(data.message || 'Kurs nicht verfügbar');

    // The portfolio is ALWAYS valued at the live market price (what-if sell prices
    // live in the Verkaufs-Simulator). Only the simulator's own price input keeps
    // the tracking guard: a deliberately typed simulated Verkaufskurs must survive
    // both the on-load fetch and the periodic background refresh.
    const lastLive = portfolioState.lastLivePrice;
    if (portfolioElements.sellPrice) {
      const sellVal = parseFloat(portfolioElements.sellPrice.value);
      if (lastLive == null || !isFinite(sellVal) || Math.abs(sellVal - lastLive) < 0.01) {
        portfolioElements.sellPrice.value = data.price.toFixed(2);
      }
    }
    portfolioState.currentPrice = data.price;
    portfolioState.exchangeRate = data.exchangeRate;
    portfolioState.lastLivePrice = data.price;
    portfolioState.priceIsLive = true;
    updatePortfolioPriceLine();
    updatePortfolioStepSummaries();
    if (!silent) {
      showPortfolioStatus(`Kurs aktualisiert: $${data.price.toFixed(2)}`, 'success');
    }

    if (hasAnyPortfolioData()) {
      analyzePortfolio({ silent });
    }
  } catch (error) {
    portfolioState.priceIsLive = false;
    updatePortfolioPriceLine();
    if (!silent) showPortfolioStatus('Fehler beim Abrufen des Kurses', 'error');
  }
}

// Valuation-context line above the Portfolio-Übersicht: the price + FX every figure
// is computed with, and whether that price is live or the last known fallback.
function updatePortfolioPriceLine() {
  const el = portfolioElements.portfolioPriceText;
  if (!el) return;
  const price = portfolioState.currentPrice;
  const fx = portfolioState.exchangeRate;
  if (!Number.isFinite(price) || !Number.isFinite(fx)) {
    el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Lade Live-Kurs…';
    return;
  }
  const figures = `<strong>$${price.toFixed(2)}</strong> · USD/EUR ${fx.toFixed(4)}`;
  if (portfolioState.priceIsLive === undefined) {
    // First paint before the fetch has answered: show the restored price neutrally.
    el.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Bewertung zum Kurs ${figures} – lade Live-Kurs…`;
  } else if (portfolioState.priceIsLive) {
    el.innerHTML = `<i class="fa-solid fa-tower-broadcast text-success"></i> Bewertung zum Live-Kurs ${figures}`;
  } else {
    el.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-warning"></i> Live-Kurs nicht erreichbar – Bewertung zum letzten bekannten Kurs ${figures}`;
  }
}

// Handle multiple files uploaded
async function handleMultipleUploadedFiles(files) {
  showPortfolioStatus(`Lese ${files.length} Datei(en)...`, 'loading');
  let errors = [];
  let successes = 0;
  for (const file of files) {
    try {
      if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        await parsePDF(arrayBuffer, file.name);
        successes++;
      } else {
        errors.push(`${file.name}: Nur PDF-Dateien werden unterstützt.`);
      }
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  
  if (successes > 0) {
    await analyzePortfolio();
  }
  
  if (errors.length > 0) {
    if (successes > 0) {
      showPortfolioStatus(`✓ ${successes} erfolgreich geladen, ✗ ${errors.length} fehlgeschlagen:\n` + errors.join('\n'), 'warning');
    } else {
      showPortfolioStatus(`✗ Fehler beim Laden:\n` + errors.join('\n'), 'error');
    }
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei.'));
    reader.readAsArrayBuffer(file);
  });
}

// Parse PDF using client-side pdf.js
async function parsePDF(arrayBuffer, fileName) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js Bibliothek konnte nicht geladen werden.');
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => item.str);
    let pageText = strings.join(' ') + '\n';
    if (pageText.includes('P a g e') || (pageText.match(/ [a-zA-Z0-9] /g) || []).length > 20) {
      pageText = cleanSpacedText(pageText);
    }
    pageTexts.push(pageText);
  }
  
  const cleanedText = pageTexts.join('\n');
  
  // CapTrader Statement Detection
  if (cleanedText.includes('CapTrader') || cleanedText.includes('Umsatzübersicht') || cleanedText.includes('Kontoinformation')) {
    const data = parseCapTraderStatement(cleanedText);
    if (!data.year) {
      showPortfolioStatus('Fehler beim Erkennen des CapTrader-/IBKR-Statements. Zeitraum konnte nicht ermittelt werden.', 'error');
      return;
    }
    
    // Add file name
    if (!portfolioState.capTraderFiles.includes(fileName)) {
      portfolioState.capTraderFiles.push(fileName);
    }
    
    // Deduplicate and merge sells
    data.sells.forEach(s => {
      const key = `${s.dateStr}_${s.quantity}_${s.priceUSD}`;
      if (!portfolioState.capTraderSells.some(existing => `${existing.dateStr}_${existing.quantity}_${existing.priceUSD}` === key)) {
        portfolioState.capTraderSells.push(s);
      }
    });
    
    // Deduplicate and merge transfers
    data.transfers.forEach(t => {
      const key = `${t.dateStr}_${t.quantity}_${t.marketValueUSD}`;
      if (!portfolioState.capTraderTransfers.some(existing => `${existing.dateStr}_${existing.quantity}_${existing.marketValueUSD}` === key)) {
        portfolioState.capTraderTransfers.push(t);
      }
    });
    
    // Save position and the statement's end-date (for the "as of" snapshot consistency check)
    if (data.openPosition) {
      portfolioState.capTraderPositions[data.year] = data.openPosition;
    }
    if (data.endDate) {
      portfolioState.capTraderDates[data.year] = data.endDate;
    }
    if (data.cash) {
      portfolioState.capTraderCash[data.year] = data.cash;
    }

    showPortfolioStatus(`✓ CapTrader-/IBKR-Statement (${data.year}) geladen: ${data.sells.length} Verkäufe, ${data.transfers.length} Transfers`, 'success');
  } else if (cleanedText.toLowerCase().includes('plan holdings statement') || cleanedText.toLowerCase().includes('plan holdings')) {
    // The actual EquatePlus balance is reported directly on the holdings summary page (Page 2)
    // as a list of lots. Parse it from the FULL text (before filtering) and keep the most recent
    // statement's holdings as the authoritative current EquatePlus balance.
    const stmtDate = parseStatementEndDate(cleanedText);
    const holdings = parseEquatePlusHoldings(cleanedText);
    if (stmtDate && holdings.length > 0) {
      if (!portfolioState.latestEquatePlusDate || stmtDate > portfolioState.latestEquatePlusDate) {
        portfolioState.latestEquatePlusDate = stmtDate;
        portfolioState.equatePlusHoldings = holdings;
        portfolioState.equatePlusHeld = holdings.reduce((sum, h) => sum + h.quantity, 0);
      }
    }

    // Filter out Cover, Page 1, and Page 2 for the purchase/dividend history parsing
    // (Page 2 holdings would otherwise double-count against the Page 3 purchase rows).
    const filteredPages = pageTexts.filter(pageText => {
      return !/P\s*a\s*g\s*e\s*[12]\b/i.test(pageText);
    });
    const filteredText = filteredPages.join('\n');

    const tx = parseYearEndStatement(filteredText);
    if (tx.length === 0) {
      showPortfolioStatus('Keine Transaktionen im Plan Holdings Statement gefunden.', 'warning');
      return;
    }
    
    if (!portfolioState.transactions) {
      portfolioState.transactions = [];
    }
    tx.forEach(t => {
      const key = `${t.date.getTime()}_${t.type}_${t.quantity}_${t.purchasePriceUSD}`;
      if (!portfolioState.transactions.some(existing => `${existing.date.getTime()}_${existing.type}_${existing.quantity}_${existing.purchasePriceUSD}` === key)) {
        portfolioState.transactions.push(t);
      }
    });

    // Extract transfers out of EquatePlus
    const eqTransfers = extractEquatePlusTransfers(filteredText);
    eqTransfers.forEach(et => {
      const key = `${et.date.getTime()}_${et.quantity}`;
      if (!portfolioState.equatePlusTransfers.some(existing => `${existing.date.getTime()}_${existing.quantity}` === key)) {
        portfolioState.equatePlusTransfers.push(et);
      }
    });
    
    portfolioState.isPdfSource = true;
    showPortfolioStatus(`✓ Jahres-Statement parsed: ${tx.length} Transaktionen erkannt`, 'success');
  } else if (cleanedText.includes('Employee Plan Statement') || (/Balance Forward/i.test(cleanedText) && /Computershare/i.test(cleanedText))) {
    // OLD Computershare statement format (pre-EquatePlus migration, e.g. 2024).
    const parsed = parseOldHoldingsStatement(pageTexts);
    if (parsed.purchases.length === 0) {
      showPortfolioStatus('Konnte das alte Computershare-Statement nicht auslesen.', 'error');
      return;
    }

    parsed.purchases.forEach(t => {
      const key = `${t.date.getTime()}_${t.type}_${t.quantity}_${t.purchasePriceUSD}`;
      if (!portfolioState.transactions.some(e => `${e.date.getTime()}_${e.type}_${e.quantity}_${e.purchasePriceUSD}` === key)) {
        portfolioState.transactions.push(t);
      }
    });

    parsed.transfers.forEach(et => {
      const key = `${et.date.getTime()}_${et.quantity}`;
      if (!portfolioState.equatePlusTransfers.some(e => `${e.date.getTime()}_${e.quantity}` === key)) {
        portfolioState.equatePlusTransfers.push(et);
      }
    });

    // Holdings only override the current balance if this is the most recent statement.
    if (parsed.statementDate && parsed.holdings.length > 0) {
      if (!portfolioState.latestEquatePlusDate || parsed.statementDate > portfolioState.latestEquatePlusDate) {
        portfolioState.latestEquatePlusDate = parsed.statementDate;
        portfolioState.equatePlusHoldings = parsed.holdings;
        portfolioState.equatePlusHeld = parsed.holdings.reduce((s, h) => s + h.quantity, 0);
      }
    }

    portfolioState.isPdfSource = true;
    const yr = parsed.statementDate ? parsed.statementDate.getFullYear() : '?';
    showPortfolioStatus(`✓ Altes Plan-Statement (${yr}) geladen: ${parsed.purchases.length} Käufe erkannt`, 'success');
  } else if (cleanedText.toLowerCase().includes('purchase activity statement') || cleanedText.toLowerCase().includes('purchase activity') || cleanedText.toLowerCase().includes('purchases 1 jan')) {
    showPortfolioStatus('Purchase Activity Statements werden nicht unterstützt. Bitte lade die Plan Holdings Statements für 2025 und 2026 hoch.', 'error');
    return;
  } else {
    showPortfolioStatus('Unbekanntes PDF-Format. Bitte lade ein EquatePlus Jahres-/Quartals-Statement oder ein CapTrader-/IBKR-Statement hoch.', 'error');
  }
}

// Clean character spacing anomalies commonly found in PDF text extraction
function cleanSpacedText(text) {
  return text.split('\n').map(line => {
    if ((line.match(/ [a-zA-Z0-9] /g) || []).length > 5 || line.includes('P a g e')) {
      let cleaned = line.replace(/   /g, '|');
      cleaned = cleaned.replace(/  /g, '|');
      cleaned = cleaned.replace(/ /g, '');
      cleaned = cleaned.replace(/\|/g, ' ');
      cleaned = cleaned.replace(/\s+/g, ' ');
      return cleaned;
    }
    return line;
  }).join('\n');
}

// Help parse english month names to javascript dates
function parseEnglishDate(dateStr) {
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const monthName = parts[1].substring(0, 3).toLowerCase();
    const year = parseInt(parts[2]);
    
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    
    if (months[monthName] !== undefined && !isNaN(day) && !isNaN(year)) {
      return new Date(year, months[monthName], day);
    }
  }
  return null;
}

// Extract transfers out of EquatePlus
function extractEquatePlusTransfers(text) {
  const transfers = [];
  const regex = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+IBM\s+Common\s+Stock\s+[\d\.,\-]+\s+USD\s+([\d\.]+)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const dateStr = match[1];
    const quantity = parseFloat(match[2]);
    const date = parseEnglishDate(dateStr);
    if (date) {
      transfers.push({ dateStr, date, quantity });
    }
  }
  return transfers;
}

// Read the statement end-date, e.g. "1 Jan 2025 - 31 Dec 2025" or "1 Jan 2026 - 1 Jun 2026"
function parseStatementEndDate(text) {
  const periodMatch = /1\s+Jan\s+\d{4}\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i.exec(text);
  if (periodMatch) return parseEnglishDate(periodMatch[1]);
  const asOfMatch = /as of\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i.exec(text);
  if (asOfMatch) return parseEnglishDate(asOfMatch[1]);
  return null;
}

// Parse the OLD Computershare "Employee Plan Statement" (pre-EquatePlus migration, e.g. 2024).
// Its layout is column-stacked: blocks of [purchase dates] [FMV] [purchase price] [shares] follow
// one another. We locate the FMV/price blocks via the invariant: purchase price = 0.85 × FMV
// (the 15 % ESPP discount), then align the purchase dates (just before) and shares (just after).
function parseOldHoldingsStatement(pageTexts) {
  const fullText = pageTexts.join('\n');
  const purchases = [];
  const transfers = [];
  let holdings = [];

  // Statement end-date from the period "02 Jan 2024 - 31 Dec 2024".
  let statementDate = null;
  const periodMatch = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/.exec(fullText);
  if (periodMatch) statementDate = parseEnglishDate(periodMatch[2]);

  // The ledger page contains "Balance Forward".
  const ledger = pageTexts.find(t => /Balance Forward/i.test(t)) || fullText;

  // Tokenize the ledger into an ordered list of date / number tokens (words are skipped).
  const tokenRe = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})|(-?[\d,]+\.\d+)/g;
  const tokens = [];
  let m;
  while ((m = tokenRe.exec(ledger)) !== null) {
    if (m[1]) tokens.push({ type: 'date', date: parseEnglishDate(m[1]), str: m[1].replace(/\s+/g, ' ') });
    else tokens.push({ type: 'num', val: parseFloat(m[2].replace(/,/g, '')) });
  }

  // Find the run of consecutive numbers holding the FMV->price block (price[k] ≈ 0.85 × FMV[k]).
  const runs = [];
  for (let i = 0; i < tokens.length;) {
    if (tokens[i].type === 'num') {
      let j = i;
      while (j < tokens.length && tokens[j].type === 'num') j++;
      runs.push({ start: i, end: j });
      i = j;
    } else i++;
  }

  let best = null;
  for (const run of runs) {
    const vals = tokens.slice(run.start, run.end).map(t => t.val);
    let L = 0;
    for (let cand = 1; cand <= Math.floor(vals.length / 2); cand++) {
      let ok = true;
      for (let k = 0; k < cand; k++) {
        if (!(vals[k] > 0) || Math.abs(vals[cand + k] - 0.85 * vals[k]) > Math.max(0.05, 0.006 * vals[k])) { ok = false; break; }
      }
      if (ok) L = cand;
    }
    if (L >= 3 && (!best || L > best.L)) best = { run, vals, L };
  }

  if (best) {
    const { run, vals, L } = best;
    const fmv = vals.slice(0, L);
    const price = vals.slice(L, 2 * L);
    const sharesRegion = vals.slice(2 * L);

    // Purchase dates = the L date tokens immediately before this number run.
    const purchaseDates = [];
    for (let p = run.start - 1; p >= 0 && tokens[p].type === 'date' && purchaseDates.length < L; p--) {
      purchaseDates.unshift(tokens[p]);
    }

    // Shares block holds L purchases + T transfers; the remaining numbers are the running balance.
    // run length = 2L (fmv+price) + (L+T) shares + (L+T+1) balance  =>  T = (len - 4L - 1) / 2.
    const T = Math.max(0, Math.round((vals.length - 4 * L - 1) / 2));
    const sharesBlock = sharesRegion.slice(0, L + T);
    const positiveShares = sharesBlock.filter(s => s > 0);

    for (let k = 0; k < L; k++) {
      const d = purchaseDates[k];
      const qty = positiveShares[k];
      if (!d || !d.date || !(qty > 0)) continue;
      purchases.push({
        type: 'Purchase Shares',
        date: d.date,
        dateStr: d.str,
        quantity: qty,
        fmvUSD: fmv[k],
        purchasePriceUSD: price[k],
        isPdfSource: true
      });
    }
  }

  // Transfers out: detail section "05 Sep 2024  Transfer  <lot dates...>  -40.000000".
  const transferRe = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+Transfer\b(?:\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4})*\s+(-\d+\.\d+)/g;
  let tm;
  while ((tm = transferRe.exec(fullText)) !== null) {
    const date = parseEnglishDate(tm[1]);
    const quantity = Math.abs(parseFloat(tm[2]));
    if (date && quantity > 0) transfers.push({ dateStr: tm[1].replace(/\s+/g, ' '), date, quantity });
  }

  // Reconstruct the year-end held lots: purchases minus the transferred shares (FIFO, oldest first).
  const sortedBuys = [...purchases].sort((a, b) => a.date - b.date).map(p => ({ ...p, remaining: p.quantity }));
  let toRemove = transfers.reduce((s, t) => s + t.quantity, 0);
  for (const lot of sortedBuys) {
    if (toRemove <= 0) break;
    const r = Math.min(lot.remaining, toRemove);
    lot.remaining -= r;
    toRemove -= r;
  }
  holdings = sortedBuys
    .filter(lot => lot.remaining > 0.00001)
    .map(lot => ({
      type: 'Purchase Shares',
      date: lot.date,
      dateStr: lot.dateStr,
      quantity: lot.remaining,
      fmvUSD: lot.fmvUSD,
      costBasisUSD: lot.purchasePriceUSD
    }));

  return { purchases, transfers, holdings, statementDate };
}

// Parse the EquatePlus holdings summary (Page 2). Each row is a lot still held in the depot:
//   "Purchase Shares 31 Dec 2025 1.32254 298.86 USD 254.04 USD ..."
//   "Dividend Shares 11 Dec 2025 0.01353 0.00 USD 312.52 USD ..."
// The sum of these quantities is the authoritative current EquatePlus balance.
function parseEquatePlusHoldings(text) {
  const holdings = [];
  const regex = /(Purchase|Dividend)\s+Shares\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+([\d]+\.[\d]+)\s+([\d]+\.[\d]+)\s+USD\s+([\d]+\.[\d]+)\s+USD/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const date = parseEnglishDate(match[2]);
    const quantity = parseFloat(match[3]);
    if (date && quantity > 0) {
      holdings.push({
        type: match[1].toLowerCase() === 'dividend' ? 'Dividend Shares' : 'Purchase Shares',
        date,
        dateStr: match[2],
        quantity,
        fmvUSD: parseFloat(match[4]),
        costBasisUSD: parseFloat(match[5])
      });
    }
  }
  return holdings;
}

// Parse EquatePlus Year-End holdings statement text
function parseYearEndStatement(cleanedText) {
  const lines = cleanedText.split('\n');
  const transactions = [];

  for (const line of lines) {
    // 2. Parse regular purchases from Purchases page
    const rowRegex = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+Participant\s+([\d\.,]+)\s+USD\s+([\d\.]+)\s+USD([\d\.,]+)\s+USD/g;
    let match;
    while ((match = rowRegex.exec(line)) !== null) {
      const purchaseDateStr = match[4];
      const contribution = parseFloat(match[5]);
      const qtyPriceStr = match[6];
      const fmv = parseFloat(match[7]);
      
      const date = parseEnglishDate(purchaseDateStr);
      const dotIndex = qtyPriceStr.indexOf('.');
      if (date && dotIndex !== -1) {
        let quantity = 0;
        let purchasePrice = 0;
        let foundSplit = false;
        
        // Dynamically find split point by checking which split matches the contribution amount
        for (let i = 3; i < qtyPriceStr.length - 3; i++) {
          const qtyPart = qtyPriceStr.substring(0, i);
          const pricePart = qtyPriceStr.substring(i);
          
          if (qtyPart.includes('.') && pricePart.includes('.')) {
            const q = parseFloat(qtyPart);
            const p = parseFloat(pricePart);
            if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
              if (Math.abs(q * p - contribution) < 2.0) {
                quantity = q;
                purchasePrice = p;
                foundSplit = true;
                break;
              }
            }
          }
        }
        
        // Fallback to original logic if split matching contribution is not found
        if (!foundSplit) {
          const qtyStr = qtyPriceStr.substring(0, dotIndex + 6);
          const priceStr = qtyPriceStr.substring(dotIndex + 6);
          quantity = parseFloat(qtyStr);
          purchasePrice = parseFloat(priceStr);
          
          if (contribution > 0 && Math.abs(quantity * purchasePrice - contribution) > 1.0) {
            for (let d = 1; d <= 9; d++) {
              let testPrice = parseFloat(d.toString() + priceStr);
              if (Math.abs(quantity * testPrice - contribution) < 1.0) {
                purchasePrice = testPrice;
                break;
              }
            }
          }
        }
        
        if (quantity > 0) {
          transactions.push({
            type: 'Purchase Shares',
            date,
            dateStr: purchaseDateStr,
            quantity,
            fmvUSD: fmv,
            purchasePriceUSD: purchasePrice,
            isPdfSource: true
          });
        }
      }
    }
    
    // 3. Parse dividend reinvestments from Transactions page (Page 3 onwards)
    // Standard format:
    const divRegex = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+[\d\.,]+\s+[\d\.,]+\s+USD\s+[\d\.,]+\s+USD\s+[\d\.,]+\s+USD\s+[\d\.,]+\s+USD\s+([\d\.,]+)\s+USD\s+([\d\.]+)\s+[\d\.,]+\s+USD/g;
    let divMatch;
    while ((divMatch = divRegex.exec(line)) !== null) {
      const dateStr = divMatch[1];
      const priceVal = parseFloat(divMatch[2]);
      const quantity = parseFloat(divMatch[3]);
      const date = parseEnglishDate(dateStr);
      
      if (date && quantity > 0) {
        transactions.push({
          type: 'Dividend Shares',
          date,
          dateStr,
          quantity,
          fmvUSD: priceVal,
          purchasePriceUSD: priceVal,
          isPdfSource: true
        });
      }
    }

    // Scrambled format (e.g. August 2025 dividend):
    const scrambledDivRegex = /rate\s+([\d\.,]+)\s+USD\s+([\d\.,]+)\s+USD\s+([\d\.,]+)\s+USD\s+([\d\.,]+)\s+USD\s+([\d\.,]+)\s+USD\s+([\d\.]+)\s+([\d\.,]+)\s+USD\s+IBM\s+Common\s+Stock\s+at\s+[\d\.,]+\s+USD\s+rate\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/gi;
    let scrambledDivMatch;
    while ((scrambledDivMatch = scrambledDivRegex.exec(line)) !== null) {
      const priceVal = parseFloat(scrambledDivMatch[5]);
      const quantity = parseFloat(scrambledDivMatch[6]);
      const dateStr = scrambledDivMatch[8];
      const date = parseEnglishDate(dateStr);
      
      if (date && quantity > 0) {
        transactions.push({
          type: 'Dividend Shares',
          date,
          dateStr,
          quantity,
          fmvUSD: priceVal,
          purchasePriceUSD: priceVal,
          isPdfSource: true
        });
      }
    }
  }
  
  return transactions;
}

// Parse EquatePlus Purchase Activity (Quarterly) Statement text
function parsePurchaseActivityStatement(cleanedText) {
  const lines = cleanedText.split('\n');
  const transactions = [];
  
  for (const line of lines) {
    // 1. Regular purchases
    const rowRegex = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+Participant\s+([\d\.,]+)\s+USD\s+([\d\.]+)\s+USD([\d\.,]+)\s+USD/g;
    let match;
    while ((match = rowRegex.exec(line)) !== null) {
      const purchaseDateStr = match[4];
      const contribution = parseFloat(match[5]);
      const qtyPriceStr = match[6];
      const fmv = parseFloat(match[7]);
      
      const date = parseEnglishDate(purchaseDateStr);
      const dotIndex = qtyPriceStr.indexOf('.');
      if (date && dotIndex !== -1) {
        const qtyStr = qtyPriceStr.substring(0, dotIndex + 6);
        const priceStr = qtyPriceStr.substring(dotIndex + 6);
        
        let quantity = parseFloat(qtyStr);
        let purchasePrice = parseFloat(priceStr);
        
        // Self-correcting merged digit
        if (contribution > 0 && Math.abs(quantity * purchasePrice - contribution) > 1.0) {
          for (let d = 1; d <= 9; d++) {
            let testPrice = parseFloat(d.toString() + priceStr);
            if (Math.abs(quantity * testPrice - contribution) < 1.0) {
              purchasePrice = testPrice;
              break;
            }
          }
        }
        
        if (quantity > 0) {
          transactions.push({
            type: 'Purchase Shares',
            date,
            dateStr: purchaseDateStr,
            quantity,
            fmvUSD: fmv,
            purchasePriceUSD: purchasePrice,
            isPdfSource: true
          });
        }
      }
    }
    
    // 2. Dividend reinvestments
    const divRegex = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+[\d\.]+\s+ESPP-PURCHASE\s+at\s+[\d\.]+\s+USD\s+rate\s+[\d\.]+\s+USD[\d\.]+\s+USD\s+([\d\.]+)\s*USD([\d\.]+)\s*USD/g;
    let divMatch;
    while ((divMatch = divRegex.exec(line)) !== null) {
      const dateStr = divMatch[1];
      const qtyPriceStr = divMatch[2];
      const netAmount = parseFloat(divMatch[3]);
      
      const date = parseEnglishDate(dateStr);
      const dotIndex = qtyPriceStr.indexOf('.');
      if (date && dotIndex !== -1) {
        const qtyStr = qtyPriceStr.substring(0, dotIndex + 6);
        const priceStr = qtyPriceStr.substring(dotIndex + 6);
        
        let quantity = parseFloat(qtyStr);
        let purchasePrice = parseFloat(priceStr);
        
        // Self-correcting merged digit for dividend
        if (netAmount > 0 && Math.abs(quantity * purchasePrice - netAmount) > 1.0) {
          for (let d = 1; d <= 9; d++) {
            let testPrice = parseFloat(d.toString() + priceStr);
            if (Math.abs(quantity * testPrice - netAmount) < 0.1) {
              purchasePrice = testPrice;
              break;
            }
          }
        }
        
        if (quantity > 0) {
          transactions.push({
            type: 'Dividend Shares',
            date,
            dateStr,
            quantity,
            fmvUSD: purchasePrice,
            purchasePriceUSD: purchasePrice,
            isPdfSource: true
          });
        }
      }
    }
  }
  return transactions;
}

// Parse a German-formatted date ("Dezember 31, 2024") into a JS Date.
function parseGermanDate(monthName, day, year) {
  const months = {
    jan: 0, feb: 1, 'mär': 2, mar: 2, apr: 3, mai: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dez: 11
  };
  const key = monthName.substring(0, 3).toLowerCase();
  const m = months[key];
  if (m === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, m, day);
}

// Parse CapTrader / IBKR Statement
function parseCapTraderStatement(text) {
  const sells = [];
  const transfers = [];
  let openPosition = null;
  let year = null;
  let endDate = null;

  // Statement period, e.g. "Januar 1, 2024 - Dezember 31, 2024" (CapTrader annual) or
  // "Mai 1, 2026 - Mai 31, 2026" (IBKR direct, monthly — doesn't start in January). Take the END date.
  const periodMatch = text.match(/([A-Za-zÄäÖöÜü]+)\s+\d{1,2},\s+\d{4}\s*[-–]\s*([A-Za-zÄäÖöÜü]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (periodMatch) {
    endDate = parseGermanDate(periodMatch[2], parseInt(periodMatch[3]), parseInt(periodMatch[4]));
    if (endDate && !year) year = endDate.getFullYear();
  }

  // Detect Year (fallback if the period parse above didn't set it)
  const yearMatch = text.match(/Umsatzübersicht.*?Dezember\s+\d{1,2},\s+(20\d{2})/i) ||
                    text.match(/Umsatzübersicht.*?Juni\s+\d{1,2},\s+(20\d{2})/i) ||
                    text.match(/Umsatzübersicht\s+-\s+Januar\s+\d{1,2},\s+\d{4}\s+-\s+\S+\s+\d{1,2},\s+(\d{4})/i) ||
                    text.match(/Januar\s+\d{1,2},\s+(\d{4})\s+-\s+/i);
  if (yearMatch && !year) {
    year = parseInt(yearMatch[1]);
  }

  // 1. Sells
  // Example: Aktien USD IBM 2025-01-30, 13:16:23 -10 256.2450 258.2700 2,562.45 -2.00 -1,578.59 981.86 -20.25 C
  const sellRegex = /(?:Aktien\s+USD\s+)?IBM\s+(\d{4}-\d{2}-\d{2}),?\s+(?:\d{2}:\d{2}:\d{2},?\s+)?(-\d+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,\-]+)\s+([\d\.,\-]+)\s+([\d\.,\-]+)\s+([\d\.,\-]+)\s+([\d\.,\-]+)\s+(?:C|O|A)/g;
  let match;
  while ((match = sellRegex.exec(text)) !== null) {
    const dateStr = match[1];
    const qty = parseInt(match[2]);
    const quantity = Math.abs(qty);
    const priceUSD = parseFloat(match[3]);
    const proceedsUSD = parseFloat(match[5].replace(/,/g, ''));
    const commissionUSD = parseFloat(match[6].replace(/,/g, ''));
    const realizedGainUSD = parseFloat(match[8].replace(/,/g, ''));
    
    sells.push({
      dateStr,
      quantity,
      priceUSD,
      proceedsUSD,
      commissionUSD,
      realizedGainUSD
    });
  }

  // 2. Transfers In (FOP In)
  // Example: Aktien USD IBM 2024-09-06 FOP In -- C0011801358 40 -- 8,103.60 0.00 0.00
  const transferRegex = /(?:Aktien\s+USD\s+)?IBM\s+(\d{4}-\d{2}-\d{2})\s+FOP\s+In\s+(?:--\s+)?(?:[A-Z0-9]+\s+)?(\d+)\s+(?:--\s+)?([\d\.,]+)/g;
  while ((match = transferRegex.exec(text)) !== null) {
    const dateStr = match[1];
    const quantity = parseInt(match[2]);
    const marketValueUSD = parseFloat(match[3].replace(/,/g, ''));
    
    transfers.push({
      dateStr,
      quantity,
      marketValueUSD
    });
  }

  // 3. Open Position (IBM aggregate row). Handles both CapTrader ("Aktien USD IBM 40 1 155.52575 …")
  // and IBKR direct statements ("…USD IBM - 11 1 214.38 …", which insert an "Offen" column with a
  // "-" placeholder). The "Offene Positionen" block is isolated first so we don't accidentally match
  // the IBM row in the Mark-to-Market section.
  const opSection = (/Offene Positionen([\s\S]*?)(?:Gesamtwert in EUR|Devisenpositionen|Transaktionen|Transfers)/.exec(text) || [null, ''])[1];
  const openPosRegex = /\bIBM\s+(?:-\s+)?(\d+)\s+1\s+([\d.,]+)\s+([\d.,\-]+)\s+([\d.,]+)\s+([\d.,\-]+)\s+([\d.,\-]+)/g;
  while ((match = openPosRegex.exec(opSection)) !== null) {
    openPosition = {
      quantity: parseInt(match[1]),
      averagePriceUSD: parseFloat(match[2].replace(/,/g, '')),
      costBasisUSD: parseFloat(match[3].replace(/,/g, '')),
      closingPriceUSD: parseFloat(match[4].replace(/,/g, '')),
      valueUSD: parseFloat(match[5].replace(/,/g, '')),
      unrealizedGainUSD: parseFloat(match[6].replace(/,/g, ''))
    };
  }

  // 4. Cash balances (Cash-Bericht). IBKR uses US number format (comma=thousands, dot=decimal).
  // Per-currency ending balance ("Endbarsaldo") and the base-currency total.
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  let cash = null;
  const usdCashM = /USD\s+Anfangsbarsaldo[\s\S]*?\bEndbarsaldo\s+([\d.,]+)/.exec(text);
  const eurCashM = /EUR\s+Anfangsbarsaldo[\s\S]*?\bEndbarsaldo\s+([\d.,]+)/.exec(text);
  const totalCashM = /Basiswährungsübersicht[\s\S]*?\bEndbarsaldo\s+([\d.,]+)/.exec(text);
  if (usdCashM || eurCashM || totalCashM) {
    const usd = usdCashM ? num(usdCashM[1]) : 0;
    const totalEUR = totalCashM ? num(totalCashM[1]) : null;
    // IBKR omits the per-currency EUR sub-block when EUR (the base currency) is the only cash —
    // then the base total IS the EUR cash.
    const eur = eurCashM ? num(eurCashM[1]) : (usd === 0 && totalEUR !== null ? totalEUR : 0);
    cash = { usd, eur, totalEUR };
  }

  return { year, endDate, sells, transfers, openPosition, cash };
}



// True when at least one platform's data is loaded (EquatePlus or CapTrader/IBKR).
// A partial analysis with only one platform is allowed — each statement is authoritative
// for its own depot; the combined total is then explicitly flagged as incomplete.
function hasAnyPortfolioData() {
  return (portfolioState.transactions && portfolioState.transactions.length > 0) ||
         (portfolioState.equatePlusHoldings && portfolioState.equatePlusHoldings.length > 0) ||
         Object.keys(portfolioState.capTraderPositions).length > 0;
}

// Analyze Portfolio. options.silent suppresses the status toasts (used for automatic
// re-analysis on page load / price refresh); errors are always shown.
async function analyzePortfolio(options = {}) {
  const silent = options.silent === true;
  if (!hasAnyPortfolioData()) return;

  if (!silent) showPortfolioStatus('Lade historische Kurse & Wechselkurse...', 'loading');

  try {
    // Valuation always uses the live market price + FX (set by fetchPortfolioPrice;
    // persisted last-known values until the first fetch answers).
    const exchangeRate = portfolioState.exchangeRate;
    const currentPrice = portfolioState.currentPrice;

    // EquatePlus balance is read directly from the latest Plan Holdings Statement (Page 2).
    const eqShares = portfolioState.equatePlusHeld || 0;
    portfolioState.equatePlusAvailableShares = eqShares;

    // Build the list of CURRENTLY-HELD lots from authoritative reported holdings ONLY
    // (no synthetic 2024 bridge lots, no purchase-pool guessing — that overcounted badly when
    // CapTrader statements were missing). Each held lot carries: what was paid (purchasePriceUSD)
    // and the tax cost basis (fmvUSD = undiscounted FMV).
    const heldLots = [];

    // a) EquatePlus held lots — exact, from the latest statement's Page 2 holdings list.
    (portfolioState.equatePlusHoldings || []).forEach(h => {
      if (h.quantity <= 0.00001) return;
      const isDiv = h.type === 'Dividend Shares';
      // Dividend rows have no FMV column (0) and weren't discounted -> tax basis = cost basis.
      const taxBasisUSD = (isDiv || !h.fmvUSD) ? h.costBasisUSD : h.fmvUSD;
      heldLots.push({
        date: h.date,
        dateStr: h.dateStr,
        type: h.type,
        source: 'EquatePlus',
        label: isDiv ? 'Dividende (EquatePlus)' : 'ESPP Kauf (EquatePlus)',
        quantity: h.quantity,
        remainingQuantity: h.quantity,
        purchasePriceUSD: h.costBasisUSD,
        fmvUSD: taxBasisUSD
      });
    });

    // b) CapTrader held position — aggregate, using CapTrader's own reported cost basis.
    const ctYears = Object.keys(portfolioState.capTraderPositions).map(Number);
    let ctHeld = 0;
    if (ctYears.length > 0) {
      const latestYear = Math.max(...ctYears);
      const pos = portfolioState.capTraderPositions[latestYear];
      if (pos && pos.quantity > 0) {
        ctHeld = pos.quantity;
        heldLots.push({
          // Dated earliest so FIFO treats the transferred CapTrader shares as the oldest.
          date: new Date(latestYear - 2, 0, 1),
          dateStr: 'CapTrader/IBKR Depot',
          type: 'Purchase Shares',
          source: 'CapTrader',
          label: 'CapTrader/IBKR Bestand (übertragen)',
          quantity: pos.quantity,
          remainingQuantity: pos.quantity,
          purchasePriceUSD: pos.averagePriceUSD,
          fmvUSD: pos.averagePriceUSD
        });
      }
    }

    heldLots.sort((a, b) => a.date - b.date);

    // Tag each lot with the USD→EUR rate at its purchase date (tax-correct EUR cost basis).
    await assignPurchaseRates(heldLots);

    portfolioState.heldLots = heldLots;
    portfolioState.activeLots = heldLots; // sell simulator draws cost basis from the held lots

    // "Im Besitz" = the two reported, settled holdings (EquatePlus + CapTrader).
    // In-transit shares are reported separately in the Depot-Konsolidierung card.
    portfolioState.totalCombinedShares = eqShares + ctHeld;
    portfolioState.capTraderHeldShares = ctHeld;

    displayPortfolioResults(heldLots);

    // Update Sell Simulator parameters (cap at shares actually held now)
    const totalShares = portfolioState.totalCombinedShares;
    portfolioElements.maxSellQuantityLabel.textContent = `/ ${totalShares.toFixed(5)}`;
    portfolioElements.sellQuantitySlider.max = totalShares.toFixed(5);
    portfolioElements.sellQuantity.max = totalShares.toFixed(5);
    if (silent) {
      // Background re-run (state restore / periodic price refresh): keep the user's
      // simulator inputs. The slider may have been clamped while its max was still
      // the HTML default — re-sync it now that the real max is set.
      portfolioElements.sellQuantitySlider.value = parseFloat(portfolioElements.sellQuantity.value) || 0;
    } else {
      // User-triggered analysis (upload / price check): start the simulation fresh,
      // but never overwrite a deliberately typed simulated Verkaufskurs.
      portfolioElements.sellQuantitySlider.value = 0;
      portfolioElements.sellQuantity.value = 0;
      const lastLive = portfolioState.lastLivePrice;
      const sellVal = parseFloat(portfolioElements.sellPrice.value);
      if (lastLive == null || !isFinite(sellVal) || Math.abs(sellVal - lastLive) < 0.01) {
        portfolioElements.sellPrice.value = currentPrice.toFixed(2);
      }
    }

    // Display card and run simulation once at 0 to clear
    showPortfolioCard(portfolioElements.portfolioSellSimulatorCard, 0.1);
    updateSellSimulation();

    // Refresh the goal tracker so it uses these real holdings.
    updateGoalTracker();

    // Steuerreport (Anlage KAP): replay the real sells against the purchase history.
    // Failures here must never break the analysis itself.
    try {
      await buildTaxReport();
    } catch (e) {
      console.error('Steuerreport konnte nicht erstellt werden:', e);
    }

    // Completed-status: flag a partial analysis when only one platform's statement is loaded.
    if (!silent) {
      const hasEqData = (portfolioState.equatePlusHoldings || []).length > 0 || portfolioState.transactions.length > 0;
      const hasCtData = Object.keys(portfolioState.capTraderPositions).length > 0;
      if (hasEqData && !hasCtData) {
        showPortfolioStatus('✓ Analyse abgeschlossen – nur EquatePlus. Lade zusätzlich ein <strong>CapTrader-/IBKR-Statement</strong> hoch, um auch Dein Verkaufs-Depot und den Gesamtbestand zu sehen.', 'warning');
      } else if (!hasEqData && hasCtData) {
        showPortfolioStatus('✓ Analyse abgeschlossen – nur CapTrader/IBKR. Lade zusätzlich ein <strong>EquatePlus Plan Holdings Statement</strong> hoch, um auch Dein Anspar-Depot und die Kaufhistorie zu sehen.', 'warning');
      } else {
        showPortfolioStatus('✓ Analyse abgeschlossen', 'success');
      }
    }
    savePortfolioState();
    
  } catch (error) {
    showPortfolioStatus('Fehler bei der Analyse: ' + error.message, 'error');
  }
}

// Fetch Historical Price for Specific Date
async function fetchHistoricalPriceForDate(date) {
  // Calculate period (get data for the week around the date)
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 7);
  
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  
  try {
    const data = await api.fetchHistoricalRange(period1, period2);

    if (data.success && data.prices && data.prices.length > 0) {
      // Find closest price to the target date
      const targetTime = date.getTime();
      let closestPrice = data.prices[0];
      let minDiff = Math.abs(data.prices[0].timestamp - targetTime);
      
      for (const priceData of data.prices) {
        const diff = Math.abs(priceData.timestamp - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPrice = priceData;
        }
      }
      
      return closestPrice.price;
    }
    
    // Fallback: use current price if historical data not available
    return portfolioState.currentPrice;
    
  } catch (error) {
    console.error('Error fetching historical price:', error);
    return portfolioState.currentPrice;
  }
}

// Fetch daily USD→EUR rates for a date range (one request) for purchase-date cost-basis conversion.
async function fetchHistoricalFxRange(startDate, endDate) {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  try {
    const data = await api.fetchForexRange(period1, period2);
    if (data.success && Array.isArray(data.rates) && data.rates.length > 0) return data.rates;
  } catch (error) {
    console.error('Error fetching historical FX:', error);
  }
  return null;
}

// Pick the rate closest in time to `date` from a list of {timestamp, rate}.
function pickRateForDate(rates, date) {
  if (!rates || !rates.length) return null;
  const t = date.getTime();
  let best = rates[0], min = Math.abs(rates[0].timestamp - t);
  for (const r of rates) {
    const diff = Math.abs(r.timestamp - t);
    if (diff < min) { min = diff; best = r; }
  }
  return best.rate;
}

// Tag each held lot with the USD→EUR rate AT ITS PURCHASE DATE so the EUR cost basis is the
// tax-correct value (German Anlage KAP: acquisition cost converted at the purchase-day rate, sale
// proceeds at the sale-day rate). Falls back to the current rate if history is unavailable.
async function assignPurchaseRates(lots) {
  const current = portfolioState.exchangeRate;
  const dated = lots.filter(l => l.date instanceof Date && !isNaN(l.date));
  if (!dated.length) { lots.forEach(l => { l.purchaseRate = current; }); return; }
  const min = new Date(Math.min(...dated.map(l => l.date.getTime())));
  const max = new Date(Math.max(...dated.map(l => l.date.getTime())));
  min.setDate(min.getDate() - 7);
  max.setDate(max.getDate() + 7);
  const rates = await fetchHistoricalFxRange(min, max);
  let usedHistorical = false;
  lots.forEach(l => {
    const r = (l.date instanceof Date && !isNaN(l.date)) ? pickRateForDate(rates, l.date) : null;
    if (r) usedHistorical = true;
    l.purchaseRate = r || current;
  });
  portfolioState.fxAtPurchaseUsed = usedHistorical;
}

// Simulate selling `qtyToSell` shares from `lots` (FIFO, oldest first) at `sellPriceUSD`,
// applying German capital-gains tax (Abgeltungsteuer, church-aware) and the chosen broker's fees.
// Shared by the Verkauf-Simulator and the "Netto-Gewinn bei Verkauf jetzt" holdings summary.
function simulateSale(lots, qtyToSell, sellPriceUSD, broker) {
  const sellRate = portfolioState.exchangeRate; // proceeds convert at the current (sale-day) rate
  const sorted = [...lots].sort((a, b) => a.date - b.date);

  let remaining = qtyToSell;
  const soldLots = [];
  for (const t of sorted) {
    if (remaining <= 0) break;
    const qtyInLot = t.remainingQuantity ?? t.quantity;
    // Guard against malformed lots so a missing field can never poison the totals with NaN.
    if (!(qtyInLot > 0)) continue;
    const paidUSD = Number.isFinite(t.purchasePriceUSD) ? t.purchasePriceUSD : 0;
    const taxBasisUSD = Number.isFinite(t.fmvUSD) ? t.fmvUSD : paidUSD;
    // Cost basis converts at the FX rate on the PURCHASE date (German tax rule); fall back to the
    // current rate for lots without a known purchase-date rate (e.g. legacy saved state).
    const buyRate = Number.isFinite(t.purchaseRate) ? t.purchaseRate : sellRate;
    const qtySold = Math.min(remaining, qtyInLot);
    if (qtySold <= 0) continue;
    remaining -= qtySold;
    const cashCostEUR = qtySold * paidUSD * buyRate;
    const taxCostEUR = qtySold * taxBasisUSD * buyRate;
    const revenueEUR = qtySold * sellPriceUSD * sellRate;
    soldLots.push({
      dateStr: t.dateStr,
      type: t.type,
      quantity: qtySold,
      purchasePriceUSD: paidUSD,
      cashCostEUR,
      taxCostEUR,
      revenueEUR,
      netProfitEUR: revenueEUR - cashCostEUR,
      // Per-lot gain/loss vs. the tax basis. May be negative: within one sale, losses on
      // expensive lots offset gains on cheap lots (Aktien-Verlustverrechnung, § 20 Abs. 6 EStG).
      taxableGainEUR: revenueEUR - taxCostEUR
    });
  }

  const totalProceedsEUR = soldLots.reduce((s, l) => s + l.revenueEUR, 0);
  const totalCashCostEUR = soldLots.reduce((s, l) => s + l.cashCostEUR, 0);
  // Only a positive NET gain across all sold lots is taxed.
  const totalTaxableGainEUR = Math.max(0, soldLots.reduce((s, l) => s + l.taxableGainEUR, 0));

  // Abgeltungsteuer 26,375 % (+ Kirchensteuer-Varianten). Sparer-Pauschbetrag nicht automatisch.
  const churchTaxPercent = parseInt(document.getElementById('selectChurchTax')?.value) || 0;
  const taxRate = getAbgeltungRate(churchTaxPercent / 100);
  const totalTaxEUR = totalTaxableGainEUR * taxRate;

  // Broker fees (single source: js/tax.js — shared with the Rechner).
  const totalFeesEUR = (qtyToSell > 0 && soldLots.length > 0)
    ? computeBrokerFees(broker, totalProceedsEUR, sellRate)
    : 0;

  return {
    soldLots,
    totalProceedsEUR,
    totalCashCostEUR,
    totalTaxableGainEUR,
    totalTaxEUR,
    totalFeesEUR,
    netProfitEUR: totalProceedsEUR - totalCashCostEUR - totalTaxEUR - totalFeesEUR,
    cashoutEUR: totalProceedsEUR - totalTaxEUR - totalFeesEUR,
    soldQuantity: qtyToSell - remaining
  };
}

// Update Sell Simulation in Real-Time
function updateSellSimulation() {
  // FIFO cost basis is drawn from the still-owned lots (oldest first), not the full purchase history.
  const lots = (portfolioState.activeLots && portfolioState.activeLots.length > 0)
    ? portfolioState.activeLots
    : portfolioState.enrichedTransactions;
  if (!lots || lots.length === 0) return;

  let sellQty = parseFloat(portfolioElements.sellQuantity.value) || 0;
  const sellP = parseFloat(portfolioElements.sellPrice.value) || 0;
  const broker = portfolioElements.sellBroker.value;

  const totalShares = portfolioState.totalCombinedShares !== undefined
    ? portfolioState.totalCombinedShares
    : lots.reduce((sum, t) => sum + (t.remainingQuantity ?? t.quantity), 0);

  if (sellQty > totalShares) {
    sellQty = totalShares;
    portfolioElements.sellQuantity.value = totalShares.toFixed(5);
    portfolioElements.sellQuantitySlider.value = totalShares;
  }

  const r = simulateSale(lots, sellQty, sellP, broker);

  // Render metrics with animated counters; slider drags fire many updates per
  // second, so flag rapid recalcs the same way the Rechner does (shorter tween).
  const nowTs = performance.now();
  state.rapidRecalc = nowTs - (state.lastCalcTs || 0) < 250;
  state.lastCalcTs = nowTs;

  animateNumberValue('simValProceeds', r.totalProceedsEUR, formatEuro);
  animateNumberValue('simValCashCost', r.totalCashCostEUR, formatEuro);
  animateNumberValue('simValTaxableGain', r.totalTaxableGainEUR, formatEuro);
  animateNumberValue('simValTax', r.totalTaxEUR, formatEuro);
  animateNumberValue('simValFees', r.totalFeesEUR, formatEuro);
  animateNumberValue('simValNetProfit', r.netProfitEUR, (v) => (v >= 0 ? '+' : '') + formatEuro(v));
  portfolioElements.simValNetProfit.className = r.netProfitEUR >= 0 ? 'value-positive' : 'value-negative';
  animateNumberValue('simValCashout', r.cashoutEUR, formatEuro);

  // Render FIFO Lot breakdown
  if (r.soldLots.length === 0) {
    portfolioElements.fifoLotBreakdownContainer.style.display = 'none';
  } else {
    portfolioElements.fifoLotBreakdownContainer.style.display = 'block';
    let tableRowsHTML = '';
    r.soldLots.forEach(lot => {
      tableRowsHTML += `
        <tr>
          <td>${lot.dateStr}</td>
          <td>${lot.type === 'Dividend Shares' ? 'Dividende' : 'Kauf'}</td>
          <td>${lot.quantity.toFixed(5)}</td>
          <td>$${lot.purchasePriceUSD.toFixed(2)}</td>
          <td>${formatEuro(lot.cashCostEUR)}</td>
          <td>${formatEuro(lot.taxCostEUR)}</td>
          <td class="${lot.netProfitEUR >= 0 ? 'value-positive' : 'value-negative'}">
            ${lot.netProfitEUR >= 0 ? '+' : ''}${formatEuro(lot.netProfitEUR)}
          </td>
          <td>${formatEuro(lot.taxableGainEUR)}</td>
        </tr>
      `;
    });
    portfolioElements.fifoLotBreakdownBody.innerHTML = tableRowsHTML;
  }
  
  savePortfolioState();
}

// Display Portfolio Results
// ===== Steuerreport (Anlage KAP) =====================================================
// Replays the REAL sells from the CapTrader statements chronologically against the
// EquatePlus purchase history (FIFO). Each matched slice converts its two legs at the
// respective day's USD→EUR rate: acquisition cost (tax basis = FMV at purchase, since
// the 15% discount was payroll-taxed) at the purchase-day rate, proceeds and fees at
// the sale-day rate. Grouped per tax year — the figures users need for the Anlage KAP.

function fmtTaxDate(d) {
  return d instanceof Date && !isNaN(d)
    ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '–';
}

async function buildTaxReport() {
  const card = portfolioElements.portfolioTaxReportCard;
  const content = portfolioElements.taxReportContent;
  const badge = portfolioElements.taxReportBadge;
  if (!card || !content) return;

  const sells = (portfolioState.capTraderSells || [])
    .map(s => ({ ...s, date: new Date(s.dateStr) }))
    .filter(s => s.date instanceof Date && !isNaN(s.date) && s.quantity > 0)
    .sort((a, b) => a.date - b.date);

  showPortfolioCard(card, 0.25);

  if (!sells.length) {
    if (badge) badge.textContent = 'Keine Verkäufe';
    content.innerHTML = `
      <div class="detail-note" style="margin-top: 14px;">
        <i class="fa-solid fa-circle-info"></i> Sobald Deine CapTrader-/IBKR-Statements
        <strong>Verkäufe</strong> enthalten, erscheint hier automatisch eine Aufstellung der
        steuerpflichtigen Gewinne pro Steuerjahr (FIFO, EUR-Umrechnung zum jeweiligen
        Tageskurs) – als Vorlage für die Anlage KAP, inklusive CSV-Export.
      </div>`;
    return;
  }
  if (badge) badge.textContent = `${sells.length} Verkäufe`;

  const lots = (portfolioState.transactions || [])
    .filter(t => t.quantity > 0.00001 && t.date instanceof Date && !isNaN(t.date))
    .sort((a, b) => a.date - b.date)
    .map(t => ({ ...t, left: t.quantity }));

  if (!lots.length) {
    content.innerHTML = `
      <div class="detail-note" style="margin-top: 14px; color: var(--warning);">
        <i class="fa-solid fa-triangle-exclamation"></i> Es wurden <strong>${sells.length} Verkäufe</strong>
        gefunden, aber keine EquatePlus-Kaufhistorie. Lade Deine <strong>Plan Holdings Statements</strong>
        hoch, damit die Anschaffungskosten der verkauften Aktien (FIFO) ermittelt werden können.
      </div>`;
    return;
  }

  // Day-accurate USD→EUR rates for every buy AND sell date, fetched in one request.
  const allDates = [...lots.map(l => l.date), ...sells.map(s => s.date)];
  const min = new Date(Math.min(...allDates.map(d => d.getTime())));
  const max = new Date(Math.max(...allDates.map(d => d.getTime())));
  min.setDate(min.getDate() - 7);
  max.setDate(max.getDate() + 7);
  const rates = await fetchHistoricalFxRange(min, max);
  const currentRate = portfolioState.exchangeRate;
  const fxFor = (d) => pickRateForDate(rates, d) || currentRate;

  // FIFO replay: each sale consumes the oldest lots existing at its date. The gain of
  // ONE sale is netted across its consumed lots (one Veräußerungsgeschäft); per year,
  // gains and losses of separate sales are summed separately (Anlage KAP lines differ).
  const saleResults = [];
  let unmatchedShares = 0;
  sells.forEach(sell => {
    let remaining = sell.quantity;
    const fxSell = fxFor(sell.date);
    const feeTotalEUR = Math.abs(sell.commissionUSD || 0) * fxSell;
    const slices = [];
    for (const lot of lots) {
      if (remaining <= 1e-9) break;
      if (lot.date > sell.date) break; // lots are sorted; nothing later can be sold here
      if (lot.left <= 1e-9) continue;
      const qty = Math.min(remaining, lot.left);
      lot.left -= qty;
      remaining -= qty;
      const fxBuy = fxFor(lot.date);
      const taxBasisUSD = Number.isFinite(lot.fmvUSD) ? lot.fmvUSD : lot.purchasePriceUSD;
      const basisEUR = qty * taxBasisUSD * fxBuy;
      const proceedsEUR = qty * sell.priceUSD * fxSell;
      const feeEUR = feeTotalEUR * (qty / sell.quantity);
      slices.push({
        buyDate: lot.date,
        type: lot.type,
        qty,
        taxBasisUSD,
        basisEUR,
        proceedsEUR,
        feeEUR,
        gainEUR: proceedsEUR - feeEUR - basisEUR
      });
    }
    if (remaining > 1e-6) unmatchedShares += remaining;
    if (slices.length) {
      saleResults.push({
        date: sell.date,
        year: sell.date.getFullYear(),
        priceUSD: sell.priceUSD,
        realizedGainUSD: sell.realizedGainUSD,
        slices,
        gainEUR: slices.reduce((s, x) => s + x.gainEUR, 0)
      });
    }
  });

  // ---- Render: one section per tax year, newest first ----
  const years = [...new Set(saleResults.map(r => r.year))].sort((a, b) => b - a);
  let html = '';

  if (unmatchedShares > 1e-6) {
    html += `
      <div class="detail-note" style="margin-top: 14px; color: var(--warning);">
        <i class="fa-solid fa-triangle-exclamation"></i> <strong>${unmatchedShares.toFixed(2)} verkaufte
        Aktien</strong> konnten keinem Kauf zugeordnet werden – vermutlich ist die EquatePlus-Kaufhistorie
        unvollständig. Diese Aktien fehlen in den Summen. Bitte lade alle Plan Holdings Statements seit
        Deinem Beitritt hoch.
      </div>`;
  }
  if (!rates) {
    html += `
      <div class="detail-note" style="margin-top: 14px; color: var(--warning);">
        <i class="fa-solid fa-triangle-exclamation"></i> Historische Wechselkurse waren nicht abrufbar –
        alle EUR-Beträge wurden ersatzweise zum <strong>aktuellen</strong> Kurs umgerechnet und sind für die
        Steuererklärung so nicht verwendbar. Bitte später erneut analysieren.
      </div>`;
  }

  years.forEach(year => {
    const yearSales = saleResults.filter(r => r.year === year);
    const gains = yearSales.filter(r => r.gainEUR > 0).reduce((s, r) => s + r.gainEUR, 0);
    const losses = yearSales.filter(r => r.gainEUR < 0).reduce((s, r) => s + Math.abs(r.gainEUR), 0);
    const ibkrUSD = yearSales.reduce((s, r) => s + (Number.isFinite(r.realizedGainUSD) ? r.realizedGainUSD : 0), 0);

    let rowsHtml = '';
    yearSales.forEach(sale => {
      sale.slices.forEach((sl, i) => {
        rowsHtml += `
          <tr>
            <td>${i === 0 ? fmtTaxDate(sale.date) : ''}</td>
            <td>${fmtTaxDate(sl.buyDate)}<br><span class="tax-lot-type">${sl.type === 'Dividend Shares' ? 'Dividende' : 'ESPP Kauf'}</span></td>
            <td>${sl.qty.toFixed(5)}</td>
            <td>${formatEuro(sl.basisEUR)}</td>
            <td>${formatEuro(sl.proceedsEUR)}</td>
            <td>${sl.feeEUR > 0.004 ? formatEuro(sl.feeEUR) : '–'}</td>
            <td class="${sl.gainEUR >= 0 ? 'value-positive' : 'value-negative'}">${sl.gainEUR >= 0 ? '+' : ''}${formatEuro(sl.gainEUR)}</td>
          </tr>`;
      });
      if (sale.slices.length > 1) {
        rowsHtml += `
          <tr class="tax-sale-subtotal">
            <td colspan="6">Veräußerungsgeschäft vom ${fmtTaxDate(sale.date)} (gesamt)</td>
            <td class="${sale.gainEUR >= 0 ? 'value-positive' : 'value-negative'}"><strong>${sale.gainEUR >= 0 ? '+' : ''}${formatEuro(sale.gainEUR)}</strong></td>
          </tr>`;
      }
    });

    html += `
      <div class="tax-year-section">
        <div class="tax-year-head">
          <h4><i class="fa-solid fa-calendar-check"></i> Steuerjahr ${year}</h4>
          <button class="btn btn-outline btn-sm btn-tax-csv" data-year="${year}">
            <i class="fa-solid fa-file-csv"></i> CSV exportieren
          </button>
        </div>
        <div class="table-responsive">
          <table class="portfolio-table tax-report-table">
            <thead>
              <tr>
                <th>Verkauf</th>
                <th>Kauf (FIFO)</th>
                <th>Stück</th>
                <th>Steuerl. Einstand (EUR)<br><span class="th-sub">Kauftags-Kurs</span></th>
                <th>Erlös (EUR)<br><span class="th-sub">Verkaufstags-Kurs</span></th>
                <th>Gebühren (EUR)</th>
                <th>Gewinn / Verlust (EUR)</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="tax-kap-summary">
          <div class="tax-kap-line">
            <span>Summe <strong>Gewinne</strong> aus Aktienveräußerungen ${year}</span>
            <strong class="value-positive">${formatEuro(gains)}</strong>
          </div>
          <div class="tax-kap-line">
            <span>Summe <strong>Verluste</strong> aus Aktienveräußerungen ${year}</span>
            <strong class="${losses > 0 ? 'value-negative' : ''}">${losses > 0 ? '−' + formatEuro(losses).replace('-', '') : formatEuro(0)}</strong>
          </div>
          <div class="tax-kap-hint">
            Gewinne und Verluste aus Aktien gehören in der Anlage KAP in <strong>getrennte Zeilen</strong>
            (ausländische Kapitalerträge ohne inländischen Steuerabzug; Formular 2024: Zeile 18 –
            darin Aktiengewinne Zeile 20, Aktienverluste Zeile 23 – die Zeilennummern können je nach
            Formularjahr abweichen).
            ${Number.isFinite(ibkrUSD) && ibkrUSD !== 0 ? `Zum Abgleich: IBKR weist für ${year} <strong>$${ibkrUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> aus (USD, eigene Kostenbasis – für die deutsche Steuer nicht maßgeblich).` : ''}
          </div>
        </div>
      </div>`;
  });

  html += `
    <div class="detail-note" style="margin-top: 16px;">
      <i class="fa-solid fa-scale-balanced"></i> <strong>Hinweise:</strong> FIFO wird hier
      depotübergreifend vereinfacht angewendet (streng gilt FIFO je Depot). Steuerlicher Einstand =
      Marktwert (FMV) am Kauftag, da der 15%-Rabatt bereits über die Gehaltsabrechnung versteuert wurde.
      Wechselkurse: Yahoo-Tageskurse (statt amtlicher EZB-Referenzkurse) – geringfügige Abweichungen
      möglich. Dividenden­erträge sind hier nicht enthalten. Keine Steuerberatung; bitte vor Abgabe prüfen.
    </div>`;

  content.innerHTML = html;

  // Keep the per-year rows for the CSV export and wire the buttons.
  portfolioState.taxReportByYear = {};
  years.forEach(y => { portfolioState.taxReportByYear[y] = saleResults.filter(r => r.year === y); });
  content.querySelectorAll('.btn-tax-csv').forEach(btn => {
    btn.addEventListener('click', () => downloadTaxReportCsv(parseInt(btn.dataset.year)));
  });
}

// Build and download a German-Excel-friendly CSV (semicolon-separated, decimal comma, BOM).
function downloadTaxReportCsv(year) {
  const sales = (portfolioState.taxReportByYear || {})[year];
  if (!sales || !sales.length) return;

  const num = (v) => v.toFixed(2).replace('.', ',');
  const lines = [
    `Steuerreport ${year} – Aktienveräußerungen (FIFO, EUR zum jeweiligen Tageskurs)`,
    'Verkaufsdatum;Kaufdatum;Typ;Stück;Steuerlicher Einstand (EUR);Veräußerungserlös (EUR);Gebühren (EUR);Gewinn/Verlust (EUR)'
  ];
  let gains = 0, losses = 0;
  sales.forEach(sale => {
    sale.slices.forEach(sl => {
      lines.push([
        fmtTaxDate(sale.date),
        fmtTaxDate(sl.buyDate),
        sl.type === 'Dividend Shares' ? 'Dividende' : 'ESPP Kauf',
        sl.qty.toFixed(5).replace('.', ','),
        num(sl.basisEUR),
        num(sl.proceedsEUR),
        num(sl.feeEUR),
        num(sl.gainEUR)
      ].join(';'));
    });
    if (sale.gainEUR > 0) gains += sale.gainEUR; else losses += Math.abs(sale.gainEUR);
  });
  lines.push('');
  lines.push(`Summe Gewinne aus Aktienveräußerungen;;;;;;;${num(gains)}`);
  lines.push(`Summe Verluste aus Aktienveräußerungen;;;;;;;${num(losses)}`);
  lines.push('Hinweis: FIFO depotübergreifend vereinfacht; Einstand = FMV am Kauftag; Yahoo-Tageskurse; keine Steuerberatung.');

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `steuerreport_${year}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// Cumulative invested vs. market value over the ESPP purchase history, ending at
// today's price. Built entirely from the imported statements (each lot's
// purchase-month FMV and FX where known) — no extra network fetches.
function renderPortfolioChart() {
  const canvas = document.getElementById('portfolioChart');
  const wrap = document.getElementById('pfChartWrap');
  if (!canvas || !wrap) return;

  const buys = (portfolioState.transactions || [])
    .filter(t => t.quantity > 0.00001 && t.date)
    .sort((a, b) => a.date - b.date);
  if (buys.length < 2) {
    // CapTrader-only imports have no purchase history to plot.
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';

  const rate = portfolioState.exchangeRate;
  const labels = [];
  const invested = [];
  const value = [];
  let cumShares = 0;
  let cumInvested = 0;
  buys.forEach(t => {
    const fx = Number.isFinite(t.purchaseRate) ? t.purchaseRate : rate;
    // Dividend shares are bought at market; ESPP lots carry the 15% discount.
    const marketUSD = t.fmvUSD || (t.type === 'Dividend Shares' ? t.purchasePriceUSD : t.purchasePriceUSD / 0.85);
    cumShares += t.quantity;
    cumInvested += t.quantity * t.purchasePriceUSD * fx;
    labels.push(t.date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }));
    invested.push(cumInvested);
    value.push(cumShares * marketUSD * fx);
  });
  labels.push('Heute');
  invested.push(cumInvested);
  value.push(cumShares * portfolioState.currentPrice * rate);

  const palette = chartPalette(); // [savings, tax, fees, profit]
  const theme = chartThemeColors();
  const data = {
    labels,
    datasets: [
      {
        label: 'Marktwert',
        data: value,
        borderColor: palette[3],
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
      },
      {
        label: 'Investiert (kumuliert)',
        data: invested,
        borderColor: palette[0],
        backgroundColor: 'transparent',
        fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2, borderDash: [5, 4]
      }
    ]
  };

  if (state.portfolioChart) {
    state.portfolioChart.data = data;
    state.portfolioChart.update();
    return;
  }
  state.portfolioChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion() ? false : undefined,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, labels: { color: theme.tick, boxWidth: 18, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${formatEuro(c.raw)}` } }
      },
      scales: {
        x: { grid: { color: theme.grid }, ticks: { color: theme.tick, maxTicksLimit: 8, font: { size: 10 } } },
        y: {
          grid: { color: theme.grid },
          ticks: {
            color: theme.tick, font: { size: 10 },
            callback: (v) => v >= 1000
              ? `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
              : `${v} €`
          }
        }
      }
    }
  });
}

// Live summaries in the (collapsed) import-step headers, mirroring the Rechner.
function updatePortfolioStepSummaries() {
  const s1 = document.getElementById('pfSummaryStep1');
  if (s1) {
    const buys = (portfolioState.transactions || []).length;
    const hasCt = Object.keys(portfolioState.capTraderPositions || {}).length > 0;
    const shares = portfolioState.totalCombinedShares !== undefined
      ? ` · ${portfolioState.totalCombinedShares.toFixed(2)} Aktien`
      : '';
    s1.textContent = (buys || hasCt)
      ? `${buys} Käufe${hasCt ? ' · CapTrader ✓' : ''}${shares}`
      : '';
  }
}

// "Meine IBM Aktien": ~50 expanded monthly buy rows made the page enormous.
// Show only the newest rows by default with an expander button underneath.
const BUY_TABLE_PREVIEW_ROWS = 10;
let buyTableExpanded = false; // survives re-analysis within the session

function setupBuyTableCollapse() {
  const body = portfolioElements.equateplusBuyBody;
  const btn = document.getElementById('btnToggleAllBuys');
  if (!body || !btn) return;

  const rows = [...body.rows];
  const extra = rows.slice(BUY_TABLE_PREVIEW_ROWS);
  const buyCount = rows.filter(r => !r.classList.contains('dividend-separator')).length;

  // Not worth an expander for one or two surplus rows.
  if (extra.length <= 2) {
    btn.style.display = 'none';
    return;
  }

  const setCollapsed = (collapsed, animate) => {
    buyTableExpanded = !collapsed;
    extra.forEach(r => { r.style.display = collapsed ? 'none' : ''; });
    btn.innerHTML = collapsed
      ? `<i class="fa-solid fa-chevron-down"></i> Alle ${buyCount} Käufe anzeigen`
      : `<i class="fa-solid fa-chevron-up"></i> Nur die letzten ${BUY_TABLE_PREVIEW_ROWS} Käufe zeigen`;
    if (!collapsed && animate && !prefersReducedMotion()) {
      gsap.fromTo(extra,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, stagger: 0.012, ease: 'power1.out', clearProps: 'opacity' });
    }
  };

  btn.style.display = '';
  btn.onclick = () => setCollapsed(buyTableExpanded, true);
  setCollapsed(!buyTableExpanded, false);
}

// Reveal a result card that was display:none — a soft slide-in instead of a pop.
// Already-visible cards are left untouched (recalcs must not re-animate them).
function showPortfolioCard(el, delay = 0) {
  if (!el || el.style.display !== 'none') return;
  el.style.display = 'block';
  if (prefersReducedMotion()) return;
  gsap.fromTo(el,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.5, delay, ease: 'power2.out', clearProps: 'opacity,transform' }
  );
}

function displayPortfolioResults(transactions) {
  const rate = portfolioState.exchangeRate;
  const price = portfolioState.currentPrice;

  // ---- Currently OWNED shares (FIFO-remaining lots, incl. CapTrader, EquatePlus & in-transit) ----
  const heldLots = (portfolioState.activeLots || [])
    .map(l => {
      const qty = l.remainingQuantity ?? l.quantity;
      const buyRate = Number.isFinite(l.purchaseRate) ? l.purchaseRate : rate; // FX at purchase date
      const einstandEUR = qty * l.purchasePriceUSD * buyRate; // what was actually paid (purchase-day FX)
      const currentValueEUR = qty * price * rate;
      return {
        date: l.date,
        dateStr: l.dateStr,
        type: l.type,
        label: l.label,
        qty,
        purchasePriceUSD: l.purchasePriceUSD,
        purchasePriceEUR: l.purchasePriceUSD * buyRate,
        buyRate,
        einstandEUR,
        currentValueEUR,
        unrealizedEUR: currentValueEUR - einstandEUR,
        performancePercent: l.purchasePriceUSD > 0 ? ((price - l.purchasePriceUSD) / l.purchasePriceUSD) * 100 : 0
      };
    })
    .filter(l => l.qty > 0.00001)
    .sort((a, b) => a.date - b.date);

  const totalHeldShares = heldLots.reduce((s, l) => s + l.qty, 0);
  const totalEinstandEUR = heldLots.reduce((s, l) => s + l.einstandEUR, 0);
  const totalEinstandUSD = heldLots.reduce((s, l) => s + l.qty * l.purchasePriceUSD, 0);
  const totalCurrentValueEUR = heldLots.reduce((s, l) => s + l.currentValueEUR, 0);
  const totalUnrealizedEUR = totalCurrentValueEUR - totalEinstandEUR;
  const unrealizedPct = totalEinstandEUR > 0 ? (totalUnrealizedEUR / totalEinstandEUR) * 100 : 0;

  // Net profit if ALL currently-owned shares were sold now at the current price (CapTrader route).
  // NOTE: must use the RAW held lots (quantity/remainingQuantity/fmvUSD), not the mapped display
  // objects above (which only carry qty/purchasePriceUSD) — otherwise simulateSale returns NaN.
  const saleNow = simulateSale(portfolioState.heldLots || [], totalHeldShares, price, 'broker-c');

  // Context: breakdown by platform + notes about in-transit / missing CapTrader statement.
  const eqHeldNow = portfolioState.equatePlusAvailableShares || 0;
  const ctHeldNow = portfolioState.capTraderHeldShares || 0;
  const inTransitNow = getInTransitShares();
  const hasCapTrader = Object.keys(portfolioState.capTraderPositions).length > 0;
  const hasEquatePlus = (portfolioState.equatePlusHoldings || []).length > 0;
  const besitzSubtitle = (hasEquatePlus && hasCapTrader)
    ? `${eqHeldNow.toFixed(2)} EquatePlus + ${ctHeldNow.toFixed(0)} CapTrader/IBKR`
    : (hasCapTrader ? `CapTrader-/IBKR-Depot` : `EquatePlus-Depot`);
  let holdingsNote = '';
  if (hasEquatePlus && !hasCapTrader) {
    holdingsNote = `<i class="fa-solid fa-circle-info"></i> Nur EquatePlus-Bestand. Lade ein <strong>CapTrader-/IBKR-Statement</strong> hoch, um Deine dorthin übertragenen Aktien zu sehen.`;
  } else if (hasCapTrader && !hasEquatePlus) {
    holdingsNote = `<i class="fa-solid fa-circle-info"></i> Nur CapTrader-/IBKR-Bestand. Lade ein <strong>EquatePlus Plan Holdings Statement</strong> hoch, um auch Dein Anspar-Depot und die ESPP-Kaufhistorie zu sehen.`;
  } else if (inTransitNow > 0.5) {
    holdingsNote = `<i class="fa-solid fa-clock-rotate-left"></i> Zusätzlich <strong>${inTransitNow.toFixed(0)} Aktien im Übertrag</strong> (noch nicht im CapTrader-/IBKR-Bestand enthalten) – siehe Depot-Konsolidierung.`;
  }

  // ---- Summary (top "Portfolio-Übersicht" panel): focus on holdings + net-if-sold-now ----
  // Build the skeleton once (chart + four stat boxes), then always update the
  // values in place via animated counters — first render counts up from 0.
  const existingSummary = portfolioElements.portfolioResults.querySelector('.portfolio-summary');
  const existingBoxes = existingSummary ? existingSummary.querySelectorAll('.portfolio-stat-box') : [];

  if (!(existingSummary && existingBoxes.length === 4)) {
    // The old canvas (if any) is discarded with the innerHTML — drop its chart too.
    if (state.portfolioChart) { state.portfolioChart.destroy(); state.portfolioChart = null; }
    portfolioElements.portfolioResults.innerHTML = `
      <div class="pf-chart-wrap" id="pfChartWrap" style="display: none;">
        <canvas id="portfolioChart"></canvas>
        <div class="pf-chart-caption">Kaufhistorie aller ESPP-Käufe – spätere Verkäufe/Überträge nicht abgezogen</div>
      </div>
      <div class="portfolio-summary">
        <div class="portfolio-stat-box">
          <span class="portfolio-stat-label">Aktuell im Besitz</span>
          <div class="portfolio-stat-value" id="pfStatShares">0.00</div>
          <div class="portfolio-stat-subtitle" id="pfStatSharesSub"></div>
        </div>
        <div class="portfolio-stat-box">
          <span class="portfolio-stat-label">Einstand (gezahlt)</span>
          <div class="portfolio-stat-value" id="pfStatCost">0,00 €</div>
          <div class="portfolio-stat-subtitle" id="pfStatCostSub"></div>
        </div>
        <div class="portfolio-stat-box">
          <span class="portfolio-stat-label">Aktueller Wert</span>
          <div class="portfolio-stat-value" id="pfStatValue">0,00 €</div>
          <div class="portfolio-stat-subtitle" id="pfStatValueSub"></div>
        </div>
        <div class="portfolio-stat-box" style="border: 1px solid rgba(0,242,254,0.25);">
          <span class="portfolio-stat-label">Netto-Gewinn bei Verkauf jetzt</span>
          <div class="portfolio-stat-value" id="pfStatNet">0,00 €</div>
          <div class="portfolio-stat-subtitle" id="pfStatNetSub"></div>
        </div>
      </div>
    `;
  }

  animateNumberValue('pfStatShares', totalHeldShares, (v) => v.toFixed(2));
  document.getElementById('pfStatSharesSub').textContent = besitzSubtitle;

  animateNumberValue('pfStatCost', totalEinstandEUR, formatEuro);
  document.getElementById('pfStatCostSub').textContent =
    `Ø $${totalHeldShares > 0 ? (totalEinstandUSD / totalHeldShares).toFixed(2) : '0.00'} / Aktie${portfolioState.fxAtPurchaseUsed ? ' · EUR zum Kauftags-Kurs' : ''}`;

  animateNumberValue('pfStatValue', totalCurrentValueEUR, formatEuro);
  document.getElementById('pfStatValueSub').innerHTML = `
    <span class="performance-badge ${totalUnrealizedEUR >= 0 ? 'positive' : 'negative'}">
      ${totalUnrealizedEUR >= 0 ? '+' : ''}${formatEuro(totalUnrealizedEUR)} (${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(1)}%)
    </span>
  `;

  const netProfitVal = document.getElementById('pfStatNet');
  netProfitVal.className = `portfolio-stat-value ${saleNow.netProfitEUR >= 0 ? 'positive' : 'negative'}`;
  animateNumberValue('pfStatNet', saleNow.netProfitEUR, (v) => `${v >= 0 ? '+' : ''}${formatEuro(v)}`);
  document.getElementById('pfStatNetSub').innerHTML = `bei $${price.toFixed(2)}, nach Steuer (${formatEuro(saleNow.totalTaxEUR)}) &amp; Gebühren`;

  let noteEl = portfolioElements.portfolioResults.querySelector('.detail-note');
  if (holdingsNote) {
    if (noteEl) {
      noteEl.innerHTML = holdingsNote;
      noteEl.style.display = 'block';
    } else {
      const div = document.createElement('div');
      div.className = 'detail-note';
      div.style.marginTop = '14px';
      div.innerHTML = holdingsNote;
      portfolioElements.portfolioResults.appendChild(div);
    }
  } else if (noteEl) {
    noteEl.style.display = 'none';
  }

  renderPortfolioChart();
  updatePortfolioStepSummaries();

  // Feed the condensed sticky strip (shared with the Rechner) with this tab's figures.
  state.stickyKpisPortfolio = {
    netProfitEUR: saleNow.netProfitEUR,
    returnPct: unrealizedPct,
    investEUR: totalEinstandEUR,
    shares: totalHeldShares,
    investLabel: 'Einstand'
  };
  if (state.activeTab === 'portfolio') {
    applyStickyKpis('portfolio');
    updateStickySummaryVisibility();
  }

  // ============ EquatePlus BUY table: the real per-month ESPP purchase prices ============
  const buys = (portfolioState.transactions || [])
    .filter(t => t.quantity > 0.00001)
    .map(t => ({
      date: t.date, dateStr: t.dateStr, type: t.type,
      qty: t.quantity,
      priceUSD: t.purchasePriceUSD,
      priceEUR: t.purchasePriceUSD * rate,
      fmvUSD: t.fmvUSD,
      investedEUR: t.quantity * t.purchasePriceUSD * rate
    }))
    .sort((a, b) => b.date - a.date); // newest first

  const buyRow = (t, isDiv) => `
    <tr class="${isDiv ? 'dividend-row' : ''}">
      <td>${t.dateStr}<br><span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">${isDiv ? 'Dividende (Reinvest)' : 'ESPP Kauf'}</span></td>
      <td>${t.qty.toFixed(5)}</td>
      <td>$${t.priceUSD.toFixed(2)}</td>
      <td>${formatEuro(t.priceEUR)}</td>
      <td>${t.fmvUSD ? '$' + t.fmvUSD.toFixed(2) : '–'}</td>
      <td>${formatEuro(t.investedEUR)}</td>
    </tr>
  `;
  const buyStocks = buys.filter(t => t.type !== 'Dividend Shares');
  const buyDivs = buys.filter(t => t.type === 'Dividend Shares');
  let buyHTML = buyStocks.map(t => buyRow(t, false)).join('');
  if (buyDivs.length > 0) {
    const divQty = buyDivs.reduce((s, t) => s + t.qty, 0);
    buyHTML += `<tr class="dividend-separator"><td colspan="6"><i class="fa-solid fa-seedling"></i> Dividenden-Reinvestitionen (Nebenwerte) · ${divQty.toFixed(5)} Aktien</td></tr>`;
    buyHTML += buyDivs.map(t => buyRow(t, true)).join('');
  }
  if (buyHTML === '') buyHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;">Keine EquatePlus-Käufe erfasst</td></tr>';
  portfolioElements.equateplusBuyBody.innerHTML = buyHTML;
  setupBuyTableCollapse();

  const totalBought = buys.reduce((s, t) => s + t.qty, 0);
  const totalInvestedBuy = buys.reduce((s, t) => s + t.investedEUR, 0);
  portfolioElements.equateplusBuyFoot.innerHTML = `
    <tr>
      <td><strong>Gesamt gekauft</strong></td>
      <td><strong>${totalBought.toFixed(5)}</strong></td>
      <td colspan="2"><strong>Ø $${totalBought > 0 ? (totalInvestedBuy / rate / totalBought).toFixed(2) : '0.00'}</strong></td>
      <td></td>
      <td><strong>${formatEuro(totalInvestedBuy)}</strong></td>
    </tr>
  `;
  portfolioElements.equateplusBuyNote.innerHTML = `<i class="fa-solid fa-circle-info"></i> Aktuell noch bei EquatePlus: <strong>${eqHeldNow.toFixed(5)} Aktien</strong> (Rest + Dividenden). Die übrigen wurden zu CapTrader/IBKR übertragen oder dort bereits verkauft.`;

  // ============ CapTrader holding block (aggregate, with CapTrader's reported cost basis) ============
  const ctPos = hasCapTrader ? portfolioState.capTraderPositions[Math.max(...Object.keys(portfolioState.capTraderPositions).map(Number))] : null;
  if (ctPos && ctPos.quantity > 0) {
    const ctQty = ctPos.quantity;
    const ctAvgUSD = ctPos.averagePriceUSD;
    const ctInvestedEUR = (Number.isFinite(ctPos.costBasisUSD) ? ctPos.costBasisUSD : ctQty * ctAvgUSD) * rate;
    const ctValueEUR = ctQty * price * rate;
    const ctUnrealEUR = ctValueEUR - ctInvestedEUR;
    const ctPct = ctInvestedEUR > 0 ? (ctUnrealEUR / ctInvestedEUR) * 100 : 0;
    portfolioElements.capTraderHoldingBlock.innerHTML = `
      <div class="ct-holding-grid">
        <div><span class="ct-h-label">Aktueller Bestand</span><strong class="ct-h-val">${ctQty} Aktien</strong></div>
        <div><span class="ct-h-label">Ø Einstand (laut CapTrader/IBKR)</span><strong class="ct-h-val">$${ctAvgUSD.toFixed(2)} <span style="font-weight:400;color:var(--text-muted);font-size:0.85em;">(${formatEuro(ctInvestedEUR)})</span></strong></div>
        <div><span class="ct-h-label">Aktueller Wert</span><strong class="ct-h-val">${formatEuro(ctValueEUR)}</strong></div>
        <div><span class="ct-h-label">Unrealisierter Gewinn</span><strong class="ct-h-val ${ctUnrealEUR >= 0 ? 'value-positive' : 'value-negative'}">${ctUnrealEUR >= 0 ? '+' : ''}${formatEuro(ctUnrealEUR)} (${ctPct >= 0 ? '+' : ''}${ctPct.toFixed(1)}%)</strong></div>
      </div>
      <div class="detail-note" style="margin-top: 12px;">
        <i class="fa-solid fa-circle-info"></i> Diese ${ctQty} Aktien wurden bei <strong>EquatePlus über mehrere Monate gekauft</strong> (Tabelle oben) und gesammelt übertragen. <strong>$${ctAvgUSD.toFixed(2)}</strong> ist der von CapTrader/IBKR gemeldete <strong>Durchschnitts-Einstand</strong> – kein einzelner Kaufpreis.${inTransitNow > 0.5 ? `<br><i class="fa-solid fa-clock-rotate-left"></i> Zusätzlich <strong>${inTransitNow.toFixed(0)} Aktien im Übertrag</strong> (noch nicht im Bestand enthalten).` : ''}
      </div>
    `;
  } else {
    portfolioElements.capTraderHoldingBlock.innerHTML = `<div class="detail-note"><i class="fa-solid fa-circle-info"></i> Kein CapTrader-Bestand erfasst – lade ein CapTrader-Statement hoch.</div>`;
  }

  // ---- Cash balance lying around in the CapTrader account (Endbarsaldo from the latest statement) ----
  if (portfolioElements.capTraderCashBlock) {
    const ctCashYears = Object.keys(portfolioState.capTraderCash || {}).map(Number);
    if (ctCashYears.length > 0) {
      const cash = portfolioState.capTraderCash[Math.max(...ctCashYears)];
      const usd = cash.usd || 0;
      const eur = cash.eur || 0;
      // Total cash value in EUR: prefer the statement's own base-currency figure; otherwise convert
      // the USD balance at the current rate and add the EUR balance.
      const totalEUR = Number.isFinite(cash.totalEUR) ? cash.totalEUR : (usd * rate + eur);
      const cells = [];
      if (usd > 0) cells.push(`<div><span class="ct-h-label">US-Dollar</span><strong class="ct-h-val">$${usd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>`);
      if (eur > 0) cells.push(`<div><span class="ct-h-label">Euro</span><strong class="ct-h-val">${formatEuro(eur)}</strong></div>`);
      cells.push(`<div><span class="ct-h-label">Gesamt in EUR</span><strong class="ct-h-val">${formatEuro(totalEUR)}</strong></div>`);
      portfolioElements.capTraderCashBlock.innerHTML = `
        <h5 style="font-size: 0.85rem; font-weight: 600; margin: 22px 0 10px; color: var(--text-muted);"><i class="fa-solid fa-wallet" style="color:#8b5cf6;"></i> Barbestand (Cash) im Depot</h5>
        <div class="ct-holding-grid">${cells.join('')}</div>
        <div class="detail-note" style="margin-top: 12px;">
          <i class="fa-solid fa-circle-info"></i> Nicht investiertes Guthaben auf Deinem CapTrader/IBKR-Konto (Endbarsaldo laut Statement). Der EUR-Gesamtwert ist zum Stichtagskurs des Statements umgerechnet.
        </div>
      `;
    } else {
      portfolioElements.capTraderCashBlock.innerHTML = '';
    }
  }

  // ---- Sell history (realized sales on CapTrader) ----
  const sells = [...portfolioState.capTraderSells].sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
  let sellHTML = '';
  let soldQty = 0, soldProceedsUSD = 0, soldGainUSD = 0;
  sells.forEach(s => {
    soldQty += s.quantity;
    soldProceedsUSD += s.proceedsUSD;
    soldGainUSD += s.realizedGainUSD;
    sellHTML += `
      <tr>
        <td>${s.dateStr}</td>
        <td>${s.quantity}</td>
        <td>$${s.priceUSD.toFixed(2)}</td>
        <td>$${s.proceedsUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="${s.realizedGainUSD >= 0 ? 'value-positive' : 'value-negative'}">${s.realizedGainUSD >= 0 ? '+' : ''}$${s.realizedGainUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  });
  if (sellHTML === '') sellHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;">Noch keine Verkäufe erfasst</td></tr>';
  if (portfolioElements.sellHistoryBody) portfolioElements.sellHistoryBody.innerHTML = sellHTML;
  if (portfolioElements.sellHistoryFoot) {
    portfolioElements.sellHistoryFoot.innerHTML = sells.length === 0 ? '' : `
      <tr>
        <td><strong>Gesamt verkauft</strong></td>
        <td><strong>${soldQty}</strong></td>
        <td></td>
        <td><strong>$${soldProceedsUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
        <td class="${soldGainUSD >= 0 ? 'value-positive' : 'value-negative'}"><strong>${soldGainUSD >= 0 ? '+' : ''}$${soldGainUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
      </tr>
    `;
  }

  portfolioElements.transactionCount.textContent = `${totalHeldShares.toFixed(2)} gehalten / ${soldQty} verkauft`;
  showPortfolioCard(portfolioElements.portfolioTransactionsCard, 0.2);

  // Depot-Konsolidierung Rendering
  const capTraderYears = Object.keys(portfolioState.capTraderPositions).map(Number);
  if (capTraderYears.length > 0) {
    const latestYear = Math.max(...capTraderYears);
    const latestPos = portfolioState.capTraderPositions[latestYear];
    
    const eqShares = portfolioState.equatePlusAvailableShares !== undefined ? portfolioState.equatePlusAvailableShares : 0;
    const eqValueEUR = eqShares * portfolioState.currentPrice * portfolioState.exchangeRate;
    
    const ctShares = latestPos.quantity;
    const ctValueEUR = ctShares * portfolioState.currentPrice * portfolioState.exchangeRate;
    
    const totalHeldShares = eqShares + ctShares;
    // Shares that left EquatePlus but have not yet been received at CapTrader.
    const inTransitShares = getInTransitShares();

    const eqPercent = totalHeldShares > 0 ? (eqShares / totalHeldShares) * 100 : 0;
    const ctPercent = totalHeldShares > 0 ? (ctShares / totalHeldShares) * 100 : 0;

    // Sells stats
    const totalRealizedGainUSD = portfolioState.capTraderSells.reduce((sum, s) => sum + s.realizedGainUSD, 0);
    const totalRealizedGainEUR = totalRealizedGainUSD * portfolioState.exchangeRate;
    const totalCtFeesUSD = portfolioState.capTraderSells.reduce((sum, s) => sum + Math.abs(s.commissionUSD), 0);
    const totalCtFeesEUR = totalCtFeesUSD * portfolioState.exchangeRate;
    
    const totalTransfersShares = portfolioState.capTraderTransfers.reduce((sum, t) => sum + t.quantity, 0);

    // Update UI elements: percent labels and EUR values count alongside the
    // CSS-transitioned allocation bar instead of jumping.
    animateNumberValue('consolidationEqPercent', eqPercent, (v) => `${v.toFixed(1)}%`);
    animateNumberValue('consolidationCtPercent', ctPercent, (v) => `${v.toFixed(1)}%`);

    portfolioElements.consolidationEqBar.style.width = `${eqPercent}%`;
    portfolioElements.consolidationCtBar.style.width = `${ctPercent}%`;

    portfolioElements.consolidationEqShares.textContent = `${eqShares.toFixed(5)} Aktien`;
    animateNumberValue('consolidationEqValue', eqValueEUR, formatEuro);
    portfolioElements.consolidationEqItems.textContent = `${portfolioState.equatePlusHoldings.length} Posten`;

    portfolioElements.consolidationCtShares.textContent = `${ctShares.toFixed(2)} Aktien`;
    animateNumberValue('consolidationCtValue', ctValueEUR, formatEuro);
    animateNumberValue('consolidationCtRealized', totalRealizedGainEUR, (v) => `${v >= 0 ? '+' : ''}${formatEuro(v)}`);
    portfolioElements.consolidationCtStats.textContent = `${portfolioState.capTraderSells.length} Verkäufe / ${portfolioState.capTraderTransfers.length} Transfers`;

    // "As of" dates: each balance is only valid as of its own statement date. Show them and
    // warn if the two latest statements cover clearly different periods (mixing dates = wrong total).
    const fmtDate = (d) => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
    const eqDate = portfolioState.latestEquatePlusDate || null;
    const ctDate = portfolioState.capTraderDates[latestYear] || null;
    portfolioElements.consolidationEqDate.textContent = fmtDate(eqDate);
    portfolioElements.consolidationCtDate.textContent = fmtDate(ctDate);

    if (eqDate && ctDate) {
      const diffDays = Math.abs(eqDate - ctDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 90) {
        portfolioElements.consolidationDateWarningText.textContent =
          `Die aktuellsten Statements stammen aus unterschiedlichen Zeiträumen ` +
          `(EquatePlus: ${fmtDate(eqDate)}, CapTrader/IBKR: ${fmtDate(ctDate)}). ` +
          `Der angezeigte Gesamtbestand mischt verschiedene Stichtage und ist daher vermutlich nicht korrekt. ` +
          `Bitte lade für beide Plattformen das jeweils aktuellste Statement desselben Zeitraums hoch.`;
        portfolioElements.consolidationDateWarning.style.display = 'block';
      } else {
        portfolioElements.consolidationDateWarning.style.display = 'none';
      }
    } else {
      portfolioElements.consolidationDateWarning.style.display = 'none';
    }

    // Render In Transit row
    const inTransitRow = document.getElementById('consolidationInTransitRow');
    const inTransitSharesEl = document.getElementById('consolidationInTransitShares');
    if (inTransitRow && inTransitSharesEl) {
      if (inTransitShares > 0) {
        inTransitRow.style.display = 'flex';
        inTransitSharesEl.textContent = `${inTransitShares.toFixed(5)} Aktien`;
      } else {
        inTransitRow.style.display = 'none';
      }
    }

    // Render tables in details panel
    // 1. Sells
    let sellsHTML = '';
    [...portfolioState.capTraderSells].sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr)).forEach(s => {
      sellsHTML += `
        <tr>
          <td>${s.dateStr}</td>
          <td>${s.quantity}</td>
          <td>$${s.priceUSD.toFixed(2)}</td>
          <td>$${s.proceedsUSD.toLocaleString('de-DE', {minimumFractionDigits:2})}</td>
          <td class="value-negative">-$${Math.abs(s.commissionUSD).toFixed(2)}</td>
        </tr>
      `;
    });
    if (sellsHTML === '') sellsHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;">Keine Verkäufe erfasst</td></tr>';
    portfolioElements.capTraderSellsBody.innerHTML = sellsHTML;

    // 2. Transfers
    let transfersHTML = '';
    [...portfolioState.capTraderTransfers].sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr)).forEach(t => {
      transfersHTML += `
        <tr>
          <td>${t.dateStr}</td>
          <td>${t.quantity}</td>
          <td>$${t.marketValueUSD.toLocaleString('de-DE', {minimumFractionDigits:2})}</td>
        </tr>
      `;
    });
    if (transfersHTML === '') transfersHTML = '<tr><td colspan="3" class="text-muted" style="text-align:center;">Keine Überträge erfasst</td></tr>';
    portfolioElements.capTraderTransfersBody.innerHTML = transfersHTML;

    // 3. EquatePlus Transfers Out
    let eqTransfersHTML = '';
    [...portfolioState.equatePlusTransfers].sort((a, b) => b.date - a.date).forEach(et => {
      eqTransfersHTML += `
        <tr>
          <td>${et.dateStr}</td>
          <td>${et.quantity}</td>
        </tr>
      `;
    });
    if (eqTransfersHTML === '') eqTransfersHTML = '<tr><td colspan="2" class="text-muted" style="text-align:center;">Keine Überträge erfasst</td></tr>';
    portfolioElements.equatePlusTransfersBody.innerHTML = eqTransfersHTML;

    // Show card
    showPortfolioCard(portfolioElements.portfolioConsolidationCard, 0);
  }

  // Trigger GSAP staggered reveal entrance for portfolio stat boxes if tab is active
  if (state.activeTab === 'portfolio') {
    const delay = state.initAnimationsDone ? 0 : 0.65;
    triggerPortfolioKpisAnimation(delay);
  }
}

// Trigger GSAP staggered reveal entrance for portfolio stat boxes
function triggerPortfolioKpisAnimation(delaySeconds = 0) {
  const statBoxes = portfolioElements.portfolioResults ? portfolioElements.portfolioResults.querySelectorAll('.portfolio-stat-box') : [];
  if (statBoxes.length > 0 && !state.portfolioKpisAnimated) {
    state.portfolioKpisAnimated = true;
    if (prefersReducedMotion()) return;

    // Disable CSS transitions temporarily so they don't fight with GSAP, and set opacity to 0
    gsap.set(statBoxes, { transition: 'none', opacity: 0 });
    gsap.killTweensOf(statBoxes);

    gsap.fromTo(statBoxes, 
      { opacity: 0, scale: 0.92, y: 20 },
      { 
        opacity: 1, 
        scale: 1, 
        y: 0, 
        delay: delaySeconds,
        duration: 0.55, 
        stagger: 0.08, 
        ease: "back.out(1.4)",
        clearProps: "all"
      }
    );
  }
}

// Show Portfolio Status
function showPortfolioStatus(message, type) {
  const statusEl = portfolioElements.csvUploadStatus;
  statusEl.className = 'upload-status-message';
  
  if (type === 'loading') {
    statusEl.innerHTML = `<span class="loading-spinner"></span> ${message}`;
    statusEl.classList.add('loading');
  } else if (type === 'success') {
    statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    statusEl.classList.add('success');
  } else if (type === 'error') {
    statusEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${message}`;
    statusEl.classList.add('error');
  } else if (type === 'warning') {
    statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
    statusEl.classList.add('warning');
  }
  
  statusEl.classList.remove('hidden-status');
}

// Helper: Format Euro
function formatEuro(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

// --- Antigravity Modern UI Helpers ---

const REDUCED_MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');
function prefersReducedMotion() {
  return REDUCED_MOTION_QUERY.matches;
}

const counterAnimations = new Map();

function animateNumberValue(elementId, targetVal, formatFn, opts = {}) {
  const element = document.getElementById(elementId) || (elements && elements[elementId]);
  if (!element) return;

  // Retrieve or initialize the current state
  let animState = counterAnimations.get(elementId);
  if (!animState) {
    animState = { val: 0, target: null };
    counterAnimations.set(elementId, animState);
  }

  const isFirstSet = animState.target === null;
  const changed = !isFirstSet && Math.abs(animState.target - targetVal) > 0.004;
  animState.target = targetVal;

  // Cancel any active tween for this element
  gsap.killTweensOf(animState);

  if (prefersReducedMotion()) {
    animState.val = targetVal;
    element.textContent = formatFn(targetVal);
    return;
  }

  // Animate the virtual value. During rapid slider drags the counter shortens
  // so the displayed number never lags noticeably behind the thumb.
  gsap.to(animState, {
    val: targetVal,
    duration: state.rapidRecalc ? 0.18 : 0.45,
    ease: "power2.out",
    onUpdate: () => {
      element.textContent = formatFn(animState.val);
    }
  });

  if (opts.flashRow && changed) flashDetailRow(element);
}

// One quick scale pulse to mark a state FLIP (profit turning into loss and back).
// Deliberately stronger than the row flash: sign changes must not be missed.
function pulseElement(el) {
  if (!el || prefersReducedMotion()) return;
  gsap.set(el, { transition: 'none' }); // a CSS transition would smear the pulse
  gsap.fromTo(el, { scale: 1 }, {
    scale: 1.08,
    duration: 0.16,
    ease: 'power2.out',
    yoyo: true,
    repeat: 1,
    overwrite: true,
    onComplete: () => gsap.set(el, { clearProps: 'transform,transition' })
  });
}

// Soft highlight pulse on a breakdown row whose value just changed — makes it
// visible *which* figures a slider movement affected.
function flashDetailRow(element) {
  if (prefersReducedMotion()) return;
  const row = element.closest('.detail-row');
  if (!row) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  gsap.fromTo(row,
    { backgroundColor: light ? 'rgba(8, 145, 178, 0.10)' : 'rgba(0, 242, 254, 0.08)' },
    { backgroundColor: 'rgba(0, 242, 254, 0)', duration: 0.7, ease: 'power1.out', overwrite: true, clearProps: 'backgroundColor' }
  );
}

// Breakdown rows: animated counter + change flash; plain text while the results
// are hidden behind the empty state (no point in tweening invisible numbers).
function setBreakdownValue(elementId, value, formatFn, isPlaceholder) {
  if (isPlaceholder) {
    const el = document.getElementById(elementId) || (elements && elements[elementId]);
    if (el) el.textContent = formatFn(value);
    // Keep the counter state in sync so the first real reveal doesn't flash every row
    const animState = counterAnimations.get(elementId);
    if (animState) {
      gsap.killTweensOf(animState);
      animState.val = value;
      animState.target = value;
    }
    return;
  }
  animateNumberValue(elementId, value, formatFn, { flashRow: true });
}



function initGsapAnimations() {
  // Reduced motion: leave everything at its final CSS state — no choreography.
  if (prefersReducedMotion()) {
    state.initAnimationsDone = true;
    if ((state.activeTab || 'calculator') === 'portfolio') {
      triggerPortfolioKpisAnimation(0);
    }
    return;
  }

  // Returning visitors get a snappier entrance — they came to use the tool,
  // not to watch the intro again.
  let returning = false;
  try { returning = !!localStorage.getItem(LS_KEYS.seenWelcome); } catch (e) { /* private mode */ }
  const speed = returning ? 0.55 : 1;

  // Fade and slide header in
  gsap.from("header", {
    y: -40,
    opacity: 0,
    duration: 0.7 * speed,
    ease: "power2.out"
  });

  gsap.from(".logo", {
    x: -30,
    opacity: 0,
    duration: 0.7 * speed,
    delay: 0.15 * speed,
    ease: "power2.out"
  });

  gsap.from(".nav-tab", {
    y: 15,
    opacity: 0,
    duration: 0.5 * speed,
    stagger: 0.06 * speed,
    delay: 0.25 * speed,
    ease: "power2.out"
  });

  // Stagger inputs and outputs panels fade-in for the active tab
  const activeTabId = state.activeTab || 'calculator';
  // The initially-active tab gets THIS entrance — don't add scroll reveals on top.
  if (activeTabId === 'guide' || activeTabId === 'taxes') {
    (state.contentReveals = state.contentReveals || {})[activeTabId] = true;
  }
  let cards;
  if (activeTabId === 'guide') {
    cards = document.querySelectorAll(
      '#tab-guide .guide-toc, ' +
      '#guide-about .guide-section-head, ' +
      '#guide-about .guide-lead, ' +
      '#guide-about .guide-feature-grid .guide-feature-card, ' +
      '#guide-about .guide-fact-strip, ' +
      '#tab-guide #guide-strategy, ' +
      '#tab-guide #guide-transfer, ' +
      '#tab-guide #guide-pitfalls, ' +
      '#tab-guide #guide-leave'
    );
  } else if (activeTabId === 'taxes') {
    cards = document.querySelectorAll('#tab-taxes .guide-toc, #tab-taxes .tax-glance-grid .guide-feature-card, #tab-taxes .guide-section');
  } else {
    cards = document.querySelectorAll(`#tab-${activeTabId} .glass-card`);
  }
  
  if (cards.length === 0) {
    state.initAnimationsDone = true;
    if (activeTabId === 'portfolio') {
      triggerPortfolioKpisAnimation(0);
    }
    return;
  }
  
  // Disable CSS transitions temporarily so they don't drag/lag behind GSAP updates
  gsap.set(cards, { transition: 'none' });

  gsap.from(cards, {
    y: 30,
    opacity: 0,
    duration: 0.8 * speed,
    stagger: 0.15 * speed,
    delay: 0.4 * speed,
    ease: "power3.out",
    onComplete: () => {
      // Clear only animated properties to restore default CSS hover/transitions without wiping out JS-controlled display styles
      gsap.set(cards, { clearProps: "transform,opacity" });
      state.initAnimationsDone = true;
    }
  });
}

// --- Shared GSAP expand/collapse primitive -----------------------------------
// Slides a block open/closed by animating height/opacity (+ vertical padding
// and margins, so bordered cards shrink smoothly instead of snapping their
// spacing). The caller owns the display/none or <details open> bookkeeping:
// make the element renderable BEFORE sliding open; hide it in onDone after
// sliding closed. Respects prefers-reduced-motion (duration 0).
function gsapSlide(el, open, { onDone, duration } = {}) {
  const reduced = prefersReducedMotion();
  gsap.killTweensOf(el);
  const clear = () => {
    gsap.set(el, { clearProps: 'height,opacity,overflow,marginTop,marginBottom,paddingTop,paddingBottom' });
    if (onDone) onDone();
  };
  gsap.set(el, { overflow: 'hidden' });
  if (open) {
    gsap.from(el, {
      height: 0, opacity: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0,
      duration: reduced ? 0 : (duration ?? 0.32),
      ease: 'power2.out',
      onComplete: clear
    });
  } else {
    gsap.to(el, {
      height: 0, opacity: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0,
      duration: reduced ? 0 : (duration ?? 0.26),
      ease: 'power1.inOut',
      onComplete: clear
    });
  }
}

// Generic GSAP open/close wiring for native <details> elements whose content
// sits in a single wrapper right after the <summary>. Used by the IBM-notice
// banner (+ its nested original-text block) and the upload-help FAQ cards.
// The .sale-process-collapsible elements keep their own richer wiring below
// (child stagger); don't double-wire them here.
function wireDetailsAnimation(details, bodySel, chevronSel = null) {
  const summary = details.querySelector(':scope > summary');
  const body = details.querySelector(bodySel);
  if (!summary || !body) return;
  const chevron = chevronSel ? details.querySelector(chevronSel) : null;
  if (chevron) {
    chevron.style.transition = 'none'; // GSAP drives it; a CSS transition would smear
    gsap.set(chevron, { rotation: details.open ? 180 : 0 });
  }
  summary.addEventListener('click', (e) => {
    e.preventDefault();
    const chevDur = prefersReducedMotion() ? 0 : 0.2;
    if (details.open) {
      if (chevron) gsap.to(chevron, { rotation: 0, duration: chevDur, ease: 'power1.out' });
      gsapSlide(body, false, { onDone: () => details.removeAttribute('open') });
    } else {
      details.setAttribute('open', '');
      if (chevron) gsap.to(chevron, { rotation: 180, duration: chevDur, ease: 'power1.out' });
      gsapSlide(body, true);
    }
  });
}

function initDetailsAnimations() {
  document.querySelectorAll('.espp-notice').forEach(d =>
    wireDetailsAnimation(d, '.espp-notice-body', '.espp-notice-toggle i'));
  document.querySelectorAll('.espp-notice-original').forEach(d =>
    wireDetailsAnimation(d, '.espp-notice-original-body', ':scope > summary .chevron'));
  document.querySelectorAll('.formats-details').forEach(d =>
    wireDetailsAnimation(d, '.formats-body'));
}

function initSaleProcessCollapsible() {
  const collapsibles = document.querySelectorAll('.sale-process-collapsible');
  collapsibles.forEach(collapsible => {
    const summary = collapsible.querySelector('.sale-process-summary');
    const body = collapsible.querySelector('.sale-process-body');
    const chevron = collapsible.querySelector('.chevron');
    if (!summary || !body) return;

    // Initial layout configuration. Overflow is only hidden while COLLAPSED or
    // animating — an open body must stay overflow-visible, otherwise the CSS
    // tooltips of rows near its top edge get clipped.
    body.style.willChange = 'height, opacity';

    if (collapsible.hasAttribute('open')) {
      body.style.height = 'auto';
      body.style.opacity = '1';
      body.style.overflow = 'visible';
      if (chevron) gsap.set(chevron, { rotation: 180 });
    } else {
      body.style.height = '0px';
      body.style.opacity = '0';
      body.style.overflow = 'hidden';
      if (chevron) gsap.set(chevron, { rotation: 0 });
    }

    summary.addEventListener('click', (e) => {
      e.preventDefault();

      const isOpen = collapsible.hasAttribute('open');
      const reduced = prefersReducedMotion();

      if (isOpen) {
        // Collapse: Animate height to 0 and opacity to 0
        body.style.height = `${body.scrollHeight}px`;
        body.style.overflow = 'hidden';

        gsap.to(body, {
          height: 0,
          opacity: 0,
          duration: reduced ? 0 : 0.24,
          ease: "power1.out",
          onComplete: () => {
            collapsible.removeAttribute('open');
          }
        });

        if (chevron) {
          gsap.to(chevron, {
            rotation: 0,
            duration: reduced ? 0 : 0.18,
            ease: "power1.out"
          });
        }
      } else {
        // Expand: Set open attribute, start height from 0, and animate to scrollHeight
        collapsible.setAttribute('open', '');
        body.style.height = '0px';
        body.style.opacity = '0';
        body.style.overflow = 'hidden';

        const targetHeight = body.scrollHeight;

        gsap.to(body, {
          height: targetHeight,
          opacity: 1,
          duration: reduced ? 0 : 0.28,
          ease: "power1.out",
          onComplete: () => {
            body.style.height = 'auto';
            body.style.overflow = 'visible'; // tooltips may escape the open body
          }
        });

        if (chevron) {
          gsap.to(chevron, {
            rotation: 180,
            duration: reduced ? 0 : 0.18,
            ease: "power1.out"
          });
        }

        // Stagger animation for child elements (cards and separators together) to maintain alignment
        const stepItems = body.querySelectorAll('.sale-step, .workflow-step-box, .workflow-arrow-separator');
        if (stepItems.length > 0 && !reduced) {
          gsap.killTweensOf(stepItems);
          gsap.set(stepItems, { opacity: 0, y: 15 });
          gsap.to(stepItems, {
            opacity: 1,
            y: 0,
            duration: 0.45,
            stagger: 0.05,
            ease: "power2.out",
            delay: 0.05, // Start slightly after the expand animation begins
            clearProps: "opacity,transform"
          });
        }
      }
    });
  });
}

// --- Rechner: results reveal, sticky KPI strip & scroll reveals ---

// Keeps --header-h current so the sticky strip and the pinned results panel
// always sit exactly below the (responsive-height) sticky header.
function syncHeaderHeightVar() {
  const header = document.querySelector('header');
  if (header) {
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  }
}

// Choreographed swap from the empty state to the first real analysis: donut
// scales in, then legend and breakdown rows cascade. Plays once per transition.
function revealCalcResults(emptyState, resultsContent, netProfitEUR) {
  emptyState.style.display = 'none';
  resultsContent.style.display = 'block';

  const donut = resultsContent.querySelector('.donut-wrap');

  if (prefersReducedMotion()) {
    if (netProfitEUR > 0) state.profitCelebrated = true; // skip confetti too
    return;
  }

  const legendItems = resultsContent.querySelectorAll('.chart-legend .cl-item');
  const rest = resultsContent.querySelectorAll(
    '.kpi-grid .kpi-card, .sale-process-collapsible'
  );

  if (donut) gsap.killTweensOf(donut);

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set([donut, ...legendItems, ...rest].filter(Boolean), { clearProps: 'transform,opacity' });
      if (netProfitEUR > 0) celebrateProfit(donut);
    }
  });

  tl.fromTo(resultsContent, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out', clearProps: 'opacity' }, 0);
  if (donut) {
    tl.fromTo(donut, { scale: 0.82, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.65, ease: 'back.out(1.6)' }, 0.05);
  }
  if (legendItems.length) {
    tl.fromTo(legendItems, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power2.out' }, 0.3);
  }
  if (rest.length) {
    tl.fromTo(rest, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.035, ease: 'power2.out' }, 0.35);
  }
}

// One-time 2D-canvas particle burst from the donut when the first calculation
// lands on a positive net profit. No extra dependency, removes itself.
function celebrateProfit(donutWrap) {
  if (!donutWrap || state.profitCelebrated || prefersReducedMotion()) return;
  // Once per browser session — a restored calculation on reload shouldn't re-fire it.
  try {
    if (sessionStorage.getItem('espp_celebrated')) return;
    sessionStorage.setItem('espp_celebrated', '1');
  } catch (e) { /* private mode: fall back to the in-memory flag */ }
  state.profitCelebrated = true;
  confettiBurst(donutWrap);
}

// One confetti burst centered over `wrap` (needs position: relative). Shared by the
// Rechner profit reveal and the goal tracker's "Jetzt leistbar!" moment.
// Rendered at devicePixelRatio for crispness; particles pop upward, tumble
// (faked 3D flutter via vertical squash) and stay fully opaque for most of
// their life before easing out — a bold burst instead of a faint sprinkle.
function confettiBurst(wrap) {
  const size = wrap.offsetWidth || 270;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = size * 2;
  const H = size * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
    'width:200%;height:200%;pointer-events:none;z-index:5;';
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Chart palette + bright celebration extras. White pops on dark; on the light
  // theme it would vanish, so swap it for a deep slate.
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const colors = [...chartPalette(), '#fbbf24', '#f472b6', '#38bdf8', light ? '#0f172a' : '#ffffff'];

  const cx = W / 2;
  const cy = H / 2;
  const particles = Array.from({ length: 90 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3.5 + Math.random() * 6.5;
    const kind = Math.random();
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.2, // upward bias: pop up, then rain down
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 5,
      shape: kind < 0.55 ? 'rect' : (kind < 0.85 ? 'circle' : 'ribbon'),
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      flutter: Math.random() * Math.PI * 2,
      vf: 0.15 + Math.random() * 0.2
    };
  });

  let frame = 0;
  const maxFrames = 110;
  (function tick() {
    frame++;
    ctx.clearRect(0, 0, W, H);
    // Fully opaque for the first 60% of the life, then ease out.
    const t = frame / maxFrames;
    const alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;               // air drag
      p.vy = p.vy * 0.985 + 0.16;  // drag + gravity
      p.rot += p.vr;
      p.flutter += p.vf;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ribbon') {
        // long strip with a slow flutter — reads as a falling streamer
        ctx.scale(1, 0.4 + Math.abs(Math.sin(p.flutter)) * 0.9);
        ctx.fillRect(-p.w / 2, -p.h * 1.4, p.w, p.h * 2.8);
      } else {
        // tumbling rectangle: vertical squash fakes the 3D flip
        ctx.scale(1, 0.25 + Math.abs(Math.sin(p.flutter)) * 0.95);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  })();
}

// The condensed sticky strip is shared between the Rechner and Portfolio tabs —
// each caches its own KPIs here and the strip is repopulated on tab switch.
function applyStickyKpis(tab) {
  const kpis = tab === 'portfolio' ? state.stickyKpisPortfolio : state.stickyKpisCalculator;
  const labelEl = document.getElementById('stickyInvestmentLabel');
  if (labelEl) labelEl.textContent = (kpis && kpis.investLabel) || 'Einsatz';
  // The Prognose/Historisch tag only applies to Rechner figures — portfolio data is real.
  const modeTag = document.getElementById('stickyModeTag');
  if (modeTag) modeTag.style.display = tab === 'calculator' ? '' : 'none';
  const returnEl = document.getElementById('stickyReturn');

  if (!kpis) {
    ['stickyNetProfit', 'stickyInvestment', 'stickyReturn', 'stickyShares'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '–';
    });
    if (returnEl) returnEl.style.color = '';
    return;
  }

  const fmtEUR = (v) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  animateNumberValue('stickyNetProfit', kpis.netProfitEUR, fmtEUR);
  animateNumberValue('stickyInvestment', kpis.investEUR, fmtEUR);
  animateNumberValue('stickyReturn', kpis.returnPct, (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
  animateNumberValue('stickyShares', kpis.shares, (v) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Stk.`);
  if (returnEl) returnEl.style.color = kpis.returnPct >= 0 ? 'var(--success)' : '#f87171';
}

// Condensed sticky KPI strip: top bar on desktop, bottom chip on phones.
// Appears once the tab's summary (Rechner banner / portfolio stat boxes) has
// scrolled out of view — and, on phones, while the results panel itself is
// off-screen — so the headline numbers give feedback wherever the user is.
function updateStickySummaryVisibility() {
  const strip = document.getElementById('calcStickySummary');
  if (!strip) return;

  const header = document.querySelector('header');
  const headerH = header ? header.offsetHeight : 84;

  // Per-tab: the element that must scroll out of view before the strip appears.
  let anchor = null;
  let hasData = false;
  if (state.activeTab === 'calculator') {
    const banner = document.querySelector('.calc-summary-banner');
    anchor = (banner && banner.style.display !== 'none') ? banner : null;
    hasData = !!state.salaryProvided;
  } else if (state.activeTab === 'portfolio') {
    anchor = document.querySelector('#tab-portfolio .portfolio-summary');
    hasData = !!state.stickyKpisPortfolio;
  }

  let show = false;
  if (anchor && hasData) {
    const anchorGone = anchor.getBoundingClientRect().bottom < headerH + 6;
    if (window.innerWidth <= 768) {
      // Hide the chip while the results panel itself is on screen.
      const panel = document.querySelector(`#tab-${state.activeTab} .panel-outputs`);
      const rect = panel ? panel.getBoundingClientRect() : null;
      const panelInView = rect && rect.bottom > headerH + 40 && rect.top < window.innerHeight - 120;
      show = anchorGone && !panelInView;
    } else {
      show = anchorGone;
    }
  }

  if (show === state.stickyStripShown) return;
  state.stickyStripShown = show;
  strip.setAttribute('aria-hidden', show ? 'false' : 'true');
  gsap.killTweensOf(strip);

  const slideY = window.innerWidth <= 768 ? 16 : -14;
  if (show) {
    strip.classList.add('is-visible');
    if (prefersReducedMotion()) {
      gsap.set(strip, { opacity: 1, y: 0 });
    } else {
      gsap.fromTo(strip, { opacity: 0, y: slideY }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
    }
  } else if (prefersReducedMotion()) {
    gsap.set(strip, { opacity: 0 });
    strip.classList.remove('is-visible');
  } else {
    gsap.to(strip, {
      opacity: 0,
      y: slideY,
      duration: 0.22,
      ease: 'power1.in',
      onComplete: () => strip.classList.remove('is-visible')
    });
  }
}

function initStickySummary() {
  const strip = document.getElementById('calcStickySummary');
  if (!strip) return;

  const goToResults = () => {
    if (window.innerWidth <= 768) {
      const panel = document.querySelector(`#tab-${state.activeTab} .panel-outputs`);
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  strip.addEventListener('click', goToResults);
  strip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToResults();
    }
  });

  window.addEventListener('scroll', updateStickySummaryVisibility, { passive: true });
  window.addEventListener('resize', updateStickySummaryVisibility);
}

// Entrance cascade for the long CONTENT tabs (Anleitung / Steuern): the sections
// visible on first entry fade in once, synchronously with the tab switch.
// Below-the-fold content is deliberately NOT animated on scroll — reveal-on-scroll
// flashed cards dark before loading them in whenever the user scrolled quickly.
function setupContentScrollReveals(tab) {
  if (tab !== 'guide' && tab !== 'taxes') return;
  state.contentReveals = state.contentReveals || {};
  if (state.contentReveals[tab] || prefersReducedMotion()) return;
  state.contentReveals[tab] = true;

  const targets = [...document.querySelectorAll(tab === 'guide'
    ? '#tab-guide .guide-section'
    : '#tab-taxes .tax-glance-grid .guide-feature-card, #tab-taxes .guide-section')]
    .filter(el => el.getBoundingClientRect().top < window.innerHeight * 0.92);
  if (!targets.length) return;

  // The cards carry a CSS `transition: all` (hover lift) that would re-smooth
  // every GSAP frame into mush — disable it for the tween, clearProps restores it.
  gsap.set(targets, { transition: 'none' });
  gsap.fromTo(targets,
    { opacity: 0, y: 26 },
    { opacity: 1, y: 0, duration: 0.55, stagger: 0.09, delay: 0.05, ease: 'power2.out', clearProps: 'opacity,transform,transition' }
  );
}

// Soft scroll-in reveals for the calculator's below-the-fold cards. Phones and
// tablets only: on desktop the results pane is pinned, so nothing meaningful
// sits below the fold, and its internal scrolling would confuse ScrollTrigger.
function setupCalcScrollReveals() {
  if (state.calcRevealsDone || !window.ScrollTrigger || prefersReducedMotion()) return;
  if (window.innerWidth > 900) return;
  state.calcRevealsDone = true;

  const targets = document.querySelectorAll(
    '#tab-calculator .collapsible-step, #tab-calculator .sale-process-collapsible'
  );
  if (!targets.length) return;

  ScrollTrigger.batch(targets, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => {
      gsap.fromTo(batch,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', clearProps: 'opacity,transform' }
      );
    }
  });
}




