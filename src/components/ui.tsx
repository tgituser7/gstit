"use client";

import { useEffect, useState, type ReactNode } from "react";
import { money } from "@/lib/format";

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, loaded]);
  return [value, setValue, loaded] as const;
}

export function Card({ title, subtitle, children, className = "", actions }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>;
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn" | "good"; children: ReactNode }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

const compactInr = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${+(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${+(n / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `₹${+(n / 1e3).toFixed(1)} K`;
  return money(n);
};

export function MoneyField({ label, value, onChange, hint, max, disabled }: { label: string; value: number; onChange: (n: number) => void; hint?: ReactNode; max?: number; disabled?: boolean }) {
  const [text, setText] = useState(value ? String(value) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value ? String(value) : "");
  }, [value, focused]);
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className={`mt-1 flex items-center rounded-lg border bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 ${disabled ? "border-slate-100 bg-slate-50" : "border-slate-300"}`}>
        <span className="pl-3 text-slate-400">₹</span>
        <input
          className="w-full rounded-lg bg-transparent px-2 py-2 text-slate-900 outline-none disabled:text-slate-400"
          inputMode="decimal"
          placeholder="0"
          disabled={disabled}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9.]/g, "");
            setText(t);
            onChange(parseFloat(t) || 0);
          }}
        />
        {value > 0 && <span className="whitespace-nowrap pr-3 text-xs text-slate-400">{compactInr(value)}</span>}
      </div>
      {max !== undefined && value > max && <Hint>Only {money(max)} is allowed — the rest is ignored.</Hint>}
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function NumberField({ label, value, onChange, hint, suffix }: { label: string; value: number; onChange: (n: number) => void; hint?: ReactNode; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-indigo-500">
        <input
          type="number"
          className="w-full rounded-lg bg-transparent px-3 py-2 outline-none"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {suffix && <span className="pr-3 text-sm text-slate-400">{suffix}</span>}
      </div>
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function TextField({ label, value, onChange, hint, placeholder, upper, type = "text", status }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; placeholder?: string; upper?: boolean; type?: string; status?: { ok: boolean; message: string } }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
      />
      {status?.message && <p className={`mt-1 text-xs ${status.ok ? "text-emerald-600" : "text-rose-600"}`}>{status.message}</p>}
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, hint }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function Choice<T extends string>({ label, value, onChange, options }: { label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; desc?: string }[] }) {
  return (
    <div>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border p-3 text-left transition ${value === o.value ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <div className="text-sm font-semibold text-slate-900">{o.label}</div>
            {o.desc && <div className="mt-0.5 text-xs text-slate-500">{o.desc}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm text-slate-800">{label}</span>
        {hint && <Hint>{hint}</Hint>}
      </span>
    </label>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={`grid gap-4 ${c}`}>{children}</div>;
}

export function Stepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect: (i: number) => void }) {
  return (
    <nav className="no-print -mx-1 flex gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <button
          key={s}
          onClick={() => onSelect(i)}
          className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${i === current ? "bg-indigo-600 text-white" : i < current ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
        >
          <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${i === current ? "bg-white/20" : "bg-slate-100"}`}>{i + 1}</span>
          {s}
        </button>
      ))}
    </nav>
  );
}

export function StepNav({ step, setStep, last }: { step: number; setStep: (n: number) => void; last: number }) {
  return (
    <div className="no-print mt-6 flex justify-between">
      <button disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40">
        ← Back
      </button>
      {step < last && (
        <button onClick={() => setStep(step + 1)} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {step === last - 1 ? "See result →" : "Next →"}
        </button>
      )}
    </div>
  );
}

export function Stat({ label, value, tone = "default", sub }: { label: string; value: ReactNode; tone?: "default" | "good" | "bad" | "brand"; sub?: ReactNode }) {
  const color = { default: "text-slate-900", good: "text-emerald-600", bad: "text-rose-600", brand: "text-indigo-600" }[tone];
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "secondary" }: { children: ReactNode; onClick: () => void; variant?: "primary" | "secondary" | "danger" }) {
  const v = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
    danger: "bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50",
  }[variant];
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${v}`}>
      {children}
    </button>
  );
}
