const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n: number) => `₹${inr.format(Math.round(n || 0))}`;
export const money2 = (n: number) => `₹${inr2.format(n || 0)}`;
export const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

// Sec 288A: total income rounded to nearest ₹10. Sec 288B: tax rounded to nearest ₹10.
export const roundTo10 = (n: number) => Math.round(n / 10) * 10;

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const clamp0 = (n: number) => (n > 0 ? n : 0);
export const r2 = (n: number) => Math.round(n * 100) / 100;

// Months (or part thereof) between two dates — the counting used for
// interest u/s 234A/234B and GST late-fee days.
export const monthsOrPart = (from: Date, to: Date) => {
  if (to <= from) return 0;
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() >= from.getDate()) m += 1;
  return Math.max(m, 0);
};

export const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));

export const todayISO = () => new Date().toISOString().slice(0, 10);
