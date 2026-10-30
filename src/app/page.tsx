import Link from "next/link";
import { INCOME_TAX_RULES, DEFAULT_FY } from "@/lib/rules/income-tax";
import { GST_RULES_LAST_VERIFIED } from "@/lib/rules/gst";
import { DOCUMENT_CHECKLIST } from "@/lib/calc/itr-guide";

const gstDocs = [
  "Sales register / invoices for the period (with HSN/SAC)",
  "Purchase register and GSTR-2B for the period",
  "Credit / debit notes issued and received",
  "Reverse-charge expenses (legal fees, GTA, imports of services)",
  "Electronic credit ledger opening balance",
];

export default function Home() {
  const it = INCOME_TAX_RULES[DEFAULT_FY];
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-medium text-indigo-100">For salaried people, freelancers & small businesses in India</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
          Work out your GST and Income Tax returns — and know exactly what to fill where.
        </h1>
        <p className="mt-3 max-w-2xl text-indigo-100">
          Answer simple questions. We compute tax under current law, compare both regimes, pick your ITR form, and map every
          number to the box it goes in on the government portal.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/itr" className="rounded-xl bg-white px-5 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50">
            Start Income Tax Return →
          </Link>
          <Link href="/gst" className="rounded-xl bg-indigo-500/40 px-5 py-2.5 font-semibold text-white ring-1 ring-white/40 hover:bg-indigo-500/60">
            Start GST Return →
          </Link>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Income Tax Return</h2>
          <p className="mt-1 text-sm text-slate-500">{it.label}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>✓ New vs old regime comparison, with the saving</li>
            <li>✓ Salary, HRA, house property, 44AD / 44ADA, capital gains</li>
            <li>✓ 87A rebate with marginal relief, surcharge, cess</li>
            <li>✓ Interest u/s 234A / 234B and late fee u/s 234F</li>
            <li>✓ Tells you ITR-1, 2, 3 or 4 — and why</li>
            <li>✓ Schedule-by-schedule filling guide</li>
          </ul>
          <h3 className="mt-6 text-sm font-semibold text-slate-900">Keep these ready</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {DOCUMENT_CHECKLIST.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">GST Return</h2>
          <p className="mt-1 text-sm text-slate-500">GSTR-3B, GSTR-1 summary, CMP-08 (composition)</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>✓ GST 2.0 rates (5% / 18% / 40%) plus legacy rates</li>
            <li>✓ CGST + SGST vs IGST decided from place of supply</li>
            <li>✓ ITC set-off in the legal order (Sec 49 & Rule 88A)</li>
            <li>✓ Reverse charge, blocked credit, Rule 42/43 reversals</li>
            <li>✓ Interest @18% and late fee with turnover caps</li>
            <li>✓ Import invoices from CSV or your GSTR-2B JSON</li>
          </ul>
          <h3 className="mt-6 text-sm font-semibold text-slate-900">Keep these ready</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {gstDocs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Rates last verified on {it.lastVerified} (income tax) and {GST_RULES_LAST_VERIFIED} (GST) against official sources.{" "}
        <Link href="/rules" className="text-indigo-600 underline">See every rate and its source →</Link>
      </p>
    </div>
  );
}
