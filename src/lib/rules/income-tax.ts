// Income tax rule sets, one per financial year.
// Government portals do not publish these as a machine-readable API, so every
// number here is transcribed from the Finance Act / CBDT notifications listed in
// `sources`. When a Budget changes something, add a new rule set or edit the
// values here and bump `lastVerified`.

export type Slab = { upTo: number | null; rate: number }; // upTo = null means "and above"

export type SurchargeBand = { above: number; rate: number };

export type IncomeTaxRules = {
  fy: string;
  ay: string; // "Tax year" under the Income Tax Act 2025 from FY 2026-27
  label: string;
  act: string;
  lastVerified: string;
  defaultDueDate: string; // ITR due date for non-audit individuals
  newRegime: {
    slabs: Slab[];
    standardDeduction: number;
    familyPensionDeduction: number;
    rebateIncomeLimit: number;
    rebateMax: number;
    employerNpsPct: number; // 80CCD(2) cap as % of basic + DA
    surcharge: SurchargeBand[];
  };
  oldRegime: {
    slabs: { general: Slab[]; senior: Slab[]; superSenior: Slab[] };
    standardDeduction: number;
    familyPensionDeduction: number;
    rebateIncomeLimit: number;
    rebateMax: number;
    employerNpsPct: number;
    surcharge: SurchargeBand[];
    limits: {
      sec80C: number;
      sec80CCD1B: number;
      sec80DSelf: number;
      sec80DSelfSenior: number;
      sec80DParents: number;
      sec80DParentsSenior: number;
      sec80TTA: number;
      sec80TTB: number;
      selfOccupiedInterest: number;
      professionalTax: number;
      housePropertyLossSetOff: number;
    };
  };
  capitalGains: {
    stcg111A: number;
    ltcg112A: number;
    ltcg112AExemption: number;
    ltcgOther: number;
    specialIncomeSurchargeCap: number; // surcharge cap on 111A/112A/dividend
  };
  cessRate: number;
  presumptive: {
    sec44ADDigitalRate: number;
    sec44ADCashRate: number;
    sec44ADLimit: number; // when cash receipts <= 5%
    sec44ADLimitDefault: number;
    sec44ADARate: number;
    sec44ADALimit: number;
    sec44ADALimitDefault: number;
  };
  lateFee234F: { reduced: number; reducedIncomeLimit: number; full: number };
  hraMetroCities: string[];
  itr1IncomeLimit: number;
  notes: string[];
  sources: { title: string; url: string }[];
};

const newRegimeSlabs2025: Slab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

const oldSlabs = (exemption: number): Slab[] => [
  { upTo: exemption, rate: 0 },
  ...(exemption < 500000 ? [{ upTo: 500000, rate: 0.05 }] : []),
  { upTo: 1000000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

const commonSurcharge: SurchargeBand[] = [
  { above: 5000000, rate: 0.1 },
  { above: 10000000, rate: 0.15 },
  { above: 20000000, rate: 0.25 },
];

const fy2025_26: IncomeTaxRules = {
  fy: "2025-26",
  ay: "AY 2026-27",
  label: "FY 2025-26 (AY 2026-27) — returns being filed in 2026",
  act: "Income-tax Act, 1961 (as amended by Finance Act 2025)",
  lastVerified: "2026-10-30",
  defaultDueDate: "2026-07-31",
  newRegime: {
    slabs: newRegimeSlabs2025,
    standardDeduction: 75000,
    familyPensionDeduction: 25000,
    rebateIncomeLimit: 1200000,
    rebateMax: 60000,
    employerNpsPct: 0.14,
    surcharge: commonSurcharge, // capped at 25% under the new regime
  },
  oldRegime: {
    slabs: {
      general: oldSlabs(250000),
      senior: oldSlabs(300000),
      superSenior: oldSlabs(500000),
    },
    standardDeduction: 50000,
    familyPensionDeduction: 15000,
    rebateIncomeLimit: 500000,
    rebateMax: 12500,
    employerNpsPct: 0.1,
    surcharge: [...commonSurcharge, { above: 50000000, rate: 0.37 }],
    limits: {
      sec80C: 150000,
      sec80CCD1B: 50000,
      sec80DSelf: 25000,
      sec80DSelfSenior: 50000,
      sec80DParents: 25000,
      sec80DParentsSenior: 50000,
      sec80TTA: 10000,
      sec80TTB: 50000,
      selfOccupiedInterest: 200000,
      professionalTax: 5000,
      housePropertyLossSetOff: 200000,
    },
  },
  capitalGains: {
    stcg111A: 0.2,
    ltcg112A: 0.125,
    ltcg112AExemption: 125000,
    ltcgOther: 0.125,
    specialIncomeSurchargeCap: 0.15,
  },
  cessRate: 0.04,
  presumptive: {
    sec44ADDigitalRate: 0.06,
    sec44ADCashRate: 0.08,
    sec44ADLimit: 30000000,
    sec44ADLimitDefault: 20000000,
    sec44ADARate: 0.5,
    sec44ADALimit: 7500000,
    sec44ADALimitDefault: 5000000,
  },
  lateFee234F: { reduced: 1000, reducedIncomeLimit: 500000, full: 5000 },
  hraMetroCities: ["Delhi", "Mumbai", "Kolkata", "Chennai"],
  itr1IncomeLimit: 5000000,
  notes: [
    "Section 87A rebate (up to ₹60,000 in the new regime) does not apply to tax on special-rate income such as STCG u/s 111A and LTCG u/s 112A.",
    "Marginal relief applies when total income is slightly above ₹12 lakh in the new regime.",
    "Property bought before 23 July 2024 may opt for 20% with indexation instead of 12.5% without; this calculator uses 12.5%.",
    "Due date for non-audit individuals is 31 July 2026; belated/revised returns can be filed up to 31 December 2026.",
  ],
  sources: [
    { title: "Income Tax Department e-Filing portal", url: "https://www.incometax.gov.in/iec/foportal/" },
    { title: "Finance Act 2025 (India Code)", url: "https://www.indiacode.nic.in/" },
    { title: "Union Budget 2025-26 speech — Part B", url: "https://www.indiabudget.gov.in/budget2025-26/doc/budget_speech.pdf" },
    { title: "e-Filing portal — ITR forms & utilities", url: "https://www.incometax.gov.in/iec/foportal/downloads/income-tax-returns" },
  ],
};

// Budget 2026 kept rates and slabs unchanged. From 1 April 2026 the Income Tax
// Act, 2025 replaces the 1961 Act, so section numbers differ (e.g. "Tax year"
// replaces "Assessment year"), but the amounts are carried over.
const fy2026_27: IncomeTaxRules = {
  ...fy2025_26,
  fy: "2026-27",
  ay: "Tax year 2026-27",
  label: "FY 2026-27 (Tax year 2026-27) — for advance tax planning",
  act: "Income Tax Act, 2025 (in force from 1 April 2026)",
  defaultDueDate: "2027-07-31",
  notes: [
    "Budget 2026 did not change slab rates; the new regime remains the default.",
    "The Income Tax Act, 2025 renumbers most sections. This app keeps the familiar 1961-Act section names (80C, 87A, 111A…) as labels.",
    "Use this year to estimate advance tax: instalments are due 15 Jun (15%), 15 Sep (45%), 15 Dec (75%) and 15 Mar (100%).",
  ],
  sources: [
    { title: "Union Budget 2026-27", url: "https://www.indiabudget.gov.in/" },
    { title: "Income Tax Act, 2025 — Income Tax Department", url: "https://www.incometax.gov.in/iec/foportal/" },
    fy2025_26.sources[3],
  ],
};

export const INCOME_TAX_RULES: Record<string, IncomeTaxRules> = {
  "2025-26": fy2025_26,
  "2026-27": fy2026_27,
};

export const DEFAULT_FY = "2025-26";
