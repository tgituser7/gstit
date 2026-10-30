import type { ItrInput, ItrResult } from "./income-tax";

export type GuideRow = { field: string; value: number | string; hint?: string };
export type GuideSection = { title: string; where: string; rows: GuideRow[] };

export function buildItrGuide(input: ItrInput, res: ItrResult): GuideSection[] {
  const r = res.recommended === "new" ? res.newRegime : res.oldRegime;
  const s = input.salary;
  const sections: GuideSection[] = [];

  sections.push({
    title: "Before you start",
    where: "e-Filing portal → e-File → Income Tax Returns → File Income Tax Return",
    rows: [
      { field: "Assessment year", value: res.rules.ay },
      { field: "Mode", value: "Online" },
      { field: "ITR form", value: res.itrForm.form },
      { field: "Filing section", value: new Date(input.filing.filingDate) > new Date(input.filing.dueDate) ? "139(4) — belated return" : "139(1) — on or before due date" },
      {
        field: "Opting out of new regime?",
        value: res.recommended === "old" ? "Yes — choose old regime" : "No — stay in new regime (default)",
        hint: res.recommended === "old" && input.business.mode !== "none" ? "Business income: file Form 10-IEA first" : undefined,
      },
    ],
  });

  if (r.grossSalary)
    sections.push({
      title: "Salary",
      where: res.itrForm.form.startsWith("ITR-1") || res.itrForm.form.startsWith("ITR-4") ? "Gross Total Income → Salary" : "Schedule S",
      rows: [
        { field: "Salary as per sec 17(1)", value: s.basic + s.da + s.hraReceived + s.otherAllowances + s.bonus + s.employerNps, hint: "From Form 16 Part B" },
        { field: "Perquisites — sec 17(2)", value: s.perquisites },
        { field: "Exempt allowance — HRA u/s 10(13A)", value: r.hraExempt, hint: r.regime === "new" ? "Not allowed in new regime" : undefined },
        { field: "Standard deduction u/s 16(ia)", value: r.standardDeduction },
        { field: "Professional tax u/s 16(iii)", value: r.professionalTax },
        { field: "Income chargeable under Salaries", value: r.salaryIncome },
      ],
    });

  if (input.houseProperty.type !== "none") {
    const hp = input.houseProperty;
    sections.push({
      title: "House property",
      where: "Schedule HP (ITR-2/3) or Income from House Property (ITR-1/4)",
      rows: [
        { field: "Type of house property", value: hp.type === "self" ? "Self-occupied" : "Let out" },
        { field: "Gross rent received", value: hp.rentReceived },
        { field: "Municipal tax paid", value: hp.municipalTax },
        { field: "Interest on borrowed capital u/s 24(b)", value: hp.interest, hint: "From the bank's interest certificate" },
        { field: "Income / (loss) from house property", value: r.housePropertyIncome },
        ...(r.housePropertyLossCarriedForward ? [{ field: "Loss to carry forward (Schedule CFL)", value: r.housePropertyLossCarriedForward }] : []),
      ],
    });
  }

  if (input.business.mode !== "none") {
    const b = input.business;
    sections.push({
      title: "Business / profession",
      where: b.mode === "regular" ? "Schedule BP + P&L + Balance Sheet (ITR-3)" : `Schedule BP → Presumptive income u/s ${b.mode}`,
      rows:
        b.mode === "regular"
          ? [{ field: "Net profit as per P&L", value: b.netProfit }]
          : [
              { field: "Gross receipts — bank / digital modes", value: b.receiptsDigital },
              { field: "Gross receipts — cash / other modes", value: b.receiptsCash },
              { field: "Presumptive income declared", value: r.businessIncome },
              { field: "Financial particulars (Sundry debtors, creditors, stock, cash)", value: "Fill from your books", hint: "Mandatory in ITR-4" },
            ],
    });
  }

  const cg = input.capitalGains;
  if (cg.stcg111A || cg.stcgOther || cg.ltcg112A || cg.ltcgOther)
    sections.push({
      title: "Capital gains",
      where: "Schedule CG (and Schedule 112A for listed equity / equity MF)",
      rows: [
        { field: "STCG on listed equity (111A)", value: cg.stcg111A, hint: "From broker's capital gains statement" },
        { field: "STCG on other assets", value: cg.stcgOther },
        { field: "LTCG u/s 112A", value: cg.ltcg112A, hint: "Scrip-wise details in Schedule 112A" },
        { field: "LTCG on other assets (112)", value: cg.ltcgOther },
      ],
    });

  const os = input.otherSources;
  sections.push({
    title: "Other sources",
    where: "Schedule OS (ITR-2/3) or Income from Other Sources (ITR-1/4)",
    rows: [
      { field: "Interest from savings account", value: os.savingsInterest, hint: "Check AIS → SFT-016" },
      { field: "Interest from deposits (FD/RD)", value: os.fdInterest, hint: "Match with 26AS TDS u/s 194A" },
      { field: "Dividend income", value: os.dividends, hint: "Quarter-wise break-up is asked for 234C" },
      { field: "Family pension (net of deduction u/s 57(iia))", value: Math.max(0, s.familyPension - Math.min(s.familyPension / 3, r.regime === "new" ? res.rules.newRegime.familyPensionDeduction : res.rules.oldRegime.familyPensionDeduction)) },
      { field: "Any other income", value: os.other },
    ],
  });

  if (r.deductions.length)
    sections.push({
      title: "Deductions",
      where: "Schedule VI-A",
      rows: r.deductions.map((d) => ({ field: `${d.section} — ${d.label}`, value: d.amount })),
    });

  const p = input.taxesPaid;
  sections.push({
    title: "Taxes paid",
    where: "Schedule TDS1 / TDS2 / TCS / IT — tally each entry with Form 26AS",
    rows: [
      { field: "TDS on salary (TDS1)", value: p.tdsSalary, hint: "TAN of employer from Form 16" },
      { field: "TDS on other income (TDS2)", value: p.tdsOther },
      { field: "TCS", value: p.tcs },
      { field: "Advance tax (Schedule IT)", value: p.advanceTax, hint: "BSR code, date, challan no. from challan" },
      { field: "Self-assessment tax (Schedule IT)", value: p.selfAssessment },
    ],
  });

  sections.push({
    title: "Tax computation — verify these match",
    where: "Part B-TTI (computed automatically by the portal)",
    rows: [
      { field: "Total income", value: r.totalIncome },
      { field: "Rebate u/s 87A", value: r.rebate87A + r.marginalRelief87A },
      { field: "Tax + surcharge + cess", value: r.totalTax },
      { field: "Interest 234A / 234B", value: r.interest234A + r.interest234B },
      { field: "Fee u/s 234F", value: r.fee234F },
      { field: r.netPayable >= 0 ? "Tax payable" : "Refund", value: Math.abs(r.netPayable) },
    ],
  });

  sections.push({
    title: "After filing",
    where: "e-Verify within 30 days",
    rows: [
      { field: "e-Verify", value: "Aadhaar OTP / net banking / bank EVC", hint: "Return is invalid until verified" },
      { field: "Refund bank account", value: "Must be pre-validated on the portal" },
    ],
  });

  return sections;
}

export const DOCUMENT_CHECKLIST = [
  "Form 16 from employer (Part A and Part B)",
  "Form 26AS and AIS / TIS (download from e-Filing portal → AIS)",
  "Bank interest certificates for savings and FDs",
  "Capital gains statement from broker / mutual fund (CAMS / KFintech)",
  "Home loan interest certificate and rent receipts (for HRA)",
  "Proofs for 80C, 80D, 80CCD(1B), donations",
  "Advance / self-assessment tax challans",
  "Bank account details (pre-validated for refund)",
];
