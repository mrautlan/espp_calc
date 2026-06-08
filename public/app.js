// IBM ESPP Navigator & Rechner - App Logic

// State management
let state = {
  usdPrice: 180.00,
  eurPrice: 165.60,
  exchangeRate: 0.92,
  previousCloseUSD: 178.50,
  previousCloseEUR: 164.22,
  activeTab: 'calculator',
  activeStrategy: 'path-c',
  chart: null,
  porscheChart: null,
  historicalPrices: null,
  usingHistoricalData: false,
  // The user's savings goal for the tracker: { name, image, price, url }
  goal: { name: 'Mein Sparziel', image: null, price: 50000, url: null }
};

// DOM Elements
const elements = {
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  liveTicker: document.getElementById('liveTicker'),
  inputStockPrice: document.getElementById('inputStockPrice'),
  btnFetchStock: document.getElementById('btnFetchStock'),
  valStockPriceEUR: document.getElementById('valStockPriceEUR'),
  valExchangeRate: document.getElementById('valExchangeRate'),
  
  // Calculator Inputs
  inputMonthlySalary: document.getElementById('inputMonthlySalary'),
  valMonthlySalary: document.getElementById('valMonthlySalary'),
  inputSavingsRate: document.getElementById('inputSavingsRate'),
  valSavingsRate: document.getElementById('valSavingsRate'),
  selectTaxYear: document.getElementById('selectTaxYear'),
  inputTaxRate: document.getElementById('inputTaxRate'),
  valTaxRate: document.getElementById('valTaxRate'),
  selectChurchTax: document.getElementById('selectChurchTax'),
  selectSoli: document.getElementById('selectSoli'),
  selectBroker: document.getElementById('selectBroker'),
  inputSellPrice: document.getElementById('inputSellPrice'),
  inputAccumulatedMonths: document.getElementById('inputAccumulatedMonths'),
  valAccumulatedMonths: document.getElementById('valAccumulatedMonths'),
  
  // Calculator Outputs
  germanBrokerNote: document.getElementById('germanBrokerNote'),
  netProfitEuro: document.getElementById('netProfitEuro'),
  netProfitPercent: document.getElementById('netProfitPercent'),
  netInvestment: document.getElementById('netInvestment'),
  netReturnOnCapital: document.getElementById('netReturnOnCapital'),
  rowGrossContribution: document.getElementById('rowGrossContribution'),
  rowNetContribution: document.getElementById('rowNetContribution'),
  rowDiscountBenefit: document.getElementById('rowDiscountBenefit'),
  rowDiscountTax: document.getElementById('rowDiscountTax'),
  rowCapitalGainsTax: document.getElementById('rowCapitalGainsTax'),
  rowFees: document.getElementById('rowFees'),
  
  // Sale Process Detail Elements
  rowShareCount: document.getElementById('rowShareCount'),
  rowBuyPriceEUR: document.getElementById('rowBuyPriceEUR'),
  rowDiscountedPrice: document.getElementById('rowDiscountedPrice'),
  rowTotalMarketValue: document.getElementById('rowTotalMarketValue'),
  rowSellPriceEUR: document.getElementById('rowSellPriceEUR'),
  rowGrossSaleRevenue: document.getElementById('rowGrossSaleRevenue'),
  rowCapitalGainsAmount: document.getElementById('rowCapitalGainsAmount'),
  rowCapGainsTaxSale: document.getElementById('rowCapGainsTaxSale'),
  rowDiscountTaxSale: document.getElementById('rowDiscountTaxSale'),
  rowBrokerFeesSale: document.getElementById('rowBrokerFeesSale'),
  rowNetSaleProceeds: document.getElementById('rowNetSaleProceeds'),
  rowNetCostsSale: document.getElementById('rowNetCostsSale'),
  rowDiscountTaxSale2: document.getElementById('rowDiscountTaxSale2'),
  rowFinalNetProfit: document.getElementById('rowFinalNetProfit'),
  
  // Alerts / Highlights
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

  // Goal (Amazon link) elements
  goalBadge: document.getElementById('goalBadge'),
  goalUrl: document.getElementById('goalUrl'),
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
  initTabs();
  initStrategySelector();
  initCalculator();
  fetchLiveStockPrice();
  initPdfUploader();
  initPorscheTracker();
  initPortfolioModule();
  initWelcome();

  // Details Toggle in Aktientransfer
  document.querySelectorAll('.btn-show-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      
      // Close all others
      document.querySelectorAll('.transfer-details-card').forEach(card => {
        if (card.id !== targetId) card.classList.add('hidden-details');
      });
      
      // Toggle current
      targetEl.classList.toggle('hidden-details');
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
  
  document.querySelectorAll('.btn-close-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.transfer-details-card').classList.add('hidden-details');
    });
  });
});

// First-visit welcome overlay + the "what is this" capability shortcuts.
function initWelcome() {
  const overlay = document.getElementById('welcomeOverlay');
  const open = () => { if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; } };
  const close = () => {
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    try { localStorage.setItem('espp_seen_welcome', '1'); } catch (e) { /* private mode */ }
  };

  document.getElementById('welcomeClose')?.addEventListener('click', close);
  document.getElementById('welcomeStart')?.addEventListener('click', close);
  document.getElementById('helpBtn')?.addEventListener('click', open);   // re-openable anytime
  // Dismiss by clicking the backdrop or pressing Escape.
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') close(); });

  // Show once, on the very first visit.
  let seen = false;
  try { seen = !!localStorage.getItem('espp_seen_welcome'); } catch (e) { /* private mode */ }
  if (!seen) open();
}

// Tab Navigation
function initTabs() {
  let savedTab = localStorage.getItem('espp_active_tab');
  // Guard against a saved tab that no longer exists (e.g. the removed "transfer" tab).
  if (savedTab && !document.getElementById(`tab-${savedTab}`)) {
    savedTab = 'calculator';
    localStorage.setItem('espp_active_tab', savedTab);
  }
  if (savedTab) {
    state.activeTab = savedTab;
    elements.navTabs.forEach(t => {
      if (t.getAttribute('data-tab') === savedTab) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    elements.tabContents.forEach(c => {
      if (c.id === `tab-${savedTab}`) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
    // Bring the restored active tab into view in the scrollable mobile nav.
    const activeTabEl = [...elements.navTabs].find(t => t.getAttribute('data-tab') === savedTab);
    if (activeTabEl) activeTabEl.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      state.activeTab = tabId;
      localStorage.setItem('espp_active_tab', tabId);
      
      elements.navTabs.forEach(t => t.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');

      // Keep the active tab visible in the horizontally-scrollable mobile nav bar.
      tab.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });

      // Re-render chart if switching tabs
      if (tabId === 'calculator' && state.chart) {
        state.chart.resize();
      }
      if (tabId === 'porsche' && state.porscheChart) {
        state.porscheChart.resize();
      }
    });
  });
}

// Fetch Live Stock Price
async function fetchLiveStockPrice() {
  elements.liveTicker.innerHTML = `<span class="pulse-dot pulse"></span> <span class="ticker-text">Aktualisiere Kurs...</span>`;
  
  try {
    const response = await fetch('/api/stock');
    const data = await response.json();
    
    if (data.success || data.fallback) {
      state.usdPrice = data.usdPrice;
      state.eurPrice = data.eurPrice;
      state.exchangeRate = data.exchangeRate;
      state.previousCloseUSD = data.previousCloseUSD || data.usdPrice;
      state.previousCloseEUR = data.previousCloseEUR || data.eurPrice;
      
      // Update UI Inputs
      elements.inputStockPrice.value = state.usdPrice.toFixed(2);
      elements.inputSellPrice.value = state.usdPrice.toFixed(2);
      elements.valStockPriceEUR.textContent = `${state.eurPrice.toFixed(2)} €`;
      elements.valExchangeRate.textContent = state.exchangeRate.toFixed(4);
      
      // Render Live Ticker
      const isUp = state.usdPrice >= state.previousCloseUSD;
      const change = state.usdPrice - state.previousCloseUSD;
      const changePercent = (change / state.previousCloseUSD) * 100;
      
      elements.liveTicker.innerHTML = `
        <span class="pulse-dot"></span>
        <span class="ticker-text" style="white-space: nowrap;">
          <strong>IBM: $${state.usdPrice.toFixed(2)}</strong> 
          (<span style="color: ${isUp ? '#4ade80' : '#f87171'}">${isUp ? '+' : ''}${changePercent.toFixed(1)}%</span>)
        </span>
      `;
      
      // Recalculate
      calculateESPP();
    }
  } catch (error) {
    console.error('Failed to fetch stock price:', error);
    elements.liveTicker.innerHTML = `<span class="pulse-dot error"></span> <span class="ticker-text" style="color:#f87171">Offline (Nutze Fallback)</span>`;
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
      </div>
      <div class="grid-2col" style="margin-top: 20px;">
        <div>
          <h5 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-circle-check text-success"></i> Deine Vorteile</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Minimale Kosten:</strong> Verkauf + Devisentausch kosten insgesamt nur ca. 4€ statt über 50$ bei EquatePlus.</li>
            <li><strong>Klumpenrisiko vermeiden:</strong> Du investierst den Erlös in breit gestreute ETFs statt alles in IBM-Aktien zu halten.</li>
            <li><strong>Voller Rabatt-Hebel:</strong> Du realisierst den 15% Rabatt (bzw. 81% Nettogewinn) sofort als echtes Geld.</li>
          </ul>
        </div>
        <div>
          <h5 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-circle-exclamation text-warning"></i> Wichtig zu beachten</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Zwei Transfers nötig:</strong> Du musst erst bei CapTrader/IBKR den Empfang ankündigen und dann bei EquatePlus senden.</li>
            <li><strong>Dividenden-Zwischenstopp:</strong> Auch wenn Du regelmäßig verkaufst, fallen bis dahin Dividenden bei EquatePlus an – entscheide, ob Du sie auszahlen lässt oder reinvestierst.</li>
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
          <h5 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-circle-check text-success"></i> Deine Vorteile</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Kein Zwangskauf:</strong> Du entscheidest selbst, wann Du Dividenden anlegst, und kaufst nicht ungefragt unrabattierte Aktien.</li>
            <li><strong>Keine 2&nbsp;%-Reinvest-Gebühr:</strong> Du sparst Dir die Gebühr, die EquatePlus auf jede automatisch reinvestierte Dividende einbehält.</li>
          </ul>
        </div>
        <div>
          <h5 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-triangle-exclamation text-danger"></i> Nachteile & Gebühren</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Klumpenrisiko bleibt:</strong> Dein Vermögen hängt stark von der Entwicklung der IBM ab.</li>
            <li><strong>Späterer Verkauf teuer:</strong> Der Verkauf direkt über EquatePlus kostet über 50$ pro Trade plus zusätzliche Bankgebühren.</li>
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
          <h5 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-circle-check text-success"></i> Deine Vorteile</h5>
          <ul class="styled-list" style="color: var(--text-muted); font-size: 0.9rem;">
            <li><strong>Absolut Passiv:</strong> Du musst Dich nicht um Konten, Broker oder manuelle Übertragungen kümmern.</li>
            <li><strong>Zinseszinseffekt:</strong> Dividenden arbeiten sofort wieder in IBM-Aktien weiter.</li>
          </ul>
        </div>
        <div>
          <h5 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-circle-xmark text-danger"></i> Die Nachteile (Hohe Kosten)</h5>
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
  const uploadStatus = document.getElementById('uploadStatus');
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
    accumulatedMonths: elements.inputAccumulatedMonths.value,
    uploadStatusHTML: uploadStatus ? uploadStatus.innerHTML : '',
    uploadStatusClass: uploadStatus ? uploadStatus.className : ''
  };
  
  localStorage.setItem('espp_calculator_state', JSON.stringify(serialized));
  
  if (btnClearCalculator) {
    btnClearCalculator.style.display = 'block';
  }
}

function loadCalculatorState() {
  try {
    const raw = localStorage.getItem('espp_calculator_state');
    const btnClearCalculator = document.getElementById('btnClearCalculator');
    
    if (!raw) {
      if (btnClearCalculator) btnClearCalculator.style.display = 'none';
      return;
    }
    
    const parsed = JSON.parse(raw);
    if (!parsed) return;

    if (parsed.monthlySalary !== undefined) {
      elements.inputMonthlySalary.value = parsed.monthlySalary;
      elements.valMonthlySalary.textContent = `${parseInt(parsed.monthlySalary).toLocaleString('de-DE')} €`;
    }
    if (parsed.savingsRate !== undefined) {
      elements.inputSavingsRate.value = parsed.savingsRate;
      elements.valSavingsRate.textContent = `${parsed.savingsRate} %`;
    }
    if (parsed.taxYear !== undefined) {
      elements.selectTaxYear.value = parsed.taxYear;
    }
    if (parsed.taxRate !== undefined) {
      elements.inputTaxRate.value = parsed.taxRate;
      elements.valTaxRate.textContent = `${parsed.taxRate} %`;
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
    if (parsed.accumulatedMonths !== undefined) {
      elements.inputAccumulatedMonths.value = parsed.accumulatedMonths;
      
      const months = parseInt(parsed.accumulatedMonths);
      if (months >= 12) {
        const years = Math.floor(months / 12);
        const remMonths = months % 12;
        let label = `${months} Monate`;
        if (remMonths === 0) {
          label += ` (${years} ${years === 1 ? 'Jahr' : 'Jahre'})`;
        } else {
          label += ` (${years}J ${remMonths}M)`;
        }
        elements.valAccumulatedMonths.textContent = label;
      } else {
        elements.valAccumulatedMonths.textContent = `${months} Monate`;
      }
    }

    const uploadStatus = document.getElementById('uploadStatus');
    if (uploadStatus && parsed.uploadStatusHTML) {
      uploadStatus.innerHTML = parsed.uploadStatusHTML;
      uploadStatus.className = parsed.uploadStatusClass;
      uploadStatus.classList.remove('hidden-status');
    }
    
    if (btnClearCalculator) {
      btnClearCalculator.style.display = 'block';
    }
  } catch (err) {
    console.error('Error loading calculator state from localStorage:', err);
  }
}

// Calculator Logic
function initCalculator() {
  const btnClearCalculator = document.getElementById('btnClearCalculator');
  if (btnClearCalculator) {
    btnClearCalculator.addEventListener('click', () => {
      localStorage.removeItem('espp_calculator_state');
      window.location.reload();
    });
  }

  // Input Listeners
  elements.inputStockPrice.addEventListener('input', (e) => {
    state.usdPrice = parseFloat(e.target.value) || 0;
    state.eurPrice = state.usdPrice * state.exchangeRate;
    elements.valStockPriceEUR.textContent = `${state.eurPrice.toFixed(2)} €`;
    calculateESPP();
  });
  
  elements.btnFetchStock.addEventListener('click', fetchLiveStockPrice);
  
  elements.inputMonthlySalary.addEventListener('input', (e) => {
    elements.valMonthlySalary.textContent = `${parseInt(e.target.value).toLocaleString('de-DE')} €`;
    calculateESPP();
  });

  elements.inputSavingsRate.addEventListener('input', (e) => {
    elements.valSavingsRate.textContent = `${e.target.value} %`;
    calculateESPP();
  });
  
  elements.selectTaxYear.addEventListener('change', calculateESPP);
  elements.selectChurchTax.addEventListener('change', calculateESPP);
  elements.selectSoli.addEventListener('change', calculateESPP);
  
  elements.inputTaxRate.addEventListener('input', (e) => {
    elements.valTaxRate.textContent = `${e.target.value} %`;
    calculateESPP();
  });
  
  elements.selectBroker.addEventListener('change', calculateESPP);
  
  elements.inputSellPrice.addEventListener('input', calculateESPP);
  
  elements.inputAccumulatedMonths.addEventListener('input', (e) => {
    const months = parseInt(e.target.value);
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      let label = `${months} Monate`;
      if (remMonths === 0) {
        label += ` (${years} ${years === 1 ? 'Jahr' : 'Jahre'})`;
      } else {
        label += ` (${years}J ${remMonths}M)`;
      }
      elements.valAccumulatedMonths.textContent = label;
    } else {
      elements.valAccumulatedMonths.textContent = `${months} Monate`;
    }
    calculateESPP();
  });
  
  // Load saved state if any
  loadCalculatorState();
  
  // Initial calculation
  calculateESPP();
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
  const accumulatedMonths = parseInt(elements.inputAccumulatedMonths.value) || 12;
  const exchangeRate = state.exchangeRate;

  // German employees purchase stock at 15% discount.
  // The monthly contribution is subtracted from Gross salary.
  // Discount is calculated on the market price.
  // If the gross contribution is X, the market value of shares bought is X / 0.85.
  // The discount benefit is (X / 0.85) - X = X * 0.15 / 0.85 = X * 17.65%.
  const monthlyMarketValueEUR = monthlyGrossContribution / 0.85;
  const monthlyDiscountBenefitEUR = monthlyMarketValueEUR - monthlyGrossContribution;
  
  // Total Accumulations
  const totalGrossContribution = monthlyGrossContribution * accumulatedMonths;
  const totalMarketValueEUR = monthlyMarketValueEUR * accumulatedMonths;
  const totalDiscountBenefitEUR = monthlyDiscountBenefitEUR * accumulatedMonths;
  
  // Lohnabrechnung-Effekt: The net salary reduction is only gross * (1 - effectiveTaxRate)
  const totalNetContribution = totalGrossContribution * (1 - effectiveTaxRate);
  
  // Taxation on purchase (Geldwerter Vorteil):
  // Freibetrag § 3 Nr. 39 EStG: 2.000€ (ab 2024) or 1.440€ (bis 2023) per year.
  // Let's calculate the total Freibetrag based on calendar years represented.
  const yearsRepresented = Math.ceil(accumulatedMonths / 12);
  const annualFreibetrag = (taxYear === '2026' || taxYear === '2024') ? 2000 : 1440;
  const totalFreibetrag = annualFreibetrag * yearsRepresented;
  
  const taxableDiscountBenefit = Math.max(0, totalDiscountBenefitEUR - totalFreibetrag);
  const purchaseTaxPaid = taxableDiscountBenefit * effectiveTaxRate;
  
  // Number of shares acquired
  const sharePriceUSD = stockPriceUSD;
  const sharePriceEUR = sharePriceUSD * exchangeRate;
  const totalShares = totalMarketValueEUR / sharePriceEUR;
  
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
  // - 27.996% (9% church tax)
  // Let's implement this standard calculation exactly!
  let abgeltungRate = 0.26375;
  if (churchTaxRate === 0.08) abgeltungRate = 0.278186;
  else if (churchTaxRate === 0.09) abgeltungRate = 0.27996;

  let capGainsTaxRate = abgeltungRate;
  // Günstigerprüfung: If the personal effective marginal tax rate is lower than the flat-rate capital gains tax,
  // the taxpayer can opt to pay the personal rate instead.
  if (effectiveTaxRate < capGainsTaxRate) {
    capGainsTaxRate = effectiveTaxRate;
  }

  // Capital gains tax.
  // German broker "Steuer-Falle" (§ 43a Abs. 2 Satz 7 EStG): when shares are transferred to a
  // German Depot without a known cost basis, the bank applies the Ersatzbemessungsgrundlage =
  // 30% of the gross proceeds as the tax base (taxed at the full Abgeltungsteuer, no Günstigerprüfung),
  // instead of 26,375% on the actual gain. The over-withheld amount is partly reclaimable via the
  // Steuererklärung once the real cost basis is proven.
  let capitalGainsTaxPaid;
  if (broker === 'german') {
    capitalGainsTaxPaid = grossSaleRevenueEUR * 0.30 * abgeltungRate;
  } else {
    capitalGainsTaxPaid = capitalGainsEUR * capGainsTaxRate;
  }
  
  // Broker fees calculation
  let brokerFeesEUR = 0;
  if (broker === 'captrader') {
    // CapTrader: approx 2€ trade fee + 2€ currency swap
    brokerFeesEUR = 4.00;
  } else if (broker === 'equateplus') {
    // EquatePlus: $19.95 commission + $35.00 wire fee + 0.5% exchange rate spread + 13€ DB fee
    const feesUSD = 19.95 + 35.00 + (grossSaleRevenueEUR / exchangeRate * 0.005);
    brokerFeesEUR = (feesUSD * exchangeRate) + 13.00;
  } else if (broker === 'german') {
    // German Broker: ca 10€ commission
    brokerFeesEUR = 10.00;
  }

  // Net Cash returned to pocket
  const netCashReceived = grossSaleRevenueEUR - capitalGainsTaxPaid - brokerFeesEUR;
  
  // Net Profit: Cash returned minus the real net investment from paycheck and any taxes paid afterwards
  const totalEmployeeCost = totalNetContribution + purchaseTaxPaid;
  const netProfitEUR = netCashReceived - totalEmployeeCost;
  
  // Return percentages
  const netReturnOnNetCapital = totalEmployeeCost > 0 ? (netProfitEUR / totalEmployeeCost) * 100 : 0;
  
  // Show the German-broker 30% withholding warning only when that broker is selected.
  if (elements.germanBrokerNote) {
    elements.germanBrokerNote.style.display = broker === 'german' ? 'block' : 'none';
  }

  // Update Outputs in UI
  elements.netProfitEuro.textContent = `${netProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.netProfitPercent.textContent = `${netProfitEUR >= 0 ? '+' : ''}${netReturnOnNetCapital.toFixed(1)}%`;
  
  if (netProfitEUR >= 0) {
    elements.netProfitPercent.className = "percentage-pill positive";
    elements.netProfitPercent.style.background = "";
    elements.netProfitPercent.style.color = "";
    elements.netProfitPercent.style.border = "";
    elements.netProfitEuro.style.color = "#fff";
  } else {
    elements.netProfitPercent.className = "percentage-pill";
    elements.netProfitPercent.style.background = "rgba(239, 68, 68, 0.15)";
    elements.netProfitPercent.style.color = "#f87171";
    elements.netProfitPercent.style.border = "1px solid rgba(239, 68, 68, 0.2)";
    elements.netProfitEuro.style.color = "#f87171";
  }

  elements.netInvestment.textContent = `${totalEmployeeCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.netReturnOnCapital.textContent = `${netReturnOnNetCapital.toFixed(1)} %`;
  
  elements.rowGrossContribution.textContent = `${totalGrossContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.rowNetContribution.textContent = `${totalNetContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.rowDiscountBenefit.textContent = `${totalDiscountBenefitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.rowDiscountTax.textContent = `${purchaseTaxPaid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.rowCapitalGainsTax.textContent = `${capitalGainsTaxPaid.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  elements.rowFees.textContent = `${brokerFeesEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  
  // Update Sale Process Detail section
  const fmtEUR = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUSD = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const discountedPricePerShare = sharePriceEUR * 0.85;
  const discountedPricePerShareUSD = stockPriceUSD * 0.85;
  
  elements.rowShareCount.textContent = `${totalShares.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Stk.`;
  elements.rowBuyPriceEUR.textContent = `${fmtEUR(sharePriceEUR)} €`;
  document.getElementById('rowBuyPriceUSD').textContent = `($${fmtUSD(stockPriceUSD)})`;
  elements.rowDiscountedPrice.textContent = `${fmtEUR(discountedPricePerShare)} €`;
  document.getElementById('rowDiscountedPriceUSD').textContent = `($${fmtUSD(discountedPricePerShareUSD)})`;
  elements.rowTotalMarketValue.textContent = `${fmtEUR(totalMarketValueEUR)} €`;
  elements.rowSellPriceEUR.textContent = `${fmtEUR(sellPriceEUR)} €`;
  document.getElementById('rowSellPriceUSD').textContent = `($${fmtUSD(sellPriceUSD)})`;
  elements.rowGrossSaleRevenue.textContent = `${fmtEUR(grossSaleRevenueEUR)} €`;
  
  // Color the capital gains based on positive/negative
  elements.rowCapitalGainsAmount.textContent = `${capitalGainsEUR > 0 ? '+' : ''}${fmtEUR(capitalGainsEUR)} €`;
  
  elements.rowCapGainsTaxSale.textContent = `${capitalGainsTaxPaid > 0 ? '− ' : ''}${fmtEUR(capitalGainsTaxPaid)} €`;
  elements.rowDiscountTaxSale.textContent = `${purchaseTaxPaid > 0 ? '− ' : ''}${fmtEUR(purchaseTaxPaid)} €`;
  elements.rowBrokerFeesSale.textContent = `${brokerFeesEUR > 0 ? '− ' : ''}${fmtEUR(brokerFeesEUR)} €`;
  
  elements.rowNetSaleProceeds.textContent = `${fmtEUR(netCashReceived)} €`;
  elements.rowNetCostsSale.textContent = `− ${fmtEUR(totalNetContribution)} €`;
  elements.rowDiscountTaxSale2.textContent = `− ${fmtEUR(purchaseTaxPaid)} €`;
  
  elements.rowFinalNetProfit.textContent = `${fmtEUR(netProfitEUR)} €`;
  
  // Update dynamic months labels in breakdown
  document.querySelectorAll('.months-count').forEach(el => {
    el.textContent = accumulatedMonths;
  });
  
  // Update paycheck warning info
  elements.lblGross500.textContent = `${monthlyGrossContribution.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
  elements.lblTax35.textContent = `${(effectiveTaxRate*100).toFixed(1)}%`;
  
  const monthlyNetDeduction = monthlyGrossContribution * (1 - effectiveTaxRate);
  elements.lblNet276.textContent = `${monthlyNetDeduction.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
  
  // Calculate instant profit margin: (Market Value - Net Deduction) / Net Deduction
  const instantGain = ((monthlyMarketValueEUR - monthlyNetDeduction) / monthlyNetDeduction) * 100;
  elements.lblInstantGain.textContent = `${instantGain.toFixed(0)}%`;

  // Draw or update Chart.js visualization
  updateChart(totalNetContribution, purchaseTaxPaid, capitalGainsTaxPaid + brokerFeesEUR, netProfitEUR);

  // Remember the Rechner economics (hypothetical future shares) for the goal tracker,
  // then update it. The goal tracker prefers REAL portfolio holdings when available.
  rechnerEconomics = {
    shares: totalShares,
    netProfitEUR,
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

function updateChart(netInvest, payrollTax, sellCosts, netProfit) {
  const ctx = document.getElementById('profitChart').getContext('2d');
  
  const dataValues = [
    parseFloat(netInvest.toFixed(2)),
    parseFloat(payrollTax.toFixed(2)),
    parseFloat(sellCosts.toFixed(2)),
    parseFloat(Math.max(0, netProfit).toFixed(2))
  ];
  
  if (state.chart) {
    state.chart.data.datasets[0].data = dataValues;
    state.chart.update();
  } else {
    state.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Netto-Sparrate', 'Lohnsteuer (AKP GwV)', 'Gebühren & KSt.', 'Netto-Gewinn'],
        datasets: [{
          data: dataValues,
          backgroundColor: [
            '#3b82f6', // Netto-Invest
            '#fbbf24', // Lohnsteuer
            '#f87171', // Gebühren
            '#10b981'  // Netto-Gewinn
          ],
          borderColor: '#10162e',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#9ca3af',
              font: {
                family: 'Outfit',
                size: 11
              },
              boxWidth: 12
            }
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
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
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
    const salaryRegex = /(?:1101\s+)?Grundgehalt\s+(?:[A-Z\s#$/]+\s+)?([\d\.,]+)/i;
    const salaryMatch = text.match(salaryRegex);
    
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
    let extractedSavingsRate = null;
    let extractedChurchTax = 0;
    let extractedTaxClass = 1;

    if (salaryMatch) {
      const salaryStr = salaryMatch[1].replace(/\./g, '').replace(',', '.');
      extractedSalary = parseFloat(salaryStr);
    }

    if (akpMatch && extractedSalary) {
      const akpStr = akpMatch[1].replace(/\./g, '').replace(',', '.');
      const akpValue = parseFloat(akpStr);
      // Sparquote = (AKP / Salary) * 100
      // We subtract 0.3 before rounding to compensate for upward skew caused by variable/commission lag
      extractedSavingsRate = Math.round(((akpValue / extractedSalary) * 100) - 0.3);
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

    // Apply values to inputs
    elements.inputMonthlySalary.value = extractedSalary;
    elements.valMonthlySalary.textContent = `${parseInt(extractedSalary).toLocaleString('de-DE')} €`;

    if (extractedSavingsRate !== null) {
      elements.inputSavingsRate.value = extractedSavingsRate;
      elements.valSavingsRate.textContent = `${extractedSavingsRate} %`;
    } else {
      elements.inputSavingsRate.value = 10;
      elements.valSavingsRate.textContent = '10 %';
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
    const estimatedMarginalRate = estimateGrenzsteuersatz(extractedSalary, extractedTaxClass);
    elements.inputTaxRate.value = estimatedMarginalRate;
    elements.valTaxRate.textContent = `${estimatedMarginalRate} %`;

    // Recalculate everything
    calculateESPP();

    let successMsg = `<strong><i class="fa-solid fa-circle-check"></i> Daten erfolgreich extrahiert:</strong><br>
      • Bruttogehalt: <strong>${extractedSalary.toLocaleString('de-DE', {minimumFractionDigits: 2})} €</strong><br>
      • Sparquote: <strong>${extractedSavingsRate !== null ? extractedSavingsRate + ' %' : '10 % (nicht in PDF, Standard)'}</strong><br>
      • Steuerklasse: <strong>${extractedTaxClass}</strong><br>
      • Kirchensteuer: <strong>${extractedChurchTax > 0 ? extractedChurchTax + ' %' : 'Keine'}</strong><br>
      • Geschätzter Grenzsteuersatz: <strong>${estimatedMarginalRate} %</strong> (basierend auf Gehalt)`;
      
    showStatus(successMsg, 'success');
    saveCalculatorState();
  }

  // Linear estimation of German marginal tax rate (Grenzsteuersatz)
  function estimateGrenzsteuersatz(monthlyGross, taxClass) {
    const annualGross = monthlyGross * 12;
    const taxYear = elements.selectTaxYear.value;
    
    // Estimate taxable income (zu versteuerndes Einkommen, zvE)
    // Subtract approx 20% social security contributions and 1,230 € Werbungskosten
    let zvE = annualGross * 0.82 - 1230;
    
    // Tax class 3 splitting adjustment
    if (taxClass === 3) {
      zvE = zvE / 2;
    } else if (taxClass === 5) {
      zvE = zvE * 1.5; // Penalty
    }

    let marginalRate = 14;

    if (taxYear === '2026') {
      if (zvE <= 12348) {
        marginalRate = 14;
      } else if (zvE > 12348 && zvE <= 17799) {
        marginalRate = 14 + ((zvE - 12348) / (17799 - 12348)) * (23.97 - 14);
      } else if (zvE > 17799 && zvE <= 69879) {
        marginalRate = 23.97 + ((zvE - 17799) / (69879 - 17799)) * (42 - 23.97);
      } else if (zvE > 69879 && zvE <= 277826) {
        marginalRate = 42;
      } else {
        marginalRate = 45;
      }
    } else if (taxYear === '2023') {
      if (zvE <= 10908) {
        marginalRate = 14;
      } else if (zvE > 10908 && zvE <= 16000) {
        marginalRate = 14 + ((zvE - 10908) / (16000 - 10908)) * 10;
      } else if (zvE > 16000 && zvE <= 62810) {
        marginalRate = 24 + ((zvE - 16000) / (62810 - 16000)) * 18;
      } else if (zvE > 62810 && zvE <= 277825) {
        marginalRate = 42;
      } else {
        marginalRate = 45;
      }
    } else {
      // Default to 2024 / 2025 brackets
      if (zvE <= 11784) {
        marginalRate = 14;
      } else if (zvE > 11784 && zvE <= 17005) {
        marginalRate = 14 + ((zvE - 11784) / (17005 - 11784)) * 10;
      } else if (zvE > 17005 && zvE <= 66760) {
        marginalRate = 24 + ((zvE - 17005) / (66760 - 17005)) * 18;
      } else if (zvE > 66760 && zvE <= 277825) {
        marginalRate = 42;
      } else {
        marginalRate = 45;
      }
    }

    return Math.round(marginalRate);
  }
}

// Goal Tracker Logic
function initPorscheTracker() {
  if (elements.inputStockGrowth) {
    elements.inputStockGrowth.addEventListener('input', (e) => {
      elements.valStockGrowth.textContent = `${e.target.value} %`;
      calculateESPP();
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
  if (elements.goalUrl) {
    elements.goalUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadGoalFromUrl(); } });
  }
  if (elements.goalName) {
    elements.goalName.addEventListener('input', () => {
      state.goal.name = elements.goalName.value;
      if (elements.goalBadge) elements.goalBadge.textContent = goalBadgeText(state.goal.name);
      saveGoal();
    });
  }
  if (elements.goalPrice) {
    elements.goalPrice.addEventListener('input', () => {
      state.goal.price = parseFloat(elements.goalPrice.value) || 0;
      saveGoal();
      calculateESPP();
    });
  }

  // Restore a previously saved goal (persisted across reloads).
  try {
    const saved = localStorage.getItem(GOAL_LS_KEY);
    if (saved) {
      const g = JSON.parse(saved);
      if (g && typeof g.price !== 'undefined') {
        state.goal = { name: g.name || 'Mein Sparziel', image: g.image || null, price: g.price, url: g.url || null };
      }
    }
  } catch (e) { /* ignore */ }
  renderGoal();
}

const GOAL_LS_KEY = 'espp_goal_v1';

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
    elements.goalPrice.value = (g.price != null) ? Number(g.price).toFixed(2) : '';
  }
  if (elements.goalImageWrap && elements.goalImage) {
    if (g.image) {
      elements.goalImage.src = g.image;
      elements.goalImageWrap.style.setProperty('--goal-img', `url("${g.image}")`); // blurred backdrop
      elements.goalImageWrap.style.display = '';
    } else {
      elements.goalImage.removeAttribute('src');
      elements.goalImageWrap.style.removeProperty('--goal-img');
      elements.goalImageWrap.style.display = 'none';
    }
  }
  if (elements.goalLink) {
    if (g.url) { elements.goalLink.href = g.url; elements.goalLink.style.display = ''; }
    else { elements.goalLink.style.display = 'none'; }
  }
}

function setCustomGoal(goal) {
  state.goal = { name: goal.name, image: goal.image, price: goal.price, url: goal.url };
  saveGoal();
  renderGoal();
  calculateESPP();
}

// Load a goal from the input: a pasted link (any shop) → /api/product, or free text →
// /api/resolve-goal (SearXNG finds the product, price and image).
async function loadGoalFromUrl() {
  const input = (elements.goalUrl.value || '').trim();
  if (!input) { showGoalStatus('Bitte einen Produktlink einfügen oder ein Ziel eingeben.', 'error'); return; }

  const isUrl = /^https?:\/\//i.test(input);
  const endpoint = isUrl
    ? `/api/product?url=${encodeURIComponent(input)}`
    : `/api/resolve-goal?q=${encodeURIComponent(input)}`;
  showGoalStatus(`<span class="loading-spinner"></span> ${isUrl ? 'Lade Produktdaten…' : 'Suche Dein Ziel…'}`, 'loading');

  try {
    const resp = await fetch(endpoint);
    const data = await resp.json();

    if (!data || (!data.title && !data.price && !data.image)) {
      showGoalStatus(data && data.message
        ? data.message
        : (data && data.blocked ? 'Die Seite hat die Anfrage blockiert. Bitte Preis manuell eintragen.' : 'Konnte keine Produktdaten finden.'), 'error');
      return;
    }

    // Convert to EUR (the tracker works in EUR). EUR + backend-normalized exotic currencies
    // arrive as 'EUR'; only USD/GBP still need converting here.
    let priceEUR = data.price || 0;
    if (data.currency === 'USD') priceEUR *= (state.exchangeRate || 0.92);
    else if (data.currency === 'GBP') priceEUR *= 1.17;

    setCustomGoal({
      name: data.title || input,
      image: data.image || null,
      price: priceEUR ? Math.round(priceEUR * 100) / 100 : 0,
      url: isUrl ? input : (data.sourceUrl || null)
    });

    const nm = (data.title || input);
    const short = nm.length > 45 ? nm.slice(0, 45) + '…' : nm;
    const fxNote = data.originalCurrency ? ` (umgerechnet aus ${data.originalCurrency})` : '';
    if (!data.price) {
      showGoalStatus(`Ziel „${short}“ geladen, aber Preis nicht gefunden – bitte unten eintragen.`, 'warning');
    } else if (data.currency && data.currency !== 'EUR' && data.currency !== 'USD' && data.currency !== 'GBP') {
      showGoalStatus(`Ziel „${short}“ geladen – Preis in ${data.currency}, bitte prüfen.`, 'warning');
    } else {
      showGoalStatus(`✓ Ziel geladen: ${short}${fxNote}`, 'success');
    }
  } catch (e) {
    showGoalStatus('Fehler beim Laden. Läuft der Server (und ist SearXNG erreichbar)?', 'error');
  }
}

// The tracker's target amount = the user's goal price.
function getTargetPrice() {
  return parseFloat(elements.goalPrice && elements.goalPrice.value) || (state.goal && state.goal.price) || 0;
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
function updateGoalTracker() {
  if (!rechnerEconomics || !elements.inputStockGrowth) return;
  const e = rechnerEconomics;
  const targetPrice = getTargetPrice();
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
      // needed at today's price (newly bought ESPP shares ~= bought at FMV, so each one sold
      // immediately nets ≈ its current price). The "how long to save" answer is the
      // accumulation projection below (porscheTimeNeeded / porscheTargetDate).
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
    currentValueNet = e.netProfitEUR;
    costBasisPerShareEUR = e.sharePriceEUR;
    outOfPocketNow = e.totalEmployeeCost;
    sharesPerMonth = currentPriceEUR > 0 ? (e.monthlyGrossContribution / 0.85) / currentPriceEUR : 0;
    const gainPerShare = Math.max(0, e.sellPriceEUR - e.sharePriceEUR);
    const netPerShare = e.sellPriceEUR - gainPerShare * capRate;
    const n = netPerShare > 0 ? (targetPrice + brokerFee) / netPerShare : 0;
    sharesText = n > 0 ? `${Math.ceil(n).toLocaleString('de-DE')} Aktien` : '–';
    sharesSubtitle = 'hypothetisch – lade Statements für echte Zahlen';
  }

  // ---- Progress ----
  const progressPercent = targetPrice > 0 ? Math.max(0, Math.min(100, (currentValueNet / targetPrice) * 100)) : 0;
  if (elements.porscheProgressBadge) elements.porscheProgressBadge.textContent = `${progressPercent.toFixed(1)}% Erreicht`;
  if (elements.porscheRadialPercent) {
    elements.porscheRadialPercent.textContent = ((progressPercent > 0 && progressPercent < 10) ? progressPercent.toFixed(1) : Math.round(progressPercent)) + '%';
  }
  if (elements.porscheRadialFill) {
    const circ = 2 * Math.PI * 42;
    elements.porscheRadialFill.style.strokeDashoffset = circ - (progressPercent / 100) * circ;
  }
  if (elements.porscheCurrentSavedLabel) elements.porscheCurrentSavedLabel.textContent = usePortfolio ? 'Netto-Verkaufswert Deiner Aktien' : 'Erwarteter Netto-Gewinn';
  if (elements.porscheCurrentSaved) elements.porscheCurrentSaved.textContent = `${currentValueNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (elements.porscheRemainingAmount) elements.porscheRemainingAmount.textContent = `${Math.max(0, targetPrice - currentValueNet).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // ---- Time-to-goal: accumulate ESPP shares until the net sellable value covers the goal ----
  let monthsNeeded = 0;
  let achieved = targetPrice > 0 && currentValueNet >= targetPrice;
  if (!achieved && targetPrice > 0) {
    for (let t = 1; t <= 1200; t++) {
      const shares = currentShares + t * sharesPerMonth;
      const grossEUR = shares * currentPriceEUR * Math.pow(1 + r, t);
      const gainEUR = Math.max(0, grossEUR - shares * costBasisPerShareEUR);
      const cashout = grossEUR - gainEUR * capRate - brokerFee;
      if (cashout >= targetPrice) { achieved = true; monthsNeeded = t; break; }
    }
  }

  if (elements.porscheTimeNeeded) {
    if (achieved && monthsNeeded === 0) elements.porscheTimeNeeded.textContent = 'Jetzt leistbar! 🎉';
    else if (achieved) {
      const years = Math.floor(monthsNeeded / 12), rem = monthsNeeded % 12;
      let str = '';
      if (years > 0) str += `${years} ${years === 1 ? 'Jahr' : 'Jahre'}`;
      if (rem > 0) { if (str) str += ' und '; str += `${rem} ${rem === 1 ? 'Monat' : 'Monate'}`; }
      // Only append the total-months hint when the main text is in years (else it's redundant,
      // e.g. "6 Monate (6 Monate)").
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
  const monthlyOut = e.accumulatedMonths > 0 ? (outOfPocketNow / e.accumulatedMonths) : 0;
  const totalOutPocket = outOfPocketNow + ((achieved && monthsNeeded > 0) ? monthsNeeded * monthlyOut : 0);
  const leverageAmount = Math.max(0, targetPrice - totalOutPocket);
  const leveragePercent = targetPrice > 0 ? (leverageAmount / targetPrice) * 100 : 0;
  if (elements.porscheOutPocket) elements.porscheOutPocket.textContent = `${totalOutPocket.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
  if (elements.porscheLeverageAmount) elements.porscheLeverageAmount.textContent = `${leverageAmount.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
  if (elements.porscheLeveragePercent) elements.porscheLeveragePercent.textContent = `${leveragePercent.toFixed(0)}%`;

  // ---- Projection chart ----
  updatePorscheGrowthChart(
    monthsNeeded, currentShares, costBasisPerShareEUR, currentPriceEUR,
    e.monthlyGrossContribution, e.effectiveTaxRate, capRate, brokerFee,
    growthRate, targetPrice, outOfPocketNow, e.accumulatedMonths
  );
}

function updatePorscheGrowthChart(monthsNeeded, currentShares, sharePriceEUR, sellPriceEUR, monthlyGrossContribution, effectiveTaxRate, capGainsTaxRate, brokerFees, growthRate, targetPrice, totalEmployeeCost, accumulatedMonthsInput) {
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
  
  const monthlyOutPocket = totalEmployeeCost / accumulatedMonthsInput;
  
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
    targetLineData.push(targetPrice);
    
    if (t === monthsProj) break;
  }
  
  if (elements.porscheChartYearBadge) {
    if (monthsNeeded > 0) {
      const yrs = (monthsNeeded / 12).toFixed(1);
      elements.porscheChartYearBadge.textContent = `${yrs} Jahre Projektion`;
    } else {
      elements.porscheChartYearBadge.textContent = "Bereits erreicht";
    }
  }
  
  const targetLabel = 'Zielbetrag';

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
            borderColor: '#00f2fe',
            backgroundColor: 'rgba(0, 242, 254, 0.04)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#00f2fe',
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
              color: '#9ca3af',
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
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#9ca3af',
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
    uploadStatusHTML: portfolioElements.csvUploadStatus ? portfolioElements.csvUploadStatus.innerHTML : '',
    uploadStatusClass: portfolioElements.csvUploadStatus ? portfolioElements.csvUploadStatus.className : '',
    sellQuantity: portfolioElements.sellQuantity ? portfolioElements.sellQuantity.value : '',
    sellPrice: portfolioElements.sellPrice ? portfolioElements.sellPrice.value : '',
    sellBroker: portfolioElements.sellBroker ? portfolioElements.sellBroker.value : ''
  };
  localStorage.setItem('espp_portfolio_state', JSON.stringify(serialized));
  
  if (btnClearPortfolio) {
    btnClearPortfolio.style.display = 'block';
  }
}

function loadPortfolioState() {
  try {
    const raw = localStorage.getItem('espp_portfolio_state');
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
      if (portfolioElements.btnAnalyzePortfolio) {
        portfolioElements.btnAnalyzePortfolio.disabled = false;
      }
      
      // Update inputs
      if (portfolioElements.portfolioCurrentPrice) {
        portfolioElements.portfolioCurrentPrice.value = portfolioState.currentPrice.toFixed(2);
      }
      if (portfolioElements.portfolioExchangeRate) {
        portfolioElements.portfolioExchangeRate.value = portfolioState.exchangeRate.toFixed(4);
      }

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

      // Restore upload status if any
      if (parsed.uploadStatusHTML && portfolioElements.csvUploadStatus) {
        portfolioElements.csvUploadStatus.innerHTML = parsed.uploadStatusHTML;
        portfolioElements.csvUploadStatus.className = parsed.uploadStatusClass;
        portfolioElements.csvUploadStatus.classList.remove('hidden-status');
      }

      // Re-run calculation/analysis
      analyzePortfolio();
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
    btnAnalyzePortfolio: document.getElementById('btnAnalyzePortfolio'),
    portfolioCurrentPrice: document.getElementById('portfolioCurrentPrice'),
    portfolioExchangeRate: document.getElementById('portfolioExchangeRate'),
    btnFetchPortfolioPrice: document.getElementById('btnFetchPortfolioPrice'),
    portfolioResults: document.getElementById('portfolioResults'),
    portfolioTransactionsCard: document.getElementById('portfolioTransactionsCard'),
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

  // Analyze button
  portfolioElements.btnAnalyzePortfolio.addEventListener('click', analyzePortfolio);

  // Sortable tables: click any column header in the Portfolio-Analyse tab to sort by that column.
  // Delegated so it keeps working after the tables are re-rendered by analyzePortfolio.
  const portfolioTab = document.getElementById('tab-portfolio');
  if (portfolioTab) {
    portfolioTab.addEventListener('click', (e) => {
      const th = e.target.closest('th');
      if (!th) return;
      const table = th.closest('table.portfolio-table');
      if (!table || !table.tBodies[0]) return;
      sortPortfolioTable(table, Array.from(th.parentNode.children).indexOf(th), th);
    });
  }

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

  // Toggle CapTrader details collapsible
  if (portfolioElements.btnToggleCapTraderDetails) {
    portfolioElements.btnToggleCapTraderDetails.addEventListener('click', () => {
      const isHidden = portfolioElements.capTraderActivityDetails.style.display === 'none';
      portfolioElements.capTraderActivityDetails.style.display = isHidden ? 'block' : 'none';
      portfolioElements.btnToggleCapTraderDetails.innerHTML = isHidden ?
        `<i class="fa-solid fa-folder-closed"></i> CapTrader-/IBKR-Transaktionsdetails ausblenden` :
        `<i class="fa-solid fa-folder-open"></i> CapTrader-/IBKR-Transaktionsdetails anzeigen`;
    });
  }

  // Sync with main calculator price as an initial placeholder...
  portfolioElements.portfolioCurrentPrice.value = state.usdPrice.toFixed(2);
  portfolioElements.portfolioExchangeRate.value = state.exchangeRate.toFixed(4);
  portfolioState.currentPrice = state.usdPrice;
  portfolioState.exchangeRate = state.exchangeRate;

  const btnClearPortfolio = document.getElementById('btnClearPortfolio');
  if (btnClearPortfolio) {
    btnClearPortfolio.addEventListener('click', () => {
      localStorage.removeItem('espp_portfolio_state');
      window.location.reload();
    });
  }

  // Load saved portfolio state if any
  loadPortfolioState();

  // ...then immediately replace it with the live IBM price on load.
  fetchPortfolioPrice({ silent: true });
}

// Fetch the current IBM price + USD/EUR rate and apply it to the portfolio inputs.
// silent: don't show a status toast (used for the automatic fetch on page load).
async function fetchPortfolioPrice({ silent = false } = {}) {
  try {
    const response = await fetch('/api/stock/current');
    const data = await response.json();
    if (data.success) {
      portfolioElements.portfolioCurrentPrice.value = data.price.toFixed(2);
      portfolioElements.portfolioExchangeRate.value = data.exchangeRate.toFixed(4);
      // Default the simulated sell price to the live IBM price too.
      if (portfolioElements.sellPrice) {
        portfolioElements.sellPrice.value = data.price.toFixed(2);
      }
      portfolioState.currentPrice = data.price;
      portfolioState.exchangeRate = data.exchangeRate;
      if (!silent) {
        showPortfolioStatus(`Kurs aktualisiert: $${data.price.toFixed(2)}`, 'success');
      }

      if (portfolioState.transactions && portfolioState.transactions.length > 0) {
        analyzePortfolio();
      }
    }
  } catch (error) {
    if (!silent) showPortfolioStatus('Fehler beim Abrufen des Kurses', 'error');
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
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
  
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
    
    if (portfolioState.transactions && portfolioState.transactions.length > 0) {
      analyzePortfolio();
    } else {
      showPortfolioStatus(`✓ CapTrader/IBKR (${data.year}) geladen. Lade nun ein EquatePlus Statement hoch für die Gesamtübersicht.`, 'success');
      savePortfolioState();
    }
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
    portfolioElements.btnAnalyzePortfolio.disabled = false;
    showPortfolioStatus(`✓ Jahres-Statement parsed: ${tx.length} Transaktionen erkannt`, 'success');
    
    if (Object.keys(portfolioState.capTraderPositions).length > 0) {
      analyzePortfolio();
    } else {
      savePortfolioState();
    }
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
    portfolioElements.btnAnalyzePortfolio.disabled = false;
    const yr = parsed.statementDate ? parsed.statementDate.getFullYear() : '?';
    showPortfolioStatus(`✓ Altes Plan-Statement (${yr}) geladen: ${parsed.purchases.length} Käufe erkannt`, 'success');

    if (Object.keys(portfolioState.capTraderPositions).length > 0) {
      analyzePortfolio();
    } else {
      savePortfolioState();
    }
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



// Analyze Portfolio
async function analyzePortfolio() {
  if (portfolioState.transactions.length === 0) return;
  
  showPortfolioStatus('Lade historische Kurse & Wechselkurse...', 'loading');
  portfolioElements.btnAnalyzePortfolio.disabled = true;
  
  try {
    const exchangeRate = parseFloat(portfolioElements.portfolioExchangeRate.value) || portfolioState.exchangeRate;
    portfolioState.exchangeRate = exchangeRate;
    
    const currentPrice = parseFloat(portfolioElements.portfolioCurrentPrice.value) || portfolioState.currentPrice;
    portfolioState.currentPrice = currentPrice;

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
    portfolioElements.sellQuantitySlider.value = 0;
    portfolioElements.sellQuantity.max = totalShares.toFixed(5);
    portfolioElements.sellQuantity.value = 0;
    portfolioElements.sellPrice.value = currentPrice.toFixed(2);

    // Display card and run simulation once at 0 to clear
    portfolioElements.portfolioSellSimulatorCard.style.display = 'block';
    updateSellSimulation();

    // Refresh the goal tracker so it uses these real holdings.
    updateGoalTracker();

    showPortfolioStatus('✓ Analyse abgeschlossen', 'success');
    savePortfolioState();
    
  } catch (error) {
    showPortfolioStatus('Fehler bei der Analyse: ' + error.message, 'error');
  } finally {
    portfolioElements.btnAnalyzePortfolio.disabled = false;
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
    const response = await fetch(`/api/stock/historical-range?period1=${period1}&period2=${period2}`);
    const data = await response.json();
    
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
    const response = await fetch(`/api/forex/historical-range?period1=${period1}&period2=${period2}`);
    const data = await response.json();
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
      taxableGainEUR: Math.max(0, revenueEUR - taxCostEUR)
    });
  }

  const totalProceedsEUR = soldLots.reduce((s, l) => s + l.revenueEUR, 0);
  const totalCashCostEUR = soldLots.reduce((s, l) => s + l.cashCostEUR, 0);
  const totalTaxableGainEUR = soldLots.reduce((s, l) => s + l.taxableGainEUR, 0);

  // Abgeltungsteuer 26,375 % (+ Kirchensteuer-Varianten). Sparer-Pauschbetrag nicht automatisch.
  let taxRate = 0.26375;
  const churchTaxPercent = parseInt(document.getElementById('selectChurchTax')?.value) || 0;
  if (churchTaxPercent === 9) taxRate = 0.279951;
  else if (churchTaxPercent === 8) taxRate = 0.278186;
  const totalTaxEUR = totalTaxableGainEUR * taxRate;

  // Broker fees — same model as the "Rechner" tab.
  let totalFeesEUR = 0;
  if (qtyToSell > 0 && soldLots.length > 0) {
    if (broker === 'broker-c') {
      totalFeesEUR = 4.00; // CapTrader/IBKR: ~2€ Trade + ~2€ Devisentausch
    } else {
      const feesUSD = 19.95 + 35.00 + (totalProceedsEUR / sellRate) * 0.005;
      totalFeesEUR = (feesUSD * sellRate) + 13.00; // EquatePlus/CS: Provision + Wire + FX + DB
    }
  }

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

  // Render metrics
  portfolioElements.simValProceeds.textContent = formatEuro(r.totalProceedsEUR);
  portfolioElements.simValCashCost.textContent = formatEuro(r.totalCashCostEUR);
  portfolioElements.simValTaxableGain.textContent = formatEuro(r.totalTaxableGainEUR);
  portfolioElements.simValTax.textContent = formatEuro(r.totalTaxEUR);
  portfolioElements.simValFees.textContent = formatEuro(r.totalFeesEUR);
  portfolioElements.simValNetProfit.textContent = (r.netProfitEUR >= 0 ? '+' : '') + formatEuro(r.netProfitEUR);
  portfolioElements.simValNetProfit.className = r.netProfitEUR >= 0 ? 'value-positive' : 'value-negative';
  portfolioElements.simValCashout.textContent = formatEuro(r.cashoutEUR);

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

// ---- Sortable Portfolio-Analyse tables (generic DOM sorter) -----------------------------------
// Parses the displayed values; handles dd.mm.yyyy dates and both de ("1.234,56") and toFixed/$
// ("180.00", "0.61443") number formats. Sorts only the <tbody> (totals in <tfoot> stay put).
function parseSortDate(s) {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
  return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getTime();
}
function parseSortNumber(s) {
  let t = s.replace(/[^0-9.,-]/g, '');
  if (!t || t === '-') return null;
  const hasDot = t.includes('.'), hasComma = t.includes(',');
  if (hasDot && hasComma) {
    t = (t.lastIndexOf(',') > t.lastIndexOf('.')) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (hasComma) {
    t = t.replace(/\./g, '').replace(',', '.');         // lone comma = decimal (de format)
  } else if ((t.match(/\./g) || []).length > 1) {
    t = t.replace(/\./g, '');                            // multiple dots = thousands grouping
  } // else a single dot stays a decimal point ($-prices / toFixed values)
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}
function detectColType(vals) {
  const ne = vals.filter(v => v);
  if (!ne.length) return 'text';
  if (ne.filter(v => parseSortDate(v) !== null).length / ne.length >= 0.6) return 'date';
  if (ne.filter(v => parseSortNumber(v) !== null).length / ne.length >= 0.6) return 'number';
  return 'text';
}
function sortPortfolioTable(table, idx, th) {
  if (idx < 0) return;
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows).filter(r => r.cells.length > idx);
  if (rows.length < 2) return;
  const asc = !th.classList.contains('sort-asc'); // toggle; first click = ascending
  th.parentNode.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
  th.classList.add(asc ? 'sort-asc' : 'sort-desc');
  const type = detectColType(rows.slice(0, 10).map(r => r.cells[idx].textContent.trim()));
  const val = (r) => {
    const txt = r.cells[idx].textContent.trim();
    if (type === 'date') { const d = parseSortDate(txt); return d === null ? -Infinity : d; }
    if (type === 'number') { const n = parseSortNumber(txt); return n === null ? -Infinity : n; }
    return txt.toLowerCase();
  };
  rows.sort((a, b) => {
    const va = val(a), vb = val(b);
    const cmp = (type === 'text') ? String(va).localeCompare(String(vb), 'de') : (va < vb ? -1 : va > vb ? 1 : 0);
    return asc ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
}

// Display Portfolio Results
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
  } else if (inTransitNow > 0.5) {
    holdingsNote = `<i class="fa-solid fa-clock-rotate-left"></i> Zusätzlich <strong>${inTransitNow.toFixed(0)} Aktien im Übertrag</strong> (noch nicht im CapTrader-/IBKR-Bestand enthalten) – siehe Depot-Konsolidierung.`;
  }

  // ---- Summary (top "Portfolio-Übersicht" panel): focus on holdings + net-if-sold-now ----
  portfolioElements.portfolioResults.innerHTML = `
    <div class="portfolio-summary">
      <div class="portfolio-stat-box">
        <span class="portfolio-stat-label">Aktuell im Besitz</span>
        <div class="portfolio-stat-value">${totalHeldShares.toFixed(2)}</div>
        <div class="portfolio-stat-subtitle">${besitzSubtitle}</div>
      </div>
      <div class="portfolio-stat-box">
        <span class="portfolio-stat-label">Einstand (gezahlt)</span>
        <div class="portfolio-stat-value">${formatEuro(totalEinstandEUR)}</div>
        <div class="portfolio-stat-subtitle">Ø $${totalHeldShares > 0 ? (totalEinstandUSD / totalHeldShares).toFixed(2) : '0.00'} / Aktie${portfolioState.fxAtPurchaseUsed ? ' · EUR zum Kauftags-Kurs' : ''}</div>
      </div>
      <div class="portfolio-stat-box">
        <span class="portfolio-stat-label">Aktueller Wert</span>
        <div class="portfolio-stat-value">${formatEuro(totalCurrentValueEUR)}</div>
        <div class="portfolio-stat-subtitle">
          <span class="performance-badge ${totalUnrealizedEUR >= 0 ? 'positive' : 'negative'}">
            ${totalUnrealizedEUR >= 0 ? '+' : ''}${formatEuro(totalUnrealizedEUR)} (${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div class="portfolio-stat-box" style="border: 1px solid rgba(0,242,254,0.25);">
        <span class="portfolio-stat-label">Netto-Gewinn bei Verkauf jetzt</span>
        <div class="portfolio-stat-value ${saleNow.netProfitEUR >= 0 ? 'positive' : 'negative'}">${saleNow.netProfitEUR >= 0 ? '+' : ''}${formatEuro(saleNow.netProfitEUR)}</div>
        <div class="portfolio-stat-subtitle">bei $${price.toFixed(2)}, nach Steuer (${formatEuro(saleNow.totalTaxEUR)}) &amp; Gebühren</div>
      </div>
    </div>
    ${holdingsNote ? `<div class="detail-note" style="margin-top: 14px;">${holdingsNote}</div>` : ''}
  `;

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
  portfolioElements.portfolioTransactionsCard.style.display = 'block';

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

    // Update UI elements
    portfolioElements.consolidationEqPercent.textContent = `${eqPercent.toFixed(1)}%`;
    portfolioElements.consolidationCtPercent.textContent = `${ctPercent.toFixed(1)}%`;
    
    portfolioElements.consolidationEqBar.style.width = `${eqPercent}%`;
    portfolioElements.consolidationCtBar.style.width = `${ctPercent}%`;
    
    portfolioElements.consolidationEqShares.textContent = `${eqShares.toFixed(5)} Aktien`;
    portfolioElements.consolidationEqValue.textContent = formatEuro(eqValueEUR);
    portfolioElements.consolidationEqItems.textContent = `${portfolioState.equatePlusHoldings.length} Posten`;
    
    portfolioElements.consolidationCtShares.textContent = `${ctShares.toFixed(2)} Aktien`;
    portfolioElements.consolidationCtValue.textContent = formatEuro(ctValueEUR);
    portfolioElements.consolidationCtRealized.textContent = `+${formatEuro(totalRealizedGainEUR)}`;
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
    portfolioElements.portfolioConsolidationCard.style.display = 'block';
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



