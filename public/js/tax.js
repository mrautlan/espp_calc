// German tax helpers. Pure functions — no DOM, no app state.

import { ABGELTUNG } from './constants.js';

// Flat capital-gains rate (Abgeltungsteuer incl. Soli and church-tax variant).
// Accepts church tax as a rate (0.08 / 0.09) OR as a percent (8 / 9); 0 / falsy = none.
// This single source replaces the rate table that used to be duplicated in both
// the Rechner and the Steuerreport.
export function getAbgeltungRate(churchTax) {
  const ct = churchTax > 1 ? churchTax / 100 : (churchTax || 0);
  if (Math.abs(ct - 0.09) < 1e-9) return ABGELTUNG.CHURCH_9;
  if (Math.abs(ct - 0.08) < 1e-9) return ABGELTUNG.CHURCH_8;
  return ABGELTUNG.BASE;
}

// Sale-side broker fees in EUR. Handles both broker key vocabularies used in the app:
//   Rechner   : 'captrader' | 'equateplus' | 'german'
//   Portfolio : 'broker-c'  | 'broker-ab'
// grossEUR = gross sale proceeds in EUR; fx = EUR per USD.
export function brokerFeesEUR(broker, grossEUR, fx) {
  switch (broker) {
    case 'captrader':
    case 'broker-c':
      return 4.00; // ~2€ trade + ~2€ FX swap (CapTrader / IBKR)
    case 'german':
      return 10.00; // ~10€ commission (German broker)
    case 'equateplus':
    case 'broker-ab':
    default: {
      // EquatePlus / Computershare: $19.95 commission + $35 wire + ~0.5% FX (e.g. Wise)
      const feesUSD = 19.95 + 35.00 + (grossEUR / fx) * 0.005;
      return feesUSD * fx;
    }
  }
}

// Linear estimate of the German marginal income-tax rate (Grenzsteuersatz) from
// monthly gross, tax class and tax year (a string like '2026'). Rough zvE model —
// seeds the tax-rate slider after a payslip import and feeds the Günstigerprüfung.
export function estimateGrenzsteuersatz(monthlyGross, taxClass, taxYear) {
  const annualGross = monthlyGross * 12;

  // Estimate taxable income (zu versteuerndes Einkommen, zvE):
  // subtract ~20% social security contributions and 1,230 € Werbungskosten.
  let zvE = annualGross * 0.82 - 1230;

  // Tax class splitting / penalty adjustment.
  if (taxClass === 3) {
    zvE = zvE / 2;
  } else if (taxClass === 5) {
    zvE = zvE * 1.5;
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
    // Default to 2024 / 2025 brackets.
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
