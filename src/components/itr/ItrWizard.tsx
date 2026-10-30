"use client";

import { useMemo, useState } from "react";
import { computeItr, emptyItrInput, type ItrInput, type RegimeResult } from "@/lib/calc/income-tax";
import { buildItrGuide } from "@/lib/calc/itr-guide";
import { DEFAULT_FY, INCOME_TAX_RULES } from "@/lib/rules/income-tax";
import { money } from "@/lib/format";
import { download } from "@/lib/import";
import {
  Button, Callout, Card, Choice, Grid, Hint, MoneyField, SelectField, Stat, StepNav, Stepper, TextField, Toggle, usePersistentState,
} from "../ui";

const STEPS = ["About you", "Salary", "House property", "Business", "Other income", "Deductions", "Taxes paid", "Result"];

export default function ItrWizard() {
  const [input, setInput, loaded] = usePersistentState<ItrInput>("ks-itr-v1", emptyItrInput(DEFAULT_FY));
  const [step, setStep] = useState(0);
  const rules = INCOME_TAX_RULES[input.fy];
  const L = rules.oldRegime.limits;

  const set = <K extends keyof ItrInput>(key: K, patch: Partial<ItrInput[K]> | ItrInput[K]) =>
    setInput((prev) => ({
      ...prev,
      [key]: typeof prev[key] === "object" && prev[key] !== null ? { ...(prev[key] as object), ...(patch as object) } : patch,
    }));

  const result = useMemo(() => computeItr(input), [input]);
  const guide = useMemo(() => buildItrGuide(input, result), [input, result]);
  const s = input.salary;
  const regimeNote = <span className="font-medium text-amber-700">Old regime only</span>;

  if (!loaded) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Income Tax Return calculator</h1>
            <p className="text-sm text-slate-500">{rules.act}</p>
          </div>
          <div className="no-print flex gap-2">
            <Button onClick={() => { if (confirm("Clear all income tax entries?")) { setInput(emptyItrInput(input.fy)); setStep(0); } }} variant="danger">
              Reset
            </Button>
          </div>
        </div>
        <Stepper steps={STEPS} current={step} onSelect={setStep} />

        {step === 0 && (
          <Card title="About you" subtitle="These decide your slabs, rebate and which ITR form applies.">
            <div className="space-y-5">
              <SelectField
                label="Financial year"
                value={input.fy}
                onChange={(fy) => setInput((p) => ({ ...p, fy, filing: { ...p.filing, dueDate: INCOME_TAX_RULES[fy].defaultDueDate } }))}
                options={Object.values(INCOME_TAX_RULES).map((r) => ({ value: r.fy, label: r.label }))}
                hint="Filing in 2026? Choose FY 2025-26 — that is the year you earned the income."
              />
              <Choice
                label="Age during the year"
                value={input.ageGroup}
                onChange={(ageGroup) => set("ageGroup", ageGroup)}
                options={[
                  { value: "below60", label: "Below 60" },
                  { value: "60to80", label: "60 to 79", desc: "Senior citizen" },
                  { value: "above80", label: "80 or above", desc: "Super senior" },
                ]}
              />
              <Choice
                label="Residential status"
                value={input.residential}
                onChange={(residential) => set("residential", residential)}
                options={[
                  { value: "resident", label: "Resident", desc: "In India 182+ days" },
                  { value: "nri", label: "Non-resident (NRI)", desc: "No 87A rebate; ITR-2/3" },
                ]}
              />
              <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Tick any that apply — they decide your ITR form</p>
                <Toggle label="I was a director in a company" checked={input.flags.director} onChange={(director) => set("flags", { director })} />
                <Toggle label="I held unlisted equity shares" checked={input.flags.unlistedShares} onChange={(unlistedShares) => set("flags", { unlistedShares })} />
                <Toggle label="I have foreign assets / foreign income" checked={input.flags.foreignAssets} onChange={(foreignAssets) => set("flags", { foreignAssets })} />
                <Toggle label="Agricultural income above ₹5,000" checked={input.flags.agriIncomeAbove5k} onChange={(agriIncomeAbove5k) => set("flags", { agriIncomeAbove5k })} />
                <Toggle label="I own more than one house property" checked={input.flags.moreThanOneHouse} onChange={(moreThanOneHouse) => set("flags", { moreThanOneHouse })} />
              </div>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title="Salary & pension" subtitle="Copy these from Form 16 Part B. Leave blank if you are not salaried.">
            <div className="space-y-5">
              <Grid cols={3}>
                <MoneyField label="Basic salary" value={s.basic} onChange={(basic) => set("salary", { basic })} hint="Pensioners: enter pension here" />
                <MoneyField label="Dearness allowance (DA)" value={s.da} onChange={(da) => set("salary", { da })} />
                <MoneyField label="HRA received" value={s.hraReceived} onChange={(hraReceived) => set("salary", { hraReceived })} />
                <MoneyField label="Other allowances" value={s.otherAllowances} onChange={(otherAllowances) => set("salary", { otherAllowances })} hint="Special, LTA, conveyance, etc." />
                <MoneyField label="Bonus / commission" value={s.bonus} onChange={(bonus) => set("salary", { bonus })} />
                <MoneyField label="Perquisites — sec 17(2)" value={s.perquisites} onChange={(perquisites) => set("salary", { perquisites })} hint="From Form 12BA" />
                <MoneyField label="Employer's NPS contribution" value={s.employerNps} onChange={(employerNps) => set("salary", { employerNps })} hint={`Added to salary and deducted u/s 80CCD(2), up to ${rules.newRegime.employerNpsPct * 100}% (new) / ${rules.oldRegime.employerNpsPct * 100}% (old) of basic + DA`} />
                <MoneyField label="Professional tax paid" value={s.professionalTax} onChange={(professionalTax) => set("salary", { professionalTax })} hint={regimeNote} />
                <MoneyField label="Family pension received" value={s.familyPension} onChange={(familyPension) => set("salary", { familyPension })} hint="Taxed under Other sources" />
              </Grid>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="mb-3 text-sm font-medium text-slate-700">HRA exemption {regimeNote}</p>
                <Grid>
                  <MoneyField label="Rent paid in the year" value={s.rentPaid} onChange={(rentPaid) => set("salary", { rentPaid })} hint="Give landlord's PAN to employer if rent > ₹1 lakh/yr" />
                  <div className="pt-6">
                    <Toggle label={`I lived in ${rules.hraMetroCities.join(", ")}`} checked={s.metro} onChange={(metro) => set("salary", { metro })} hint="50% of basic + DA for these cities, 40% elsewhere" />
                  </div>
                </Grid>
                {s.hraReceived > 0 && <Hint>HRA exempt under old regime: <b>{money(result.oldRegime.hraExempt)}</b></Hint>}
              </div>
              <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 p-4">
                <Stat label="Gross salary" value={money(result.newRegime.grossSalary)} />
                <Stat label="Taxable salary (new)" value={money(result.newRegime.salaryIncome)} tone="brand" />
                <Stat label="Taxable salary (old)" value={money(result.oldRegime.salaryIncome)} />
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title="House property" subtitle="A house you own — whether you live in it or rent it out.">
            <div className="space-y-5">
              <Choice
                value={input.houseProperty.type}
                onChange={(type) => set("houseProperty", { type })}
                options={[
                  { value: "none", label: "No house / not applicable" },
                  { value: "self", label: "I live in it", desc: "Self-occupied" },
                  { value: "letout", label: "I rent it out", desc: "Let-out" },
                ]}
              />
              {input.houseProperty.type !== "none" && (
                <Grid cols={3}>
                  {input.houseProperty.type === "letout" && (
                    <>
                      <MoneyField label="Annual rent received" value={input.houseProperty.rentReceived} onChange={(rentReceived) => set("houseProperty", { rentReceived })} />
                      <MoneyField label="Municipal / property tax paid" value={input.houseProperty.municipalTax} onChange={(municipalTax) => set("houseProperty", { municipalTax })} />
                    </>
                  )}
                  <MoneyField
                    label="Home loan interest paid"
                    value={input.houseProperty.interest}
                    onChange={(interest) => set("houseProperty", { interest })}
                    hint={input.houseProperty.type === "self" ? `Old regime: up to ${money(L.selfOccupiedInterest)}. New regime: not allowed.` : "Full interest allowed; loss set-off limited to ₹2 lakh (old regime)."}
                  />
                </Grid>
              )}
              {input.houseProperty.type === "letout" && (
                <Callout>A flat 30% of net rent is deducted for repairs automatically (sec 24(a)). Home loan principal goes under 80C in Deductions.</Callout>
              )}
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card title="Business or profession" subtitle="Shop, trading, freelancing, consulting, doctors, lawyers, etc.">
            <div className="space-y-5">
              <Choice
                value={input.business.mode}
                onChange={(mode) => set("business", { mode })}
                options={[
                  { value: "none", label: "None" },
                  { value: "44AD", label: "Small business (44AD)", desc: "Profit = 6% digital / 8% cash" },
                  { value: "44ADA", label: "Professional (44ADA)", desc: "Profit = 50% of receipts" },
                  { value: "regular", label: "Books of account", desc: "Actual profit — ITR-3" },
                ]}
              />
              {(input.business.mode === "44AD" || input.business.mode === "44ADA") && (
                <>
                  <Grid cols={3}>
                    <MoneyField label="Receipts by bank / UPI / cheque" value={input.business.receiptsDigital} onChange={(receiptsDigital) => set("business", { receiptsDigital })} />
                    <MoneyField label="Receipts in cash" value={input.business.receiptsCash} onChange={(receiptsCash) => set("business", { receiptsCash })} hint="If cash ≤ 5% of total, higher limits apply" />
                    <MoneyField label="Profit you want to declare (optional)" value={input.business.declaredProfit} onChange={(declaredProfit) => set("business", { declaredProfit })} hint="Only if your actual profit is higher" />
                  </Grid>
                  <Callout>
                    Presumptive profit: <b>{money(result.newRegime.businessIncome)}</b>. Limits —{" "}
                    {input.business.mode === "44AD"
                      ? `turnover up to ₹${rules.presumptive.sec44ADLimit / 1e7} crore (₹${rules.presumptive.sec44ADLimitDefault / 1e7} crore if cash > 5%).`
                      : `receipts up to ₹${rules.presumptive.sec44ADALimit / 1e5} lakh (₹${rules.presumptive.sec44ADALimitDefault / 1e5} lakh if cash > 5%).`}{" "}
                    No books or audit needed.
                  </Callout>
                </>
              )}
              {input.business.mode === "regular" && (
                <MoneyField label="Net profit as per Profit & Loss account" value={input.business.netProfit} onChange={(netProfit) => set("business", { netProfit })} hint="After all business expenses and depreciation" />
              )}
            </div>
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Card title="Interest, dividends & other income" subtitle="Check AIS on the e-Filing portal — banks report all of this.">
              <Grid>
                <MoneyField label="Savings account interest" value={input.otherSources.savingsInterest} onChange={(savingsInterest) => set("otherSources", { savingsInterest })} />
                <MoneyField label="FD / RD / bond interest" value={input.otherSources.fdInterest} onChange={(fdInterest) => set("otherSources", { fdInterest })} />
                <MoneyField label="Dividends" value={input.otherSources.dividends} onChange={(dividends) => set("otherSources", { dividends })} />
                <MoneyField label="Any other income" value={input.otherSources.other} onChange={(other) => set("otherSources", { other })} hint="Gifts above ₹50,000, interest on IT refund, etc." />
              </Grid>
            </Card>
            <Card title="Capital gains" subtitle="From selling shares, mutual funds, property, gold. Use your broker's / CAMS capital gains statement.">
              <Grid>
                <MoneyField label="Short-term gain — listed shares / equity MF (held ≤ 12 months)" value={input.capitalGains.stcg111A} onChange={(stcg111A) => set("capitalGains", { stcg111A })} hint={`Taxed at ${rules.capitalGains.stcg111A * 100}% (sec 111A)`} />
                <MoneyField label="Long-term gain — listed shares / equity MF (held > 12 months)" value={input.capitalGains.ltcg112A} onChange={(ltcg112A) => set("capitalGains", { ltcg112A })} hint={`First ${money(rules.capitalGains.ltcg112AExemption)} tax-free, rest at ${rules.capitalGains.ltcg112A * 100}% (sec 112A)`} />
                <MoneyField label="Short-term gain — other assets" value={input.capitalGains.stcgOther} onChange={(stcgOther) => set("capitalGains", { stcgOther })} hint="Debt funds, property < 24 months, gold — taxed at your slab rate" />
                <MoneyField label="Long-term gain — property, gold, unlisted shares" value={input.capitalGains.ltcgOther} onChange={(ltcgOther) => set("capitalGains", { ltcgOther })} hint={`Taxed at ${rules.capitalGains.ltcgOther * 100}% without indexation`} />
              </Grid>
            </Card>
          </div>
        )}

        {step === 5 && (
          <Card title="Deductions" subtitle="Most deductions only work in the old regime. We compare both regimes for you anyway.">
            <div className="space-y-5">
              <Callout>
                In the <b>new regime</b> only employer NPS (80CCD(2)) is allowed. Fill these to see if the old regime saves you more —
                currently old regime tax is <b>{money(result.oldRegime.totalTax)}</b> vs new <b>{money(result.newRegime.totalTax)}</b>.
              </Callout>
              <Grid cols={3}>
                <MoneyField label="80C — PPF, EPF, ELSS, LIC, home-loan principal, tuition fees" value={input.deductions.sec80C} max={L.sec80C} onChange={(sec80C) => set("deductions", { sec80C })} hint={`Max ${money(L.sec80C)}`} />
                <MoneyField label="80CCD(1B) — your own NPS" value={input.deductions.sec80CCD1B} max={L.sec80CCD1B} onChange={(sec80CCD1B) => set("deductions", { sec80CCD1B })} hint={`Max ${money(L.sec80CCD1B)}, over and above 80C`} />
                <MoneyField label="80D — health insurance (self, spouse, kids)" value={input.deductions.sec80DSelf} onChange={(sec80DSelf) => set("deductions", { sec80DSelf })} hint={`Max ${money(input.ageGroup === "below60" ? L.sec80DSelf : L.sec80DSelfSenior)}`} />
                <MoneyField label="80D — health insurance for parents" value={input.deductions.sec80DParents} onChange={(sec80DParents) => set("deductions", { sec80DParents })} hint={`Max ${money(input.deductions.parentsSenior ? L.sec80DParentsSenior : L.sec80DParents)}`} />
                <MoneyField label="80E — education loan interest" value={input.deductions.sec80E} onChange={(sec80E) => set("deductions", { sec80E })} hint="No upper limit, 8 years" />
                <MoneyField label="80G — donations (eligible amount)" value={input.deductions.sec80G} onChange={(sec80G) => set("deductions", { sec80G })} hint="Enter 50% or 100% of donation as per receipt" />
                <MoneyField label="Any other deduction" value={input.deductions.other} onChange={(other) => set("deductions", { other })} hint="80DD, 80U, 80GG, 80EEB…" />
              </Grid>
              <Toggle label="My parents are senior citizens (60+)" checked={input.deductions.parentsSenior} onChange={(parentsSenior) => set("deductions", { parentsSenior })} />
              <Hint>
                Savings interest deduction (80TTA up to ₹10,000, or 80TTB up to ₹50,000 for seniors) is applied automatically from what you entered under Other income.
              </Hint>
            </div>
          </Card>
        )}

        {step === 6 && (
          <Card title="Taxes already paid & filing date" subtitle="Match each figure with Form 26AS / AIS before filing.">
            <div className="space-y-5">
              <Grid cols={3}>
                <MoneyField label="TDS by employer" value={input.taxesPaid.tdsSalary} onChange={(tdsSalary) => set("taxesPaid", { tdsSalary })} hint="Form 16 Part A" />
                <MoneyField label="TDS by banks / others" value={input.taxesPaid.tdsOther} onChange={(tdsOther) => set("taxesPaid", { tdsOther })} hint="Form 16A / 26AS" />
                <MoneyField label="TCS" value={input.taxesPaid.tcs} onChange={(tcs) => set("taxesPaid", { tcs })} hint="e.g. on foreign remittance, car purchase" />
                <MoneyField label="Advance tax paid" value={input.taxesPaid.advanceTax} onChange={(advanceTax) => set("taxesPaid", { advanceTax })} />
                <MoneyField label="Self-assessment tax paid" value={input.taxesPaid.selfAssessment} onChange={(selfAssessment) => set("taxesPaid", { selfAssessment })} />
              </Grid>
              <Grid>
                <TextField type="date" label="Due date for your return" value={input.filing.dueDate} onChange={(dueDate) => set("filing", { dueDate })} hint="31 July for most individuals; 31 October if your accounts are audited. Check for any CBDT extension." />
                <TextField type="date" label="Date you will file" value={input.filing.filingDate} onChange={(filingDate) => set("filing", { filingDate })} hint="Used to work out late fee and interest" />
              </Grid>
            </div>
          </Card>
        )}

        {step === 7 && <ItrResultView input={input} result={result} guide={guide} />}

        <StepNav step={step} setStep={setStep} last={STEPS.length - 1} />
      </div>

      <aside className="no-print lg:sticky lg:top-20 lg:self-start">
        <LiveSummary result={result} />
      </aside>
    </div>
  );
}

function LiveSummary({ result }: { result: ReturnType<typeof computeItr> }) {
  const best = result.recommended === "new" ? result.newRegime : result.oldRegime;
  return (
    <Card title="Live estimate">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <RegimeTile r={result.newRegime} best={result.recommended === "new"} />
          <RegimeTile r={result.oldRegime} best={result.recommended === "old"} />
        </div>
        {result.saving > 0 && (
          <Callout tone="good">
            <b>{result.recommended === "new" ? "New" : "Old"} regime</b> saves you <b>{money(result.saving)}</b>.
          </Callout>
        )}
        <Stat
          label={best.netPayable >= 0 ? "You need to pay" : "Refund you get"}
          value={money(Math.abs(best.netPayable))}
          tone={best.netPayable > 0 ? "bad" : "good"}
          sub="after TDS, advance tax, interest & fee"
        />
        <Stat label="ITR form" value={result.itrForm.form} tone="brand" />
      </div>
    </Card>
  );
}

function RegimeTile({ r, best }: { r: RegimeResult; best: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${best ? "bg-indigo-50 ring-2 ring-indigo-200" : "bg-slate-50"}`}>
      <div className="text-xs font-medium text-slate-500">{r.regime === "new" ? "New regime" : "Old regime"}</div>
      <div className="text-lg font-semibold tabular-nums">{money(r.totalTax)}</div>
      <div className="text-xs text-slate-500">on {money(r.totalIncome)}</div>
    </div>
  );
}

function Sheet({ r }: { r: RegimeResult }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {r.lines.map((l, i) => (
          <tr key={i} className={l.strong ? "border-t border-slate-100 font-medium" : "text-slate-600"}>
            <td className={`py-1.5 ${l.indent ? "pl-4" : ""}`}>
              {l.label}
              {l.note && <div className="text-xs font-normal text-amber-700">{l.note}</div>}
            </td>
            <td className="py-1.5 text-right tabular-nums">{l.amount < 0 ? `(${money(-l.amount)})` : money(l.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ItrResultView({ input, result, guide }: { input: ItrInput; result: ReturnType<typeof computeItr>; guide: ReturnType<typeof buildItrGuide> }) {
  const [view, setView] = useState<"new" | "old">(result.recommended);
  const best = result.recommended === "new" ? result.newRegime : result.oldRegime;
  return (
    <div className="space-y-4">
      <Card
        title={`Your result — ${result.rules.ay}`}
        actions={
          <div className="no-print flex gap-2">
            <Button onClick={() => window.print()}>Print / PDF</Button>
            <Button onClick={() => download(`itr-${input.fy}.json`, JSON.stringify({ input, result }, null, 2), "application/json")}>Download JSON</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Best regime" value={result.recommended === "new" ? "New" : "Old"} tone="brand" sub={result.saving ? `saves ${money(result.saving)}` : "same tax"} />
          <Stat label="Total tax" value={money(best.totalTax)} />
          <Stat label={best.netPayable >= 0 ? "Pay now" : "Refund"} value={money(Math.abs(best.netPayable))} tone={best.netPayable > 0 ? "bad" : "good"} />
          <Stat label="File using" value={result.itrForm.form} tone="brand" />
        </div>
        <p className="mt-4 text-sm text-slate-600">{result.itrForm.reasons.join(" ")}</p>
      </Card>

      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w) => (
            <Callout key={w} tone="warn">{w}</Callout>
          ))}
        </div>
      )}

      <Card
        title="Computation of income & tax"
        actions={
          <div className="no-print flex rounded-lg bg-slate-100 p-1 text-sm">
            {(["new", "old"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 ${view === v ? "bg-white shadow-sm" : "text-slate-500"}`}>
                {v === "new" ? "New regime" : "Old regime"}
                {result.recommended === v && " ★"}
              </button>
            ))}
          </div>
        }
      >
        <Sheet r={view === "new" ? result.newRegime : result.oldRegime} />
      </Card>

      <Card title="What to fill where on the e-Filing portal" subtitle={`Values for the ${result.recommended} regime. Blank/zero rows can be skipped.`}>
        <div className="space-y-6">
          {guide.map((g) => (
            <div key={g.title}>
              <h3 className="font-semibold text-slate-900">{g.title}</h3>
              <p className="text-xs text-indigo-700">{g.where}</p>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {g.rows.map((row) => (
                    <tr key={row.field} className={`border-t border-slate-100 ${row.value === 0 ? "text-slate-400" : ""}`}>
                      <td className="py-1.5 pr-2">
                        {row.field}
                        {row.hint && <div className="text-xs text-slate-500">{row.hint}</div>}
                      </td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{typeof row.value === "number" ? money(row.value) : row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Rules used">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {result.rules.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
