// Domain constants for the IBM ESPP Navigator.
// Single source of truth for values that previously lived inline (and could drift)
// across app.js — notably the capital-gains tax table and FX assumptions.

// localStorage keys used across the app.
export const LS_KEYS = {
  activeTab: 'espp_active_tab',
  calculatorState: 'espp_calculator_state',
  portfolioState: 'espp_portfolio_state',
  seenWelcome: 'espp_seen_welcome',
  simNoteDismissed: 'espp_sim_note_dismissed',
  theme: 'espp_theme',
  goal: 'espp_goal_v1',
  histCache: 'espp_hist_cache'
};

// German flat capital-gains tax (Abgeltungsteuer): 25% + 5.5% Soli, with the two
// church-tax variants folded in via the Sonderausgabenabzug:
//   BASE      26.375 %  (no church tax)
//   CHURCH_8  27.8186 % (8 % church tax — BY, BW)
//   CHURCH_9  27.9951 % (9 % church tax — elsewhere)
export const ABGELTUNG = {
  BASE: 0.26375,
  CHURCH_8: 0.278186,
  CHURCH_9: 0.279951
};

// FX assumptions. USD is fetched live (/api/stock); these are fallbacks / for
// currencies the live feed doesn't cover.
export const FX = {
  USD_EUR_FALLBACK: 0.92, // used until /api/stock answers
  GBP_EUR: 1.17           // GBP is not fetched live — approximate
};
