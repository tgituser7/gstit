"use client";

import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  computeGst, emptyGstInput, splitTax, totalH, ZERO,
  type GstInput, type GstResult, type Heads, type InwardCategory, type InwardLine, type OutwardCategory, type OutwardLine, type Row,
} from "@/lib/calc/gst";
import { COMPOSITION_RATES, GST_NOTES, GST_RATES, GST_STATES, stateByCode } from "@/lib/rules/gst";
import { money, money2 } from "@/lib/format";
import { download, INWARD_TEMPLATE, inwardFromCsv, inwardFromGstr2b, OUTWARD_TEMPLATE, outwardFromCsv, uid } from "@/lib/import";
import { validateGstin } from "@/lib/validators";
import {
  Button, Callout, Card, Choice, Grid, MoneyField, SelectField, Stat, StepNav, Stepper, TextField, usePersistentState,
} from "../ui";

const STEPS = ["Business", "Sales", "Purchases", "Adjustments", "Result"];

const OUT_CATS: { value: OutwardCategory; label: string }[] = [
  { value: "b2b", label: "B2B — to GST-registered buyer" },
  { value: "b2c", label: "B2C — to consumer / unregistered" },
  { value: "export_wpay", label: "Export — with IGST paid" },
  { value: "export_lut", label: "Export — under LUT (no tax)" },
  { value: "sez_wpay", label: "SEZ — with IGST paid" },
  { value: "sez_lut", label: "SEZ — under LUT (no tax)" },
  { value: "nil", label: "Nil-rated" },
  { value: "exempt", label: "Exempt" },
  { value: "nongst", label: "Non-GST (petrol, alcohol…)" },
];

const IN_CATS: { value: InwardCategory; label: string }[] = [
  { value: "b2b", label: "Purchase from registered supplier" },
  { value: "rcm", label: "Reverse charge (legal, GTA, unregistered…)" },
  { value: "import_goods", label: "Import of goods (IGST at customs)" },
  { value: "import_services", label: "Import of services (RCM)" },
  { value: "isd", label: "From Input Service Distributor" },
  { value: "exempt_nil_comp", label: "Exempt / nil / from composition dealer" },
  { value: "nongst", label: "Non-GST purchase" },
];

const isTaxed = (c: OutwardCategory) => !["nil", "exempt", "nongst", "export_lut", "sez_lut"].includes(c);

export default function GstWizard() {
  const [input, setInput, loaded] = usePersistentState<GstInput>("ks-gst-v1", emptyGstInput());
  const [step, setStep] = useState(0);
  const result = useMemo(() => computeGst(input), [input]);
  const gstinStatus = validateGstin(input.gstin);
  const composition = input.scheme === "composition";

  const patch = (p: Partial<GstInput>) => setInput((prev) => ({ ...prev, ...p }));

  if (!loaded) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">GST return calculator</h1>
            <p className="text-sm text-slate-500">{composition ? "CMP-08 (composition scheme)" : "GSTR-3B with GSTR-1 summary"}</p>
          </div>
          <Button variant="danger" onClick={() => { if (confirm("Clear all GST entries?")) { setInput(emptyGstInput()); setStep(0); } }}>
            Reset
          </Button>
        </div>
        <Stepper steps={STEPS} current={step} onSelect={setStep} />

        {step === 0 && (
          <Card title="Your business" subtitle="Your GSTIN decides your home state — that decides CGST+SGST vs IGST.">
            <div className="space-y-5">
              <Grid>
                <TextField
                  label="GSTIN"
                  value={input.gstin}
                  upper
                  placeholder="27ABCDE1234F1Z5"
                  status={gstinStatus}
                  onChange={(gstin) => {
                    const v = validateGstin(gstin);
                    patch(v.ok ? { gstin, stateCode: v.stateCode } : { gstin });
                  }}
                />
                <SelectField
                  label="Home state"
                  value={input.stateCode}
                  onChange={(stateCode) => patch({ stateCode })}
                  options={GST_STATES.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }))}
                  hint={stateByCode(input.stateCode)?.ut ? "Union territory: SGST is called UTGST here." : undefined}
                />
                <MoneyField label="Last year's aggregate turnover" value={input.aato} onChange={(aato) => patch({ aato })} hint="Used for late-fee cap and QRMP eligibility (≤ ₹5 crore)" />
              </Grid>
              <Choice
                label="Registration type"
                value={input.scheme}
                onChange={(scheme) => patch({ scheme, frequency: scheme === "composition" ? "quarterly" : input.frequency })}
                options={[
                  { value: "regular", label: "Regular taxpayer", desc: "Files GSTR-1 + GSTR-3B, claims ITC" },
                  { value: "composition", label: "Composition scheme", desc: "Pays flat % via CMP-08, no ITC" },
                ]}
              />
              {composition ? (
                <SelectField
                  label="Composition category"
                  value={String(input.compositionRate)}
                  onChange={(v) => patch({ compositionRate: Number(v) })}
                  options={COMPOSITION_RATES.map((c) => ({ value: String(c.rate), label: c.label }))}
                />
              ) : (
                <Choice
                  label="Return filing frequency"
                  value={input.frequency}
                  onChange={(frequency) => patch({ frequency })}
                  options={[
                    { value: "monthly", label: "Monthly", desc: "GSTR-3B due on 20th" },
                    { value: "quarterly", label: "Quarterly (QRMP)", desc: "GSTR-3B due on 22nd / 24th" },
                  ]}
                />
              )}
              <Grid>
                <TextField
                  type="month"
                  label={input.frequency === "quarterly" ? "Last month of the quarter" : "Return period (month)"}
                  value={input.period}
                  onChange={(period) => patch({ period })}
                  hint={input.frequency === "quarterly" ? "e.g. September for Jul–Sep quarter" : undefined}
                />
                <TextField type="date" label="Date you will file & pay" value={input.filingDate} onChange={(filingDate) => patch({ filingDate })} hint={`Due date: ${result.dueDate}`} />
              </Grid>
            </div>
          </Card>
        )}

        {step === 1 && <OutwardEditor input={input} setInput={setInput} />}
        {step === 2 && <InwardEditor input={input} setInput={setInput} />}

        {step === 3 && (
          <div className="space-y-4">
            {composition ? (
              <Callout>Composition dealers cannot claim input tax credit, so there are no adjustments. Go to Result.</Callout>
            ) : (
              <>
                <Card title="ITC reversals" subtitle="Leave zero if not applicable. Your accountant can tell you these.">
                  <div className="space-y-5">
                    <HeadsEditor
                      title="4B(1) — Rule 38, 42 & 43 reversals"
                      desc="Common credit used for exempt supplies or personal use (blocked credit you marked on purchases is added automatically)."
                      value={input.reversals.rule42_43}
                      onChange={(rule42_43) => patch({ reversals: { ...input.reversals, rule42_43 } })}
                    />
                    <HeadsEditor
                      title="4B(2) — Other reversals"
                      desc="e.g. supplier not paid within 180 days (Rule 37), supplier didn't pay tax (Rule 37A). You can reclaim later."
                      value={input.reversals.others}
                      onChange={(others) => patch({ reversals: { ...input.reversals, others } })}
                    />
                    <HeadsEditor
                      title="4D(1) — ITC reclaimed"
                      desc="Credit reversed earlier under 4B(2) that you can now take back (e.g. you paid the supplier)."
                      value={input.reversals.reclaimed}
                      onChange={(reclaimed) => patch({ reversals: { ...input.reversals, reclaimed } })}
                    />
                    <HeadsEditor
                      title="4D(2) — Ineligible ITC (for reporting only)"
                      desc="Credit barred by section 16(4) time limit or place-of-supply rules. Not added to your credit."
                      value={input.reversals.ineligible}
                      onChange={(ineligible) => patch({ reversals: { ...input.reversals, ineligible } })}
                    />
                  </div>
                </Card>
                <Card title="Opening balance in Electronic Credit Ledger" subtitle="GST portal → Services → Ledgers → Electronic Credit Ledger. Unused ITC from earlier months.">
                  <HeadsEditor value={input.openingCredit} onChange={(openingCredit) => patch({ openingCredit })} />
                </Card>
              </>
            )}
          </div>
        )}

        {step === 4 && <GstResultView input={input} result={result} />}

        <StepNav step={step} setStep={setStep} last={STEPS.length - 1} />
      </div>

      <aside className="no-print lg:sticky lg:top-20 lg:self-start">
        <Card title="Live summary">
          <div className="space-y-4">
            <Stat label="Output tax" value={money(totalH(result.liability))} sub={composition ? `${input.compositionRate}% of turnover` : undefined} />
            {!composition && <Stat label="Input tax credit available" value={money(totalH(result.creditAvailable))} tone="good" />}
            {totalH(result.rcmLiability) > 0 && <Stat label="Reverse charge (cash)" value={money(totalH(result.rcmLiability))} />}
            {result.daysLate > 0 && <Stat label={`Interest + late fee (${result.daysLate} days late)`} value={money(totalH(result.interest) + result.lateFeeTotal)} tone="bad" />}
            <div className="rounded-xl bg-indigo-50 p-3">
              <Stat label="Pay in cash" value={money(result.grandCash)} tone="brand" sub={`Due ${result.dueDate}`} />
            </div>
            {!composition && totalH(result.closingCredit) > 0 && (
              <Stat label="ITC carried forward" value={money(totalH(result.closingCredit))} tone="good" />
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function HeadsEditor({ title, desc, value, onChange }: { title?: string; desc?: string; value: Heads; onChange: (h: Heads) => void }) {
  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
      {desc && <p className="mb-2 text-xs text-slate-500">{desc}</p>}
      <Grid cols={4}>
        {(["igst", "cgst", "sgst", "cess"] as const).map((h) => (
          <MoneyField key={h} label={h.toUpperCase()} value={value[h]} onChange={(n) => onChange({ ...value, [h]: n })} />
        ))}
      </Grid>
    </div>
  );
}

function FileButton({ label, accept, onText }: { label: string; accept: string; onText: (text: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button onClick={() => ref.current?.click()}>{label}</Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) onText(await f.text());
          e.target.value = "";
        }}
      />
    </>
  );
}

const cell = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-500";

function NumCell({ value, onChange, className = "" }: { value: number; onChange: (n: number) => void; className?: string }) {
  return <input className={`${cell} text-right tabular-nums ${className}`} inputMode="decimal" value={value || ""} placeholder="0" onChange={(e) => onChange(parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0)} />;
}

function RateCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <select className={cell} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {GST_RATES.map((r) => (
        <option key={r.rate} value={r.rate}>{r.rate}%</option>
      ))}
    </select>
  );
}

type Setter = (fn: (p: GstInput) => GstInput) => void;

function OutwardEditor({ input, setInput }: { input: GstInput; setInput: Setter }) {
  const home = input.stateCode;
  const update = (id: string, p: Partial<OutwardLine>) => setInput((prev) => ({ ...prev, outward: prev.outward.map((l) => (l.id === id ? { ...l, ...p } : l)) }));
  const add = () =>
    setInput((prev) => ({ ...prev, outward: [...prev.outward, { id: uid(), description: "", hsn: "", category: "b2b", pos: home, taxableValue: 0, rate: 18, cess: 0, creditNote: false }] }));
  const total = input.outward.reduce((a, l) => a + l.taxableValue * (l.creditNote ? -1 : 1), 0);

  return (
    <Card
      title="Sales (outward supplies)"
      subtitle="One row per invoice, or one row per rate/category total. Use 'Credit note' for sales returns or discounts after sale."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download("sales-template.csv", OUTWARD_TEMPLATE)}>CSV template</Button>
          <FileButton label="Import CSV" accept=".csv" onText={(t) => setInput((p) => ({ ...p, outward: [...p.outward, ...outwardFromCsv(t, home)] }))} />
          <Button variant="primary" onClick={add}>+ Add row</Button>
        </div>
      }
    >
      {input.outward.length === 0 ? (
        <Callout>No sales yet. Add rows, or import your sales register as CSV (download the template to see the columns). No sales this period? Leave it empty — it&apos;s a nil return.</Callout>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-2">Description</th>
                <th className="w-24 pb-2 pr-2">HSN/SAC</th>
                <th className="w-52 pb-2 pr-2">Type</th>
                <th className="w-40 pb-2 pr-2">Place of supply</th>
                <th className="w-32 pb-2 pr-2 text-right">Taxable value</th>
                <th className="w-20 pb-2 pr-2">Rate</th>
                <th className="w-32 pb-2 pr-2 text-right">Tax</th>
                <th className="w-16 pb-2 pr-2">CN</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {input.outward.map((l) => {
                const inter = l.pos !== home || l.category.startsWith("export") || l.category.startsWith("sez");
                const h = isTaxed(l.category) ? splitTax(l.taxableValue, l.rate, l.cess, inter) : ZERO;
                return (
                  <tr key={l.id} className={`align-top ${l.creditNote ? "bg-rose-50/50" : ""}`}>
                    <td className="py-1 pr-2"><input className={cell} value={l.description} placeholder="Item / invoice no." onChange={(e) => update(l.id, { description: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input className={cell} value={l.hsn} placeholder="8471" onChange={(e) => update(l.id, { hsn: e.target.value })} /></td>
                    <td className="py-1 pr-2">
                      <select className={cell} value={l.category} onChange={(e) => update(l.id, { category: e.target.value as OutwardCategory, pos: e.target.value.startsWith("export") ? "96" : l.pos })}>
                        {OUT_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <select className={cell} value={l.pos} onChange={(e) => update(l.id, { pos: e.target.value })}>
                        {GST_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
                        <option value="96">96 Foreign country</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2"><NumCell value={l.taxableValue} onChange={(taxableValue) => update(l.id, { taxableValue })} /></td>
                    <td className="py-1 pr-2"><RateCell value={l.rate} onChange={(rate) => update(l.id, { rate })} /></td>
                    <td className="py-1 pr-2 text-right text-xs tabular-nums text-slate-600">
                      {h.igst ? <div>IGST {money2(h.igst)}</div> : null}
                      {h.cgst ? <div>CGST {money2(h.cgst)}<br />SGST {money2(h.sgst)}</div> : null}
                      {!totalH(h) && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-1 pr-2 text-center"><input type="checkbox" className="mt-2 h-4 w-4 accent-rose-600" checked={l.creditNote} onChange={(e) => update(l.id, { creditNote: e.target.checked })} /></td>
                    <td className="py-1"><button className="mt-1 px-2 text-slate-400 hover:text-rose-600" title="Remove" onClick={() => setInput((p) => ({ ...p, outward: p.outward.filter((x) => x.id !== l.id) }))}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between text-sm">
            <button className="text-rose-600 hover:underline" onClick={() => confirm("Remove all sales rows?") && setInput((p) => ({ ...p, outward: [] }))}>Clear all</button>
            <span className="font-medium">Net taxable value: {money(total)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function InwardEditor({ input, setInput }: { input: GstInput; setInput: Setter }) {
  const [msg, setMsg] = useState("");
  const update = (id: string, p: Partial<InwardLine>) => setInput((prev) => ({ ...prev, inward: prev.inward.map((l) => (l.id === id ? { ...l, ...p } : l)) }));
  const add = () =>
    setInput((prev) => ({ ...prev, inward: [...prev.inward, { id: uid(), description: "", supplierGstin: "", category: "b2b", interState: false, taxableValue: 0, rate: 18, cess: 0, itc: "eligible", creditNote: false }] }));

  return (
    <Card
      title="Purchases & expenses (inward supplies)"
      subtitle="Only claim ITC on invoices that appear in your GSTR-2B — the portal now blocks GSTR-3B if ITC exceeds GSTR-2B."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download("purchase-template.csv", INWARD_TEMPLATE)}>CSV template</Button>
          <FileButton label="Import CSV" accept=".csv" onText={(t) => setInput((p) => ({ ...p, inward: [...p.inward, ...inwardFromCsv(t)] }))} />
          <FileButton
            label="Import GSTR-2B JSON"
            accept=".json"
            onText={(t) => {
              try {
                const rows = inwardFromGstr2b(JSON.parse(t));
                setInput((p) => ({ ...p, inward: [...p.inward, ...rows] }));
                setMsg(`Imported ${rows.length} documents from GSTR-2B. Review rates, and mark any blocked credit (sec 17(5)).`);
              } catch {
                setMsg("Could not read that file. Download the JSON from GST portal → Returns → GSTR-2B.");
              }
            }}
          />
          <Button variant="primary" onClick={add}>+ Add row</Button>
        </div>
      }
    >
      {msg && <div className="mb-3"><Callout tone="good">{msg}</Callout></div>}
      {input.inward.length === 0 ? (
        <Callout>
          No purchases yet. Add rows, import a CSV, or import the GSTR-2B JSON file from the GST portal. Mark ITC as <b>blocked</b> for items
          listed in section 17(5) — food & beverages, cars (except for specified uses), club membership, personal-use items, works contract for building.
        </Callout>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-2">Description</th>
                <th className="w-40 pb-2 pr-2">Supplier GSTIN</th>
                <th className="w-52 pb-2 pr-2">Type</th>
                <th className="w-20 pb-2 pr-2">Inter-state</th>
                <th className="w-32 pb-2 pr-2 text-right">Taxable value</th>
                <th className="w-20 pb-2 pr-2">Rate</th>
                <th className="w-28 pb-2 pr-2">ITC</th>
                <th className="w-12 pb-2 pr-2">CN</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {input.inward.map((l) => {
                const g = l.supplierGstin ? validateGstin(l.supplierGstin) : null;
                return (
                  <tr key={l.id} className={`align-top ${l.creditNote ? "bg-rose-50/50" : ""}`}>
                    <td className="py-1 pr-2"><input className={cell} value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} /></td>
                    <td className="py-1 pr-2">
                      <input
                        className={`${cell} ${g && !g.ok ? "border-rose-300" : ""}`}
                        value={l.supplierGstin}
                        onChange={(e) => {
                          const supplierGstin = e.target.value.toUpperCase();
                          const v = validateGstin(supplierGstin);
                          update(l.id, v.ok ? { supplierGstin, interState: v.stateCode !== input.stateCode } : { supplierGstin });
                        }}
                      />
                      {g && !g.ok && <div className="text-[11px] text-rose-600">{g.message}</div>}
                    </td>
                    <td className="py-1 pr-2">
                      <select className={cell} value={l.category} onChange={(e) => update(l.id, { category: e.target.value as InwardCategory })}>
                        {IN_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pr-2 text-center"><input type="checkbox" className="mt-2 h-4 w-4 accent-indigo-600" checked={l.interState} onChange={(e) => update(l.id, { interState: e.target.checked })} /></td>
                    <td className="py-1 pr-2"><NumCell value={l.taxableValue} onChange={(taxableValue) => update(l.id, { taxableValue })} /></td>
                    <td className="py-1 pr-2"><RateCell value={l.rate} onChange={(rate) => update(l.id, { rate })} /></td>
                    <td className="py-1 pr-2">
                      <select className={cell} value={l.itc} onChange={(e) => update(l.id, { itc: e.target.value as InwardLine["itc"] })}>
                        <option value="eligible">Eligible</option>
                        <option value="blocked">Blocked 17(5)</option>
                        <option value="none">Not in 2B / none</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2 text-center"><input type="checkbox" className="mt-2 h-4 w-4 accent-rose-600" checked={l.creditNote} onChange={(e) => update(l.id, { creditNote: e.target.checked })} /></td>
                    <td className="py-1"><button className="mt-1 px-2 text-slate-400 hover:text-rose-600" title="Remove" onClick={() => setInput((p) => ({ ...p, inward: p.inward.filter((x) => x.id !== l.id) }))}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-sm">
            <button className="text-rose-600 hover:underline" onClick={() => confirm("Remove all purchase rows?") && setInput((p) => ({ ...p, inward: [] }))}>Clear all</button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------- Result ----------------

function T({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => <th key={h} className={`pb-2 pr-3 ${i ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}

function R({ label, cells, strong }: { label: ReactNode; cells: (number | null)[]; strong?: boolean }) {
  return (
    <tr className={`border-b border-slate-100 ${strong ? "font-semibold" : ""}`}>
      <td className="py-2 pr-3">{label}</td>
      {cells.map((c, i) => <td key={i} className={`py-2 pr-3 text-right ${c === 0 ? "text-slate-300" : ""}`}>{c === null ? "" : money2(c)}</td>)}
    </tr>
  );
}

const rowCells = (r: Row, withTx = true) => [...(withTx ? [r.txval] : []), r.igst, r.cgst, r.sgst, r.cess];
const headCells = (h: Heads) => [h.igst, h.cgst, h.sgst, h.cess];

function GstResultView({ input, result }: { input: GstInput; result: GstResult }) {
  const b = result.gstr3b;
  const g1 = result.gstr1;
  const sgstLabel = stateByCode(input.stateCode)?.ut ? "UTGST" : "SGST";
  const composition = input.scheme === "composition";
  const exportCsv = () => {
    const lines = [
      ["Table", "Description", "Taxable value", "IGST", "CGST", sgstLabel, "Cess"],
      ["3.1(a)", "Outward taxable supplies", ...rowCells(b.t31.a)],
      ["3.1(b)", "Zero-rated supplies", ...rowCells(b.t31.b)],
      ["3.1(c)", "Nil-rated & exempt", ...rowCells(b.t31.c)],
      ["3.1(d)", "Inward supplies under reverse charge", ...rowCells(b.t31.d)],
      ["3.1(e)", "Non-GST outward", ...rowCells(b.t31.e)],
      ["4A", "ITC available", "", ...headCells(b.t4.A)],
      ["4B(1)", "ITC reversed", "", ...headCells(b.t4.B1)],
      ["4B(2)", "ITC reversed — others", "", ...headCells(b.t4.B2)],
      ["4C", "Net ITC", "", ...headCells(b.t4.C)],
      ["6.1", "Cash payable", "", ...headCells(result.cashTotal)],
    ];
    download(`gstr3b-${input.period}.csv`, lines.map((l) => l.join(",")).join("\n"));
  };

  return (
    <div className="space-y-4">
      <Card
        title={`${composition ? "CMP-08" : "GSTR-3B"} for ${input.frequency === "quarterly" ? "quarter ending " : ""}${input.period}`}
        subtitle={input.gstin || undefined}
        actions={
          <div className="no-print flex gap-2">
            <Button onClick={() => window.print()}>Print / PDF</Button>
            {!composition && <Button onClick={exportCsv}>Export CSV</Button>}
            <Button onClick={() => download(`gst-${input.period}.json`, JSON.stringify({ input, result }, null, 2), "application/json")}>JSON</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Tax liability" value={money(totalH(result.liability) + totalH(result.rcmLiability))} />
          <Stat label="Paid through ITC" value={money(totalH(result.liability) - totalH(result.cashTotal) + totalH(result.rcmLiability))} tone="good" />
          <Stat label="Pay in cash" value={money(result.grandCash)} tone="brand" sub={result.daysLate ? `incl. interest & late fee` : `by ${result.dueDate}`} />
          <Stat label="ITC carried forward" value={money(totalH(result.closingCredit))} />
        </div>
        {result.daysLate > 0 && (
          <div className="mt-4">
            <Callout tone="warn">
              Filing {result.daysLate} days after the due date ({result.dueDate}). Interest @18% p.a.: <b>{money2(totalH(result.interest))}</b>; late fee: <b>{money(result.lateFeeTotal)}</b> (capped by turnover).
            </Callout>
          </div>
        )}
      </Card>

      {result.warnings.map((w) => <Callout key={w} tone="warn">{w}</Callout>)}

      {composition ? (
        <Card title="CMP-08 — Statement for payment of self-assessed tax">
          <T head={["Description", "Value", "IGST", "CGST", sgstLabel, "Cess"]}>
            <R label="Outward supplies (incl. exempt)" cells={[b.t31.a.txval + b.t31.b.txval + b.t31.c.txval, ...headCells(result.liability)]} />
            <R label="Inward supplies attracting reverse charge" cells={rowCells(b.t31.d)} />
            <R label="Interest" cells={[null, ...headCells(result.interest)]} />
            <R label="Total to pay in cash" cells={[null, ...headCells(result.cashTotal)]} strong />
          </T>
        </Card>
      ) : (
        <>
          <Card title="Table 3.1 — Outward supplies and inward supplies liable to reverse charge" subtitle="Mostly auto-filled from your GSTR-1. Check it matches.">
            <T head={["Nature of supplies", "Taxable value", "IGST", "CGST", sgstLabel, "Cess"]}>
              <R label="(a) Outward taxable supplies (other than zero, nil, exempt)" cells={rowCells(b.t31.a)} />
              <R label="(b) Outward taxable supplies (zero rated)" cells={rowCells(b.t31.b)} />
              <R label="(c) Other outward supplies (nil rated, exempted)" cells={rowCells(b.t31.c)} />
              <R label="(d) Inward supplies (liable to reverse charge)" cells={rowCells(b.t31.d)} />
              <R label="(e) Non-GST outward supplies" cells={rowCells(b.t31.e)} />
            </T>
          </Card>

          {b.t32.length > 0 && (
            <Card title="Table 3.2 — Inter-state supplies to unregistered persons" subtitle="State-wise; enter under 'Supplies made to Unregistered Persons'.">
              <T head={["Place of supply", "Taxable value", "IGST"]}>
                {b.t32.map((r) => <R key={r.pos} label={`${r.pos} — ${r.name}`} cells={[r.txval, r.igst]} />)}
              </T>
            </Card>
          )}

          <Card title="Table 4 — Eligible ITC" subtitle="4A is auto-filled from GSTR-2B. Enter reversals in 4B.">
            <T head={["Details", "IGST", "CGST", sgstLabel, "Cess"]}>
              <R label="A(1) Import of goods" cells={headCells(b.t4.a1)} />
              <R label="A(2) Import of services" cells={headCells(b.t4.a2)} />
              <R label="A(3) Inward supplies liable to reverse charge" cells={headCells(b.t4.a3)} />
              <R label="A(4) Inward supplies from ISD" cells={headCells(b.t4.a4)} />
              <R label="A(5) All other ITC" cells={headCells(b.t4.a5)} />
              <R label="B(1) Reversed — Rules 38, 42, 43 & sec 17(5)" cells={headCells(b.t4.B1)} />
              <R label="B(2) Reversed — others" cells={headCells(b.t4.B2)} />
              <R label="C. Net ITC available (A − B)" cells={headCells(b.t4.C)} strong />
              <R label="D(1) ITC reclaimed (reversed earlier in 4B(2))" cells={headCells(b.t4.D1)} />
              <R label="D(2) Ineligible ITC — sec 16(4) & POS rules" cells={headCells(b.t4.D2)} />
            </T>
          </Card>

          <Card title="Table 5 — Exempt, nil-rated and non-GST inward supplies">
            <T head={["Nature of supplies", "Inter-state", "Intra-state"]}>
              <R label="From composition dealer, exempt & nil-rated" cells={[b.t5.exemptInter, b.t5.exemptIntra]} />
              <R label="Non-GST supply" cells={[b.t5.nonGstInter, b.t5.nonGstIntra]} />
            </T>
          </Card>

          <Card title="Table 5.1 — Interest & late fee">
            <T head={["", "IGST", "CGST", sgstLabel, "Cess"]}>
              <R label="Interest" cells={headCells(b.t51.interest)} />
              <R label="Late fee" cells={[null, b.t51.lateFee.cgst, b.t51.lateFee.sgst, null]} />
            </T>
          </Card>

          <Card title="Table 6.1 — Payment of tax" subtitle="How the portal will use your credit (Sec 49 + Rule 88A order). Cash = what you deposit via PMT-06 challan.">
            <T head={["Head", "Tax payable", "Paid by IGST ITC", "by CGST ITC", `by ${sgstLabel} ITC`, "by Cess ITC", "Paid in cash"]}>
              {b.t61.rows.map((r) => (
                <R key={r.head} label={r.head === "sgst" ? sgstLabel : r.head.toUpperCase()} cells={[r.liability, r.byIgst, r.byCgst, r.bySgst, r.byCess, r.cash]} />
              ))}
              {totalH(b.t61.rcm) > 0 &&
                (["igst", "cgst", "sgst", "cess"] as const).filter((h) => b.t61.rcm[h] > 0).map((h) => (
                  <R key={`rcm-${h}`} label={`${h === "sgst" ? sgstLabel : h.toUpperCase()} — reverse charge`} cells={[b.t61.rcm[h], null, null, null, null, b.t61.rcm[h]]} />
                ))}
            </T>
          </Card>

          <Card title="GSTR-1 summary" subtitle={`File GSTR-1 first (due 11th monthly / 13th quarterly). Table 12 HSN summary is mandatory.`}>
            <T head={["GSTR-1 table (documents)", "Taxable value", "IGST", "CGST", sgstLabel, "Cess"]}>
              <R label={`4A — B2B invoices (${g1.b2b.count})`} cells={rowCells(g1.b2b)} />
              <R label={`5 — B2C Large (inter-state > ₹1 lakh) (${g1.b2cl.count})`} cells={rowCells(g1.b2cl)} />
              <R label={`6A — Exports (${g1.exp.count})`} cells={rowCells(g1.exp)} />
              <R label={`6B — Supplies to SEZ (${g1.sez.count})`} cells={rowCells(g1.sez)} />
              <R label={`7 — B2C Others (state & rate-wise) (${g1.b2cs.count})`} cells={rowCells(g1.b2cs)} />
              <R label={`9B — Credit/debit notes (registered) (${g1.cdnr.count})`} cells={rowCells(g1.cdnr)} />
              <R label={`9B — Credit/debit notes (unregistered) (${g1.cdnur.count})`} cells={rowCells(g1.cdnur)} />
            </T>
            <h3 className="mb-2 mt-5 text-sm font-semibold">Table 8 — Nil-rated, exempt, non-GST</h3>
            <T head={["Type", "Inter-state", "Intra-state"]}>
              <R label="Nil-rated" cells={[g1.nil.inter, g1.nil.intra]} />
              <R label="Exempted" cells={[g1.nil.exemptInter, g1.nil.exemptIntra]} />
              <R label="Non-GST" cells={[g1.nil.nonGstInter, g1.nil.nonGstIntra]} />
            </T>
            {g1.hsn.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-sm font-semibold">Table 12 — HSN-wise summary</h3>
                <T head={["HSN / rate", "Taxable value", "IGST", "CGST", sgstLabel, "Cess"]}>
                  {g1.hsn.map((h) => <R key={`${h.hsn}-${h.rate}`} label={`${h.hsn} @ ${h.rate}%`} cells={rowCells(h)} />)}
                </T>
              </>
            )}
          </Card>
        </>
      )}

      <Card title="How to file on gst.gov.in">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {composition ? (
            <>
              <li>Log in → Services → Returns → Returns Dashboard → choose the quarter → <b>CMP-08</b> → Prepare Online.</li>
              <li>Enter the outward turnover and reverse-charge values shown above.</li>
              <li>Create a challan (Services → Payments → Create Challan) for the cash amount, pay, then file with DSC/EVC.</li>
              <li>File the annual <b>GSTR-4</b> by 30 April after the year ends.</li>
            </>
          ) : (
            <>
              <li>Upload invoices in <b>GSTR-1</b> (or IFF for QRMP months 1–2) and file it — this auto-fills Table 3.1 of GSTR-3B.</li>
              <li>Download <b>GSTR-2B</b> and match it with your purchase register. Only claim what 2B shows as available.</li>
              <li>Open <b>GSTR-3B</b>, check auto-filled 3.1 and 4A, enter 4B reversals, 3.1(d) reverse charge and Table 5 exactly as above.</li>
              <li>Click <b>Proceed to payment</b>. Check that the portal&apos;s set-off matches Table 6.1 above. If cash is short, create a challan (PMT-06) for {money(result.grandCash)}.</li>
              <li>Click <b>Make payment / Post credit to ledger</b>, then file with DSC or EVC.</li>
            </>
          )}
        </ol>
      </Card>

      <Card title="Keep in mind">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {GST_NOTES.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </Card>
    </div>
  );
}
