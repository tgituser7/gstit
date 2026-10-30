import { B2CL_INVOICE_THRESHOLD, GST_INTEREST_RATE, LATE_FEE, stateByCode } from "../rules/gst";
import { clamp0, daysBetween, r2 } from "../format";

export type OutwardCategory =
  | "b2b"
  | "b2c"
  | "export_wpay"
  | "export_lut"
  | "sez_wpay"
  | "sez_lut"
  | "nil"
  | "exempt"
  | "nongst";

export type InwardCategory = "b2b" | "import_goods" | "import_services" | "rcm" | "isd" | "exempt_nil_comp" | "nongst";

export type OutwardLine = {
  id: string;
  description: string;
  hsn: string;
  category: OutwardCategory;
  pos: string; // place of supply state code
  taxableValue: number;
  rate: number;
  cess: number;
  creditNote: boolean;
};

export type InwardLine = {
  id: string;
  description: string;
  supplierGstin: string;
  category: InwardCategory;
  interState: boolean;
  taxableValue: number;
  rate: number;
  cess: number;
  itc: "eligible" | "blocked" | "none";
  creditNote: boolean;
};

export type Heads = { igst: number; cgst: number; sgst: number; cess: number };

export type GstInput = {
  gstin: string;
  stateCode: string;
  scheme: "regular" | "composition";
  compositionRate: number;
  frequency: "monthly" | "quarterly";
  period: string; // YYYY-MM (for quarterly, the last month of the quarter)
  aato: number; // aggregate annual turnover of previous FY, for late-fee cap
  outward: OutwardLine[];
  inward: InwardLine[];
  reversals: { rule42_43: Heads; others: Heads; reclaimed: Heads; ineligible: Heads };
  openingCredit: Heads;
  filingDate: string;
};

export const ZERO: Heads = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
const addH = (a: Heads, b: Heads): Heads => ({ igst: a.igst + b.igst, cgst: a.cgst + b.cgst, sgst: a.sgst + b.sgst, cess: a.cess + b.cess });
const subH = (a: Heads, b: Heads): Heads => ({ igst: a.igst - b.igst, cgst: a.cgst - b.cgst, sgst: a.sgst - b.sgst, cess: a.cess - b.cess });
const roundH = (a: Heads): Heads => ({ igst: r2(a.igst), cgst: r2(a.cgst), sgst: r2(a.sgst), cess: r2(a.cess) });
export const totalH = (a: Heads) => a.igst + a.cgst + a.sgst + a.cess;

export type Row = { txval: number } & Heads;
const emptyRow = (): Row => ({ txval: 0, ...ZERO });
const addRow = (row: Row, txval: number, h: Heads) => {
  row.txval += txval;
  row.igst += h.igst;
  row.cgst += h.cgst;
  row.sgst += h.sgst;
  row.cess += h.cess;
};

export function splitTax(taxable: number, ratePct: number, cess: number, interState: boolean): Heads {
  const tax = (taxable * ratePct) / 100;
  return interState ? { igst: tax, cgst: 0, sgst: 0, cess } : { igst: 0, cgst: tax / 2, sgst: tax / 2, cess };
}

const signed = (line: { creditNote: boolean }) => (line.creditNote ? -1 : 1);
const scale = (h: Heads, k: number): Heads => ({ igst: h.igst * k, cgst: h.cgst * k, sgst: h.sgst * k, cess: h.cess * k });

export type SetOffRow = { head: keyof Heads; liability: number; byIgst: number; byCgst: number; bySgst: number; byCess: number; cash: number };

// Utilisation order — Sec 49(5), 49A, 49B and Rule 88A:
// IGST credit → IGST, then CGST/SGST (must be exhausted before CGST/SGST credit is used);
// CGST credit → CGST, then IGST; SGST credit → SGST, then IGST; never CGST↔SGST.
export function setOff(liability: Heads, credit: Heads) {
  const l = { ...liability };
  const c = { ...credit };
  const rows: Record<keyof Heads, SetOffRow> = {
    igst: { head: "igst", liability: l.igst, byIgst: 0, byCgst: 0, bySgst: 0, byCess: 0, cash: 0 },
    cgst: { head: "cgst", liability: l.cgst, byIgst: 0, byCgst: 0, bySgst: 0, byCess: 0, cash: 0 },
    sgst: { head: "sgst", liability: l.sgst, byIgst: 0, byCgst: 0, bySgst: 0, byCess: 0, cash: 0 },
    cess: { head: "cess", liability: l.cess, byIgst: 0, byCgst: 0, bySgst: 0, byCess: 0, cash: 0 },
  };
  const apply = (from: keyof Heads, to: keyof Heads, limit = Infinity) => {
    const amt = Math.min(c[from], l[to], limit);
    if (amt <= 0) return;
    c[from] -= amt;
    l[to] -= amt;
    const key = (`by${from[0].toUpperCase()}${from.slice(1)}`) as "byIgst" | "byCgst" | "bySgst" | "byCess";
    rows[to][key] += amt;
  };

  apply("igst", "igst");
  // Put remaining IGST credit where CGST/SGST credit falls short first, to minimise cash.
  apply("igst", "cgst", clamp0(l.cgst - c.cgst));
  apply("igst", "sgst", clamp0(l.sgst - c.sgst));
  apply("igst", "cgst");
  apply("igst", "sgst");
  apply("cgst", "cgst");
  apply("cgst", "igst");
  apply("sgst", "sgst");
  apply("sgst", "igst");
  apply("cess", "cess");

  (Object.keys(rows) as (keyof Heads)[]).forEach((h) => (rows[h].cash = r2(l[h])));
  return { rows: Object.values(rows), closingCredit: roundH(c), cash: roundH(l) };
}

export function dueDateFor(input: Pick<GstInput, "period" | "frequency" | "stateCode">) {
  const [y, m] = input.period.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // first day of following month
  const day = input.frequency === "monthly" ? 20 : stateByCode(input.stateCode)?.qrmp22 ? 22 : 24;
  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), day));
}

export function computeGst(input: GstInput) {
  const home = input.stateCode;
  const warnings: string[] = [];

  // ---------- Outward ----------
  const t31 = { a: emptyRow(), b: emptyRow(), c: emptyRow(), e: emptyRow() };
  const t32 = new Map<string, Row>();
  const g1 = {
    b2b: { ...emptyRow(), count: 0 },
    b2cl: { ...emptyRow(), count: 0 },
    b2cs: { ...emptyRow(), count: 0 },
    exp: { ...emptyRow(), count: 0 },
    sez: { ...emptyRow(), count: 0 },
    nil: { inter: 0, intra: 0, exemptInter: 0, exemptIntra: 0, nonGstInter: 0, nonGstIntra: 0 },
    cdnr: { ...emptyRow(), count: 0 },
    cdnur: { ...emptyRow(), count: 0 },
  };
  const hsn = new Map<string, Row & { hsn: string; rate: number }>();

  for (const o of input.outward) {
    const k = signed(o);
    const inter = o.pos !== home || o.category.startsWith("export") || o.category.startsWith("sez");
    const zeroRatedLut = o.category === "export_lut" || o.category === "sez_lut";
    const taxed = !["nil", "exempt", "nongst"].includes(o.category) && !zeroRatedLut;
    const h = scale(taxed ? splitTax(o.taxableValue, o.rate, o.cess, inter) : ZERO, k);
    const tx = o.taxableValue * k;

    if (o.category === "b2b" || o.category === "b2c") addRow(t31.a, tx, h);
    else if (o.category.startsWith("export") || o.category.startsWith("sez")) addRow(t31.b, tx, h);
    else if (o.category === "nongst") addRow(t31.e, tx, ZERO);
    else addRow(t31.c, tx, ZERO);

    if (o.category === "b2c" && inter && !o.creditNote) {
      const row = t32.get(o.pos) ?? emptyRow();
      addRow(row, tx, h);
      t32.set(o.pos, row);
    }

    // GSTR-1 buckets
    if (o.creditNote) {
      const bucket = o.category === "b2b" || o.category.startsWith("sez") ? g1.cdnr : g1.cdnur;
      addRow(bucket, tx, h);
      bucket.count++;
    } else if (o.category === "b2b") {
      addRow(g1.b2b, tx, h);
      g1.b2b.count++;
    } else if (o.category === "b2c") {
      const invoiceValue = o.taxableValue + totalH(h);
      const bucket = inter && invoiceValue > B2CL_INVOICE_THRESHOLD ? g1.b2cl : g1.b2cs;
      addRow(bucket, tx, h);
      bucket.count++;
    } else if (o.category.startsWith("export")) {
      addRow(g1.exp, tx, h);
      g1.exp.count++;
    } else if (o.category.startsWith("sez")) {
      addRow(g1.sez, tx, h);
      g1.sez.count++;
    } else {
      const key = o.category === "nil" ? (inter ? "inter" : "intra") : o.category === "exempt" ? (inter ? "exemptInter" : "exemptIntra") : inter ? "nonGstInter" : "nonGstIntra";
      g1.nil[key] += tx;
    }

    const hk = `${o.hsn || "—"}@${o.rate}`;
    const hrow = hsn.get(hk) ?? { ...emptyRow(), hsn: o.hsn || "—", rate: o.rate };
    addRow(hrow, tx, h);
    hsn.set(hk, hrow);
    if (!o.hsn && taxed) warnings.push(`Outward line "${o.description || o.id}" has no HSN/SAC — HSN is mandatory in GSTR-1 Table 12.`);
  }

  // ---------- Inward ----------
  const t31d = emptyRow(); // inward supplies liable to reverse charge
  const t4 = { a1: { ...ZERO }, a2: { ...ZERO }, a3: { ...ZERO }, a4: { ...ZERO }, a5: { ...ZERO } };
  let blocked: Heads = { ...ZERO };
  const t5 = { exemptInter: 0, exemptIntra: 0, nonGstInter: 0, nonGstIntra: 0 };

  for (const i of input.inward) {
    const k = signed(i);
    const inter = i.interState || i.category === "import_goods" || i.category === "import_services";
    const tx = i.taxableValue * k;
    if (i.category === "exempt_nil_comp") {
      t5[inter ? "exemptInter" : "exemptIntra"] += tx;
      continue;
    }
    if (i.category === "nongst") {
      t5[inter ? "nonGstInter" : "nonGstIntra"] += tx;
      continue;
    }
    const h = scale(splitTax(i.taxableValue, i.rate, i.cess, inter), k);

    if (i.category === "import_services" || i.category === "rcm") addRow(t31d, tx, h);

    if (i.itc === "none") continue;
    const bucket =
      i.category === "import_goods" ? t4.a1 : i.category === "import_services" ? t4.a2 : i.category === "rcm" ? t4.a3 : i.category === "isd" ? t4.a4 : t4.a5;
    Object.assign(bucket, addH(bucket, h));
    if (i.itc === "blocked") blocked = addH(blocked, h);
  }

  const t4A = [t4.a1, t4.a2, t4.a3, t4.a4, t4.a5].reduce(addH, { ...ZERO });
  const t4B1 = addH(blocked, input.reversals.rule42_43);
  const t4B2 = input.reversals.others;
  const t4C = subH(subH(t4A, t4B1), t4B2);
  const t4D1 = input.reversals.reclaimed;
  const t4D2 = input.reversals.ineligible;
  const netItc = addH(t4C, t4D1); // reclaimed ITC reversed earlier under 4B(2)

  // ---------- Liability & set-off ----------
  const forwardLiability: Heads =
    input.scheme === "composition"
      ? (() => {
          const turnover = input.outward.reduce((a, o) => a + (o.category === "nongst" ? 0 : o.taxableValue * signed(o)), 0);
          const tax = (turnover * input.compositionRate) / 100;
          return { igst: 0, cgst: tax / 2, sgst: tax / 2, cess: 0 };
        })()
      : { igst: t31.a.igst + t31.b.igst, cgst: t31.a.cgst + t31.b.cgst, sgst: t31.a.sgst + t31.b.sgst, cess: t31.a.cess + t31.b.cess };
  const rcmLiability: Heads = { igst: t31d.igst, cgst: t31d.cgst, sgst: t31d.sgst, cess: t31d.cess };

  const creditAvailable = input.scheme === "composition" ? { ...ZERO } : addH(netItc, input.openingCredit);
  (Object.keys(creditAvailable) as (keyof Heads)[]).forEach((h) => {
    if (creditAvailable[h] < 0) {
      warnings.push(`Net ${h.toUpperCase()} ITC is negative (reversals exceed credit) — the excess is added to cash liability.`);
      forwardLiability[h] += -creditAvailable[h];
      creditAvailable[h] = 0;
    }
  });

  const so = setOff(roundH(forwardLiability), roundH(creditAvailable));
  const cashForward = so.cash;
  const cashTotal = roundH(addH(cashForward, rcmLiability)); // RCM is always paid in cash

  // ---------- Interest & late fee ----------
  const due = dueDateFor(input);
  const filed = new Date(input.filingDate);
  const daysLate = daysBetween(due, filed);
  const interest = scale(cashTotal, (GST_INTEREST_RATE * daysLate) / 365);
  const isNil = input.outward.length === 0 && input.inward.length === 0;
  const cap = isNil ? LATE_FEE.capNil : (LATE_FEE.caps.find((c) => c.upTo === null || input.aato <= c.upTo)?.cap ?? 10000);
  const lateFeeTotal = Math.min(daysLate * (isNil ? LATE_FEE.perDayNil : LATE_FEE.perDay), cap);
  const lateFee = { cgst: lateFeeTotal / 2, sgst: lateFeeTotal / 2 };

  const grandCash = r2(totalH(cashTotal) + totalH(interest) + lateFeeTotal);

  if (input.scheme === "regular" && totalH(t4B1) === 0 && t5.exemptInter + t5.exemptIntra > 0)
    warnings.push("You have exempt inward supplies. If ITC is common to taxable and exempt supplies, reverse proportionate ITC under Rule 42/43 in Table 4B(1).");
  if (t31d.txval > 0) warnings.push("Reverse-charge tax must be paid in cash; it cannot be set off against ITC. Its credit then appears in Table 4A(2)/4A(3).");

  return {
    dueDate: due.toISOString().slice(0, 10),
    daysLate,
    gstr3b: {
      t31: { a: roundRow(t31.a), b: roundRow(t31.b), c: roundRow(t31.c), d: roundRow(t31d), e: roundRow(t31.e) },
      t32: [...t32.entries()].map(([pos, row]) => ({ pos, name: stateByCode(pos)?.name ?? pos, ...roundRow(row) })),
      t4: { a1: roundH(t4.a1), a2: roundH(t4.a2), a3: roundH(t4.a3), a4: roundH(t4.a4), a5: roundH(t4.a5), A: roundH(t4A), B1: roundH(t4B1), B2: roundH(t4B2), C: roundH(t4C), D1: roundH(t4D1), D2: roundH(t4D2) },
      t5: { exemptInter: r2(t5.exemptInter), exemptIntra: r2(t5.exemptIntra), nonGstInter: r2(t5.nonGstInter), nonGstIntra: r2(t5.nonGstIntra) },
      t51: { interest: roundH(interest), lateFee },
      t61: { rows: so.rows, rcm: rcmLiability },
    },
    gstr1: {
      ...g1,
      b2b: roundCount(g1.b2b),
      b2cl: roundCount(g1.b2cl),
      b2cs: roundCount(g1.b2cs),
      exp: roundCount(g1.exp),
      sez: roundCount(g1.sez),
      cdnr: roundCount(g1.cdnr),
      cdnur: roundCount(g1.cdnur),
      hsn: [...hsn.values()].map((r) => ({ ...roundRow(r), hsn: r.hsn, rate: r.rate })),
    },
    liability: roundH(forwardLiability),
    rcmLiability: roundH(rcmLiability),
    creditAvailable: roundH(creditAvailable),
    closingCredit: so.closingCredit,
    cashTotal,
    interest: roundH(interest),
    lateFeeTotal,
    grandCash,
    warnings: [...new Set(warnings)],
  };
}

const roundRow = (r: Row): Row => ({ txval: r2(r.txval), ...roundH(r) });
const roundCount = <T extends Row & { count: number }>(r: T) => ({ ...roundRow(r), count: r.count });

export type GstResult = ReturnType<typeof computeGst>;

export const emptyGstInput = (): GstInput => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return {
    gstin: "",
    stateCode: "27",
    scheme: "regular",
    compositionRate: 1,
    frequency: "monthly",
    period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    aato: 0,
    outward: [],
    inward: [],
    reversals: { rule42_43: { ...ZERO }, others: { ...ZERO }, reclaimed: { ...ZERO }, ineligible: { ...ZERO } },
    openingCredit: { ...ZERO },
    filingDate: new Date().toISOString().slice(0, 10),
  };
};
