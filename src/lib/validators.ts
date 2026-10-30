import { stateByCode } from "./rules/gst";

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// GSTIN check digit: weighted mod-36 over the first 14 characters.
export function gstinCheckDigit(first14: string) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function validateGstin(gstin: string) {
  const g = gstin.trim().toUpperCase();
  if (!g) return { ok: false, message: "", stateCode: "", pan: "" };
  if (!GSTIN_RE.test(g))
    return { ok: false, message: "GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5", stateCode: "", pan: "" };
  const state = stateByCode(g.slice(0, 2));
  if (!state) return { ok: false, message: `Unknown state code ${g.slice(0, 2)}`, stateCode: "", pan: "" };
  const expected = gstinCheckDigit(g.slice(0, 14));
  if (expected !== g[14])
    return { ok: false, message: `Check digit mismatch — last character should be ${expected}`, stateCode: "", pan: "" };
  return { ok: true, message: `Valid — ${state.name}, PAN ${g.slice(2, 12)}`, stateCode: state.code, pan: g.slice(2, 12) };
}
