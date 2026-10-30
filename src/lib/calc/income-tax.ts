import { INCOME_TAX_RULES, type IncomeTaxRules, type Slab, type SurchargeBand } from "../rules/income-tax";
import { clamp0, monthsOrPart, roundTo10 } from "../format";

export type AgeGroup = "below60" | "60to80" | "above80";
export type Regime = "new" | "old";

export type ItrInput = {
  fy: string;
  ageGroup: AgeGroup;
  residential: "resident" | "nri";
  salary: {
    basic: number;
    da: number;
    hraReceived: number;
    otherAllowances: number;
    perquisites: number;
    bonus: number;
    employerNps: number;
    professionalTax: number;
    rentPaid: number;
    metro: boolean;
    familyPension: number;
  };
  houseProperty: {
    type: "none" | "self" | "letout";
    rentReceived: number;
    municipalTax: number;
    interest: number;
  };
  business: {
    mode: "none" | "44AD" | "44ADA" | "regular";
    receiptsDigital: number;
    receiptsCash: number;
    declaredProfit: number; // optional higher profit under presumptive scheme
    netProfit: number; // regular books
  };
  capitalGains: { stcg111A: number; stcgOther: number; ltcg112A: number; ltcgOther: number };
  otherSources: { savingsInterest: number; fdInterest: number; dividends: number; other: number };
  deductions: {
    sec80C: number;
    sec80CCD1B: number;
    sec80DSelf: number;
    sec80DParents: number;
    parentsSenior: boolean;
    sec80E: number;
    sec80G: number;
    other: number;
  };
  taxesPaid: { tdsSalary: number; tdsOther: number; tcs: number; advanceTax: number; selfAssessment: number };
  filing: { dueDate: string; filingDate: string };
  flags: { director: boolean; unlistedShares: boolean; foreignAssets: boolean; agriIncomeAbove5k: boolean; moreThanOneHouse: boolean };
};

export type Line = { label: string; amount: number; note?: string; strong?: boolean; indent?: boolean };

export type RegimeResult = {
  regime: Regime;
  lines: Line[];
  grossSalary: number;
  hraExempt: number;
  standardDeduction: number;
  professionalTax: number;
  salaryIncome: number;
  housePropertyIncome: number; // after set-off cap
  housePropertyLossCarriedForward: number;
  businessIncome: number;
  otherSourcesIncome: number;
  grossTotalIncome: number;
  deductions: { label: string; section: string; amount: number }[];
  totalDeductions: number;
  normalIncome: number;
  totalIncome: number;
  normalTax: number;
  specialTax: number;
  rebate87A: number;
  marginalRelief87A: number;
  surcharge: number;
  surchargeRelief: number;
  cess: number;
  totalTax: number;
  taxesPaid: number;
  interest234A: number;
  interest234B: number;
  fee234F: number;
  netPayable: number; // negative = refund
};

export type ItrResult = {
  rules: IncomeTaxRules;
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  recommended: Regime;
  saving: number;
  itrForm: { form: string; reasons: string[] };
  warnings: string[];
};

export function slabTax(income: number, slabs: Slab[]) {
  let tax = 0;
  let lower = 0;
  for (const s of slabs) {
    const upper = s.upTo ?? Infinity;
    if (income > lower) tax += (Math.min(income, upper) - lower) * s.rate;
    lower = upper;
  }
  return tax;
}

const surchargeRate = (income: number, bands: SurchargeBand[]) =>
  bands.reduce((r, b) => (income > b.above ? b.rate : r), 0);

const surchargeThreshold = (income: number, bands: SurchargeBand[]) =>
  bands.reduce((t, b) => (income > b.above ? b.above : t), 0);

export function computeRegime(input: ItrInput, rules: IncomeTaxRules, regime: Regime): RegimeResult {
  const isNew = regime === "new";
  const R = isNew ? rules.newRegime : rules.oldRegime;
  const L = rules.oldRegime.limits;
  const s = input.salary;
  const resident = input.residential === "resident";
  const senior = input.ageGroup !== "below60";
  const lines: Line[] = [];

  // ---- Salary ----
  const basicDa = s.basic + s.da;
  const grossSalary = s.basic + s.da + s.hraReceived + s.otherAllowances + s.perquisites + s.bonus + s.employerNps;
  const hraExempt =
    !isNew && s.hraReceived > 0 && s.rentPaid > 0
      ? Math.min(s.hraReceived, clamp0(s.rentPaid - 0.1 * basicDa), (s.metro ? 0.5 : 0.4) * basicDa)
      : 0;
  const standardDeduction = grossSalary > 0 ? Math.min(R.standardDeduction, grossSalary - hraExempt) : 0;
  const professionalTax = isNew ? 0 : Math.min(s.professionalTax, L.professionalTax);
  const salaryIncome = clamp0(grossSalary - hraExempt - standardDeduction - professionalTax);

  // ---- House property ----
  const hp = input.houseProperty;
  let hpRaw = 0;
  if (hp.type === "self") hpRaw = isNew ? 0 : -Math.min(hp.interest, L.selfOccupiedInterest);
  if (hp.type === "letout") {
    const nav = clamp0(hp.rentReceived - hp.municipalTax);
    hpRaw = nav - 0.3 * nav - hp.interest;
  }
  // Old regime: HP loss set-off against other heads capped at ₹2 lakh. New regime: no set-off.
  const hpSetOffCap = isNew ? 0 : L.housePropertyLossSetOff;
  const housePropertyIncome = hpRaw < 0 ? -Math.min(-hpRaw, hpSetOffCap) : hpRaw;
  const housePropertyLossCarriedForward = hpRaw < 0 && hp.type === "letout" ? housePropertyIncome - hpRaw : 0;

  // ---- Business / profession ----
  const b = input.business;
  const receipts = b.receiptsDigital + b.receiptsCash;
  let businessIncome = 0;
  if (b.mode === "44AD")
    businessIncome = Math.max(
      b.receiptsDigital * rules.presumptive.sec44ADDigitalRate + b.receiptsCash * rules.presumptive.sec44ADCashRate,
      b.declaredProfit,
    );
  if (b.mode === "44ADA") businessIncome = Math.max(receipts * rules.presumptive.sec44ADARate, b.declaredProfit);
  if (b.mode === "regular") businessIncome = b.netProfit;

  // ---- Other sources ----
  const fpDeduction = Math.min(s.familyPension / 3, R.familyPensionDeduction);
  const os = input.otherSources;
  const otherSourcesIncome = os.savingsInterest + os.fdInterest + os.dividends + os.other + s.familyPension - fpDeduction;

  const cg = input.capitalGains;
  const normalGti = clamp0(salaryIncome + housePropertyIncome + businessIncome + otherSourcesIncome + cg.stcgOther);
  const grossTotalIncome = normalGti + cg.stcg111A + cg.ltcg112A + cg.ltcgOther;

  // ---- Chapter VI-A deductions (only against normal income) ----
  const d = input.deductions;
  const deductions: RegimeResult["deductions"] = [];
  const add = (section: string, label: string, amount: number) => {
    if (amount > 0) deductions.push({ section, label, amount: Math.round(amount) });
  };
  const npsCap = R.employerNpsPct * basicDa;
  add("80CCD(2)", "Employer's NPS contribution", Math.min(s.employerNps, npsCap || s.employerNps));
  if (!isNew) {
    add("80C", "LIC, PPF, ELSS, EPF, principal, tuition…", Math.min(d.sec80C, L.sec80C));
    add("80CCD(1B)", "Own NPS (additional)", Math.min(d.sec80CCD1B, L.sec80CCD1B));
    add("80D", "Health insurance — self & family", Math.min(d.sec80DSelf, senior ? L.sec80DSelfSenior : L.sec80DSelf));
    add("80D", "Health insurance — parents", Math.min(d.sec80DParents, d.parentsSenior ? L.sec80DParentsSenior : L.sec80DParents));
    if (senior) add("80TTB", "Interest on deposits (senior)", Math.min(os.savingsInterest + os.fdInterest, L.sec80TTB));
    else add("80TTA", "Savings account interest", Math.min(os.savingsInterest, L.sec80TTA));
    add("80E", "Education loan interest", d.sec80E);
    add("80G", "Donations (eligible amount)", d.sec80G);
    add("Others", "Other deductions", d.other);
  }
  const claimed = deductions.reduce((a, x) => a + x.amount, 0);
  const totalDeductions = Math.min(claimed, normalGti);

  const normalIncome = normalGti - totalDeductions;
  const totalIncome = roundTo10(normalIncome + cg.stcg111A + cg.ltcg112A + cg.ltcgOther);

  // ---- Tax ----
  const slabs = isNew
    ? rules.newRegime.slabs
    : rules.oldRegime.slabs[input.ageGroup === "above80" ? "superSenior" : input.ageGroup === "60to80" ? "senior" : "general"];
  const basicExemption = slabs[0].upTo ?? 0;

  const taxBeforeSurcharge = (normal: number) => {
    // Residents can use unused basic exemption against special-rate gains.
    let unused = resident ? clamp0(basicExemption - normal) : 0;
    const apply = (x: number) => {
      const u = Math.min(unused, x);
      unused -= u;
      return x - u;
    };
    const stcg = apply(cg.stcg111A);
    const ltcgA = apply(clamp0(cg.ltcg112A - rules.capitalGains.ltcg112AExemption));
    const ltcgO = apply(cg.ltcgOther);
    return {
      normalTax: slabTax(normal, slabs),
      stcgTax: stcg * rules.capitalGains.stcg111A,
      ltcgATax: ltcgA * rules.capitalGains.ltcg112A,
      ltcgOTax: ltcgO * rules.capitalGains.ltcgOther,
    };
  };

  const t = taxBeforeSurcharge(normalIncome);
  const normalTax = t.normalTax;
  const specialTax = t.stcgTax + t.ltcgATax + t.ltcgOTax;

  // Sec 87A: new regime — not on special-rate tax; old regime — also covers 111A.
  let rebate87A = 0;
  let marginalRelief87A = 0;
  if (resident && totalIncome <= R.rebateIncomeLimit) {
    rebate87A = Math.min(R.rebateMax, normalTax + (isNew ? 0 : t.stcgTax));
  } else if (resident && isNew) {
    const excess = totalIncome - R.rebateIncomeLimit;
    if (normalTax > excess) marginalRelief87A = normalTax - excess;
  }
  const taxAfterRebate = clamp0(normalTax + specialTax - rebate87A - marginalRelief87A);

  // Surcharge (new regime capped at 25%; special-rate gains capped at 15%).
  const cap = isNew ? 0.25 : 0.37;
  const rate = Math.min(surchargeRate(totalIncome, R.surcharge), cap);
  const specialRate = Math.min(rate, rules.capitalGains.specialIncomeSurchargeCap);
  const normalPart = clamp0(taxAfterRebate - t.stcgTax - t.ltcgATax);
  const surcharge = normalPart * rate + (t.stcgTax + t.ltcgATax) * specialRate;

  // Marginal relief: extra tax+surcharge can't exceed income above the threshold.
  let surchargeRelief = 0;
  if (surcharge > 0) {
    const threshold = surchargeThreshold(totalIncome, R.surcharge);
    const excess = totalIncome - threshold;
    const at = taxBeforeSurcharge(clamp0(normalIncome - excess));
    const atTax = at.normalTax + at.stcgTax + at.ltcgATax + at.ltcgOTax;
    const prevRate = Math.min(surchargeRate(threshold, R.surcharge), cap);
    const atSurcharge =
      (at.normalTax + at.ltcgOTax) * prevRate + (at.stcgTax + at.ltcgATax) * Math.min(prevRate, rules.capitalGains.specialIncomeSurchargeCap);
    surchargeRelief = clamp0(taxAfterRebate + surcharge - (atTax + atSurcharge + excess));
    surchargeRelief = Math.min(surchargeRelief, surcharge);
  }

  const cess = (taxAfterRebate + surcharge - surchargeRelief) * rules.cessRate;
  const totalTax = roundTo10(taxAfterRebate + surcharge - surchargeRelief + cess);

  // ---- Taxes paid, interest & fee ----
  const p = input.taxesPaid;
  const prepaid = p.tdsSalary + p.tdsOther + p.tcs + p.advanceTax;
  const taxesPaid = prepaid + p.selfAssessment;
  const ayStart = new Date(`${Number(rules.fy.slice(0, 4)) + 1}-04-01`);
  const due = new Date(input.filing.dueDate);
  const filed = new Date(input.filing.filingDate);

  const assessedTax = clamp0(totalTax - p.tdsSalary - p.tdsOther - p.tcs);
  const advanceTaxExempt = input.ageGroup !== "below60" && b.mode === "none";
  let interest234B = 0;
  if (!advanceTaxExempt && assessedTax >= 10000 && p.advanceTax < 0.9 * assessedTax) {
    const shortfall = Math.floor((assessedTax - p.advanceTax) / 100) * 100;
    interest234B = shortfall * 0.01 * monthsOrPart(ayStart, filed < ayStart ? ayStart : filed);
  }
  let interest234A = 0;
  if (filed > due) {
    const unpaid = Math.floor(clamp0(totalTax - prepaid) / 100) * 100;
    const dayAfterDue = new Date(due.getTime() + 86400000);
    interest234A = unpaid * 0.01 * monthsOrPart(dayAfterDue, filed);
  }
  const fee234F =
    filed > due && totalIncome > basicExemption
      ? totalIncome <= rules.lateFee234F.reducedIncomeLimit
        ? rules.lateFee234F.reduced
        : rules.lateFee234F.full
      : 0;
  const netPayable = roundTo10(totalTax + interest234A + interest234B + fee234F - taxesPaid);

  // ---- Computation sheet ----
  lines.push({ label: "Gross salary", amount: grossSalary });
  if (hraExempt) lines.push({ label: "Less: HRA exemption u/s 10(13A)", amount: -hraExempt, indent: true });
  if (standardDeduction) lines.push({ label: "Less: Standard deduction u/s 16(ia)", amount: -standardDeduction, indent: true });
  if (professionalTax) lines.push({ label: "Less: Professional tax u/s 16(iii)", amount: -professionalTax, indent: true });
  lines.push({ label: "Income from salary", amount: salaryIncome, strong: true });
  if (hp.type !== "none")
    lines.push({
      label: "Income from house property",
      amount: housePropertyIncome,
      strong: true,
      note: housePropertyLossCarriedForward ? `Loss of ₹${Math.round(housePropertyLossCarriedForward).toLocaleString("en-IN")} carried forward` : undefined,
    });
  if (b.mode !== "none") lines.push({ label: `Business / profession${b.mode === "regular" ? "" : ` (u/s ${b.mode})`}`, amount: businessIncome, strong: true });
  if (cg.stcgOther) lines.push({ label: "Short-term capital gains (slab rate)", amount: cg.stcgOther, strong: true });
  lines.push({ label: "Income from other sources", amount: otherSourcesIncome, strong: true });
  if (cg.stcg111A) lines.push({ label: "STCG u/s 111A (listed equity, 20%)", amount: cg.stcg111A, strong: true });
  if (cg.ltcg112A) lines.push({ label: "LTCG u/s 112A (equity, 12.5% above ₹1.25 L)", amount: cg.ltcg112A, strong: true });
  if (cg.ltcgOther) lines.push({ label: "LTCG u/s 112 (other assets, 12.5%)", amount: cg.ltcgOther, strong: true });
  lines.push({ label: "Gross total income", amount: grossTotalIncome, strong: true });
  if (totalDeductions) lines.push({ label: "Less: Chapter VI-A deductions", amount: -totalDeductions, indent: true });
  lines.push({ label: "Total taxable income (rounded u/s 288A)", amount: totalIncome, strong: true });
  lines.push({ label: "Tax on normal income (slab)", amount: normalTax });
  if (specialTax) lines.push({ label: "Tax on capital gains at special rates", amount: specialTax });
  if (rebate87A) lines.push({ label: "Less: Rebate u/s 87A", amount: -rebate87A, indent: true });
  if (marginalRelief87A) lines.push({ label: "Less: Marginal relief (87A)", amount: -marginalRelief87A, indent: true });
  if (surcharge) lines.push({ label: `Surcharge @ ${Math.round(rate * 100)}%`, amount: surcharge });
  if (surchargeRelief) lines.push({ label: "Less: Marginal relief on surcharge", amount: -surchargeRelief, indent: true });
  lines.push({ label: `Health & education cess @ ${rules.cessRate * 100}%`, amount: cess });
  lines.push({ label: "Total tax liability", amount: totalTax, strong: true });
  if (interest234A) lines.push({ label: "Interest u/s 234A (late filing)", amount: interest234A });
  if (interest234B) lines.push({ label: "Interest u/s 234B (advance tax shortfall)", amount: interest234B });
  if (fee234F) lines.push({ label: "Late fee u/s 234F", amount: fee234F });
  lines.push({ label: "Less: TDS / TCS / advance / self-assessment tax", amount: -taxesPaid, indent: true });
  lines.push({ label: netPayable >= 0 ? "Tax payable" : "Refund due", amount: Math.abs(netPayable), strong: true });

  return {
    regime,
    lines,
    grossSalary,
    hraExempt,
    standardDeduction,
    professionalTax,
    salaryIncome,
    housePropertyIncome,
    housePropertyLossCarriedForward,
    businessIncome,
    otherSourcesIncome,
    grossTotalIncome,
    deductions,
    totalDeductions,
    normalIncome,
    totalIncome,
    normalTax,
    specialTax,
    rebate87A,
    marginalRelief87A,
    surcharge,
    surchargeRelief,
    cess,
    totalTax,
    taxesPaid,
    interest234A,
    interest234B,
    fee234F,
    netPayable,
  };
}

function pickItrForm(input: ItrInput, r: RegimeResult, rules: IncomeTaxRules) {
  const reasons: string[] = [];
  const cg = input.capitalGains;
  const f = input.flags;
  const resident = input.residential === "resident";
  const blockers: string[] = [];
  if (!resident) blockers.push("you are a non-resident");
  if (r.totalIncome > rules.itr1IncomeLimit) blockers.push("total income is above ₹50 lakh");
  if (cg.stcg111A || cg.stcgOther) blockers.push("you have short-term capital gains");
  if (cg.ltcgOther) blockers.push("you have LTCG on assets other than listed equity");
  if (cg.ltcg112A > rules.capitalGains.ltcg112AExemption) blockers.push("LTCG u/s 112A exceeds ₹1.25 lakh");
  if (f.director) blockers.push("you are a company director");
  if (f.unlistedShares) blockers.push("you held unlisted shares");
  if (f.foreignAssets) blockers.push("you have foreign assets or foreign income");
  if (f.agriIncomeAbove5k) blockers.push("agricultural income exceeds ₹5,000");
  if (f.moreThanOneHouse) blockers.push("you have more than one house property");
  if (r.housePropertyLossCarriedForward) blockers.push("you have a house property loss to carry forward");

  const mode = input.business.mode;
  if (mode === "regular") {
    reasons.push("You have business/professional income computed from books of account.");
    return { form: "ITR-3", reasons };
  }
  if (mode === "44AD" || mode === "44ADA") {
    if (!blockers.length) {
      reasons.push(`Presumptive income u/s ${mode}, resident, total income within ₹50 lakh.`);
      return { form: "ITR-4 (Sugam)", reasons };
    }
    reasons.push(`Presumptive income u/s ${mode}, but ITR-4 is not allowed because ${blockers.join(", ")}.`);
    return { form: "ITR-3", reasons };
  }
  if (!blockers.length) {
    reasons.push("Resident individual with salary/pension, one house property and other sources, income up to ₹50 lakh.");
    return { form: "ITR-1 (Sahaj)", reasons };
  }
  reasons.push(`No business income, but ITR-1 is not allowed because ${blockers.join(", ")}.`);
  return { form: "ITR-2", reasons };
}

export function computeItr(input: ItrInput): ItrResult {
  const rules = INCOME_TAX_RULES[input.fy];
  const newRegime = computeRegime(input, rules, "new");
  const oldRegime = computeRegime(input, rules, "old");
  const recommended: Regime = oldRegime.totalTax < newRegime.totalTax ? "old" : "new";
  const saving = Math.abs(oldRegime.totalTax - newRegime.totalTax);
  const chosen = recommended === "new" ? newRegime : oldRegime;

  const warnings: string[] = [];
  if (recommended === "old" && input.business.mode !== "none")
    warnings.push("With business income, opting for the old regime needs Form 10-IEA before the due date, and you can switch back only once.");
  if (recommended === "old" && input.business.mode === "none")
    warnings.push("Salaried taxpayers choose the old regime directly in the ITR — it must be filed by the due date (u/s 139(1)) to opt out of the new regime.");
  if (input.business.mode === "44AD") {
    const total = input.business.receiptsCash + input.business.receiptsDigital;
    const limit = input.business.receiptsCash <= 0.05 * total ? rules.presumptive.sec44ADLimit : rules.presumptive.sec44ADLimitDefault;
    if (total > limit) warnings.push(`Turnover exceeds the 44AD limit of ₹${limit / 1e7} crore — tax audit and ITR-3 apply.`);
  }
  if (input.business.mode === "44ADA") {
    const total = input.business.receiptsCash + input.business.receiptsDigital;
    const limit = input.business.receiptsCash <= 0.05 * total ? rules.presumptive.sec44ADALimit : rules.presumptive.sec44ADALimitDefault;
    if (total > limit) warnings.push(`Gross receipts exceed the 44ADA limit of ₹${limit / 1e5} lakh.`);
  }
  if (chosen.interest234B) warnings.push("You owe interest u/s 234B because advance tax paid was below 90% of your tax. Interest u/s 234C (instalment-wise) is not computed here — the e-filing utility will add it.");
  if (chosen.netPayable > 0) warnings.push("Pay the balance as self-assessment tax (Challan 280, minor head 300) on the e-Filing portal before submitting the return, then enter the challan in Schedule IT.");
  if (input.deductions.sec80C > rules.oldRegime.limits.sec80C) warnings.push("Section 80C is capped at ₹1.5 lakh — the extra amount is ignored.");

  return { rules, newRegime, oldRegime, recommended, saving, itrForm: pickItrForm(input, chosen, rules), warnings };
}

export const emptyItrInput = (fy: string): ItrInput => ({
  fy,
  ageGroup: "below60",
  residential: "resident",
  salary: { basic: 0, da: 0, hraReceived: 0, otherAllowances: 0, perquisites: 0, bonus: 0, employerNps: 0, professionalTax: 0, rentPaid: 0, metro: false, familyPension: 0 },
  houseProperty: { type: "none", rentReceived: 0, municipalTax: 0, interest: 0 },
  business: { mode: "none", receiptsDigital: 0, receiptsCash: 0, declaredProfit: 0, netProfit: 0 },
  capitalGains: { stcg111A: 0, stcgOther: 0, ltcg112A: 0, ltcgOther: 0 },
  otherSources: { savingsInterest: 0, fdInterest: 0, dividends: 0, other: 0 },
  deductions: { sec80C: 0, sec80CCD1B: 0, sec80DSelf: 0, sec80DParents: 0, parentsSenior: false, sec80E: 0, sec80G: 0, other: 0 },
  taxesPaid: { tdsSalary: 0, tdsOther: 0, tcs: 0, advanceTax: 0, selfAssessment: 0 },
  filing: { dueDate: INCOME_TAX_RULES[fy].defaultDueDate, filingDate: new Date().toISOString().slice(0, 10) },
  flags: { director: false, unlistedShares: false, foreignAssets: false, agriIncomeAbove5k: false, moreThanOneHouse: false },
});
