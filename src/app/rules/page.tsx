import type { Metadata } from "next";
import { INCOME_TAX_RULES, type Slab } from "@/lib/rules/income-tax";
import { COMPOSITION_RATES, GST_NOTES, GST_RATES, GST_RULES_LAST_VERIFIED, GST_SOURCES, LATE_FEE } from "@/lib/rules/gst";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Rates & sources — Kar Saathi" };

const slabText = (slabs: Slab[]) =>
  slabs.map((s, i) => {
    const from = i === 0 ? 0 : slabs[i - 1].upTo!;
    return { range: s.upTo === null ? `Above ${money(from)}` : `${money(from)} – ${money(s.upTo)}`, rate: `${s.rate * 100}%` };
  });

function SlabTable({ title, slabs }: { title: string; slabs: Slab[] }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-slate-700">{title}</h4>
      <table className="w-full text-sm">
        <tbody>
          {slabText(slabs).map((r) => (
            <tr key={r.range} className="border-t border-slate-100">
              <td className="py-1">{r.range}</td>
              <td className="py-1 text-right font-medium">{r.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Box = ({ children }: { children: React.ReactNode }) => <section className="rounded-2xl border border-slate-200 bg-white p-5">{children}</section>;

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rates & official sources</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The Income Tax Department and GSTN do not publish tax rules as a live data feed, so every rate this app uses is
          kept in versioned rule files (<code>src/lib/rules/</code>) and checked against the official sources below. When a new
          Budget or GST Council decision changes something, those files are updated.
        </p>
      </div>

      {Object.values(INCOME_TAX_RULES).map((r) => (
        <Box key={r.fy}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Income tax — {r.label}</h2>
            <span className="text-xs text-slate-500">Last verified {r.lastVerified}</span>
          </div>
          <p className="text-sm text-slate-500">{r.act}</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <SlabTable title="New regime (default)" slabs={r.newRegime.slabs} />
            <SlabTable title="Old regime — below 60" slabs={r.oldRegime.slabs.general} />
            <SlabTable title="Old regime — 60 to 79" slabs={r.oldRegime.slabs.senior} />
            <SlabTable title="Old regime — 80+" slabs={r.oldRegime.slabs.superSenior} />
          </div>
          <div className="mt-5 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <p>Standard deduction: <b>{money(r.newRegime.standardDeduction)}</b> new / <b>{money(r.oldRegime.standardDeduction)}</b> old</p>
            <p>87A rebate: up to <b>{money(r.newRegime.rebateMax)}</b> if income ≤ {money(r.newRegime.rebateIncomeLimit)} (new); <b>{money(r.oldRegime.rebateMax)}</b> if ≤ {money(r.oldRegime.rebateIncomeLimit)} (old)</p>
            <p>STCG 111A: <b>{r.capitalGains.stcg111A * 100}%</b> · LTCG 112A: <b>{r.capitalGains.ltcg112A * 100}%</b> above {money(r.capitalGains.ltcg112AExemption)}</p>
            <p>Surcharge: 10% / 15% / 25% above ₹50 L / ₹1 Cr / ₹2 Cr (37% above ₹5 Cr in old regime only)</p>
            <p>Health & education cess: <b>{r.cessRate * 100}%</b></p>
            <p>Late fee 234F: {money(r.lateFee234F.reduced)} (income ≤ ₹5 L) / {money(r.lateFee234F.full)}</p>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {r.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <Sources list={r.sources} />
        </Box>
      ))}

      <Box>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">GST — rates after GST 2.0 (from 22 Sep 2025)</h2>
          <span className="text-xs text-slate-500">Last verified {GST_RULES_LAST_VERIFIED}</span>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <div>
            <h4 className="mb-1 text-sm font-semibold text-slate-700">Rate slabs</h4>
            <ul className="space-y-1 text-sm">{GST_RATES.map((r) => <li key={r.rate}>{r.label}</li>)}</ul>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold text-slate-700">Composition scheme</h4>
            <ul className="space-y-1 text-sm">{COMPOSITION_RATES.map((r) => <li key={r.key}>{r.label}</li>)}</ul>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold text-slate-700">Interest & late fee</h4>
            <ul className="space-y-1 text-sm">
              <li>Interest: 18% p.a. on tax paid late in cash</li>
              <li>Late fee: {money(LATE_FEE.perDay)}/day ({money(LATE_FEE.perDayNil)}/day for nil returns)</li>
              <li>Cap: {money(LATE_FEE.capNil)} nil · {money(2000)} (turnover ≤ ₹1.5 Cr) · {money(5000)} (≤ ₹5 Cr) · {money(10000)} (above)</li>
            </ul>
          </div>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {GST_NOTES.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <Sources list={GST_SOURCES} />
      </Box>
    </div>
  );
}

function Sources({ list }: { list: { title: string; url: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {list.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100">
          {s.title} ↗
        </a>
      ))}
    </div>
  );
}
