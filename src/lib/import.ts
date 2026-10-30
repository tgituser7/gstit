import type { InwardCategory, InwardLine, OutwardCategory, OutwardLine } from "./calc/gst";
import { GST_RATES } from "./rules/gst";
import { num } from "./format";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const yes = (v: string | undefined) => /^(y|yes|true|1)$/i.test(v ?? "");

const OUT_CATS: OutwardCategory[] = ["b2b", "b2c", "export_wpay", "export_lut", "sez_wpay", "sez_lut", "nil", "exempt", "nongst"];
const IN_CATS: InwardCategory[] = ["b2b", "import_goods", "import_services", "rcm", "isd", "exempt_nil_comp", "nongst"];

export const OUTWARD_TEMPLATE =
  "description,hsn,category,pos,taxable_value,rate,cess,credit_note\n" +
  "Laptop sale to registered dealer,8471,b2b,27,100000,18,0,no\n" +
  "Retail counter sales,8471,b2c,27,250000,18,0,no\n" +
  "Online order to Karnataka customer,8471,b2c,29,40000,18,0,no\n" +
  "Export under LUT,8471,export_lut,96,300000,0,0,no\n" +
  "Sales return from dealer,8471,b2b,27,10000,18,0,yes\n";

export const INWARD_TEMPLATE =
  "description,supplier_gstin,category,inter_state,taxable_value,rate,cess,itc,credit_note\n" +
  "Stock purchase,27AAPFU0939F1ZV,b2b,no,180000,18,0,eligible,no\n" +
  "Purchase from Gujarat supplier,24AAACC1206D1ZM,b2b,yes,60000,18,0,eligible,no\n" +
  "Legal fees (reverse charge),,rcm,no,20000,18,0,eligible,no\n" +
  "Staff food & beverages (blocked u/s 17(5)),27AAPFU0939F1ZV,b2b,no,5000,5,0,blocked,no\n";

export function outwardFromCsv(text: string, homeState: string): OutwardLine[] {
  return parseCsv(text).map((r) => ({
    id: uid(),
    description: r.description ?? "",
    hsn: r.hsn ?? r.hsn_sac ?? "",
    category: (OUT_CATS.includes(r.category as OutwardCategory) ? r.category : "b2b") as OutwardCategory,
    pos: (r.pos ?? r.place_of_supply ?? homeState).padStart(2, "0").slice(0, 2),
    taxableValue: num(r.taxable_value),
    rate: num(r.rate),
    cess: num(r.cess),
    creditNote: yes(r.credit_note),
  }));
}

export function inwardFromCsv(text: string): InwardLine[] {
  return parseCsv(text).map((r) => ({
    id: uid(),
    description: r.description ?? "",
    supplierGstin: (r.supplier_gstin ?? "").toUpperCase(),
    category: (IN_CATS.includes(r.category as InwardCategory) ? r.category : "b2b") as InwardCategory,
    interState: yes(r.inter_state),
    taxableValue: num(r.taxable_value),
    rate: num(r.rate),
    cess: num(r.cess),
    itc: (["eligible", "blocked", "none"].includes(r.itc) ? r.itc : "eligible") as InwardLine["itc"],
    creditNote: yes(r.credit_note),
  }));
}

const nearestRate = (taxable: number, tax: number) => {
  if (!taxable) return 0;
  const actual = (tax / taxable) * 100;
  return GST_RATES.reduce((best, r) => (Math.abs(r.rate - actual) < Math.abs(best - actual) ? r.rate : best), 0);
};

type Amounts = { txval?: number; igst?: number; cgst?: number; sgst?: number; cess?: number };
const sumItems = (doc: Amounts & { items?: Amounts[] }) => {
  const src = doc.items?.length ? doc.items : [doc];
  type Totals = { txval: number; igst: number; cgst: number; sgst: number; cess: number };
  return src.reduce<Totals>(
    (a, x) => ({ txval: a.txval + num(x.txval), igst: a.igst + num(x.igst), cgst: a.cgst + num(x.cgst), sgst: a.sgst + num(x.sgst), cess: a.cess + num(x.cess) }),
    { txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
  );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
// GSTR-2B JSON downloaded from the GST portal (Returns → GSTR-2B → Download JSON).
// Reads B2B invoices, credit/debit notes and imports of goods.
export function inwardFromGstr2b(json: any): InwardLine[] {
  const doc = json?.data?.docdata ?? json?.docdata ?? json;
  const out: InwardLine[] = [];
  const push = (gstin: string, label: string, a: ReturnType<typeof sumItems>, opts: Partial<InwardLine>) => {
    out.push({
      id: uid(),
      description: label,
      supplierGstin: gstin,
      category: "b2b",
      interState: a.igst > 0,
      taxableValue: a.txval,
      rate: nearestRate(a.txval, a.igst + a.cgst + a.sgst),
      cess: a.cess,
      itc: "eligible",
      creditNote: false,
      ...opts,
    });
  };
  for (const s of doc?.b2b ?? []) {
    for (const inv of s.inv ?? []) {
      push(s.ctin, `${s.trdnm ?? "Supplier"} — inv ${inv.inum ?? ""}`, sumItems(inv), {
        category: inv.rev === "Y" ? "rcm" : "b2b",
        itc: inv.itcavl === "N" ? "none" : "eligible",
      });
    }
  }
  for (const s of doc?.cdnr ?? []) {
    for (const nt of s.nt ?? []) {
      push(s.ctin, `${s.trdnm ?? "Supplier"} — ${nt.typ === "C" ? "credit" : "debit"} note ${nt.ntnum ?? ""}`, sumItems(nt), {
        creditNote: nt.typ === "C",
        itc: nt.itcavl === "N" ? "none" : "eligible",
      });
    }
  }
  for (const b of doc?.impg ?? []) {
    push("", `Import of goods — BoE ${b.boenum ?? ""}`, sumItems(b), { category: "import_goods", interState: true });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function download(name: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
