// GST rules. As with income tax, CBIC/GSTN do not expose these as an API, so
// they are transcribed from the notifications in GST_SOURCES.

export const GST_RULES_LAST_VERIFIED = "2026-10-30";

// GST 2.0 (56th GST Council, effective 22 Sep 2025): main slabs are 5%, 18% and
// 40%. 12% and 28% are kept for periods/invoices before that date and for the
// few items still notified at those rates.
export const GST_RATES = [
  { rate: 0, label: "0% (nil-rated)" },
  { rate: 0.25, label: "0.25% (rough diamonds)" },
  { rate: 3, label: "3% (gold, silver, jewellery)" },
  { rate: 5, label: "5% (merit rate)" },
  { rate: 12, label: "12% (pre-22 Sep 2025 / legacy)" },
  { rate: 18, label: "18% (standard rate)" },
  { rate: 28, label: "28% (pre-22 Sep 2025 / legacy)" },
  { rate: 40, label: "40% (luxury & sin goods)" },
];

export const COMPOSITION_RATES = [
  { key: "trader", rate: 1, label: "Trader / manufacturer — 1%" },
  { key: "restaurant", rate: 5, label: "Restaurant (no alcohol) — 5%" },
  { key: "service", rate: 6, label: "Service provider (sec 10(2A)) — 6%" },
];

export type GstState = { code: string; name: string; ut?: boolean; qrmp22?: boolean };

// `ut` = Union Territory without legislature → UTGST instead of SGST.
// `qrmp22` = QRMP GSTR-3B due on the 22nd (others: 24th).
export const GST_STATES: GstState[] = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh", ut: true },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh", qrmp22: true },
  { code: "23", name: "Madhya Pradesh", qrmp22: true },
  { code: "24", name: "Gujarat", qrmp22: true },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu", ut: true, qrmp22: true },
  { code: "27", name: "Maharashtra", qrmp22: true },
  { code: "29", name: "Karnataka", qrmp22: true },
  { code: "30", name: "Goa", qrmp22: true },
  { code: "31", name: "Lakshadweep", ut: true, qrmp22: true },
  { code: "32", name: "Kerala", qrmp22: true },
  { code: "33", name: "Tamil Nadu", qrmp22: true },
  { code: "34", name: "Puducherry", qrmp22: true },
  { code: "35", name: "Andaman & Nicobar Islands", ut: true, qrmp22: true },
  { code: "36", name: "Telangana", qrmp22: true },
  { code: "37", name: "Andhra Pradesh", qrmp22: true },
  { code: "38", name: "Ladakh", ut: true },
  { code: "97", name: "Other Territory" },
];

export const stateByCode = (code: string) => GST_STATES.find((s) => s.code === code);

export const GST_INTEREST_RATE = 0.18; // sec 50(1), on the net cash liability

// Late fee per day for GSTR-3B / GSTR-1 (CGST + SGST combined), with caps by
// aggregate annual turnover (Notification 19/2021 and 20/2021-CT).
export const LATE_FEE = {
  perDay: 50,
  perDayNil: 20,
  capNil: 500,
  caps: [
    { upTo: 15000000, cap: 2000 },
    { upTo: 50000000, cap: 5000 },
    { upTo: null as number | null, cap: 10000 },
  ],
};

export const B2CL_INVOICE_THRESHOLD = 100000; // inter-state B2C invoices above ₹1 lakh go to GSTR-1 Table 5

export const GST_NOTES = [
  "From the January 2026 tax period, the GST portal blocks GSTR-3B if ITC claimed is more than what GSTR-2B shows as eligible. Match your purchase register with GSTR-2B before filing.",
  "Auto-populated liability in GSTR-3B (from GSTR-1/IFF) is locked; correct mistakes through the next GSTR-1 amendment.",
  "IGST credit must be fully used before CGST/SGST credit (Rule 88A). CGST credit can never pay SGST and vice versa.",
  "Tax on reverse charge (RCM) must always be paid in cash; its credit is available in the same return.",
  "A GST return cannot be filed once 3 years have passed from its due date, so clear old pending returns first.",
];

export const GST_SOURCES = [
  { title: "CBIC — GST rate notifications", url: "https://cbic-gst.gov.in/gst-goods-services-rates.html" },
  { title: "GST Council — meeting decisions", url: "https://gstcouncil.gov.in/" },
  { title: "GST portal — returns & tutorials", url: "https://tutorial.gst.gov.in/userguide/returns/index.htm" },
  { title: "GST portal (file returns)", url: "https://www.gst.gov.in/" },
];
