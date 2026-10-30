# Kar Saathi: GST and Income Tax Return calculator (India)

A Next.js app that walks you through your **Income Tax Return** and **GST return** step by step. It calculates the tax and shows you which box on the government portal each number goes in.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

## What it does

**Income tax (`/itr`)**: FY 2025-26 (AY 2026-27) and FY 2026-27
- Covers salary, HRA, house property, 44AD/44ADA or books of account, capital gains (111A, 112A, 112) and other sources
- Computes tax under both regimes and recommends the cheaper one
- Applies the 87A rebate with marginal relief, surcharge with marginal relief, and cess
- Lets residents use any unused basic exemption against capital gains
- Computes interest u/s 234A and 234B and the late fee u/s 234F
- Picks your ITR form (1, 2, 3 or 4) and explains why
- Gives a schedule-by-schedule guide to what to fill on incometax.gov.in

**GST (`/gst`)**: GSTR-3B, GSTR-1 summary, CMP-08
- Uses GST 2.0 rates (5/18/40%) plus the legacy rates
- Decides CGST+SGST or IGST from the place of supply, and uses UTGST for UTs
- Handles B2B, B2C, exports and SEZ (with or without LUT), nil-rated, exempt, non-GST and credit notes
- Handles reverse charge, imports, ISD, blocked credit u/s 17(5), and reversals under 4B(1), 4B(2), 4D
- Sets off ITC in the order required by Sec 49 and Rule 88A, which gives Table 6.1
- Computes interest at 18% and the late fee, capped by turnover
- Imports sales and purchases from CSV, and purchases from the **GSTR-2B JSON** downloaded from the portal
- Validates GSTIN check digits

## Where the rates come from

Neither the Income Tax Department nor GSTN publishes tax rules as an API. All rates live in
`src/lib/rules/income-tax.ts` and `src/lib/rules/gst.ts`. Each value comes from the Finance Act or a notification, has a source link and a `lastVerified` date, and is shown on `/rules`.
**When a Budget or GST Council meeting changes a rate, edit those files.** The calculation code (`src/lib/calc/`) reads every value from them.

## Not covered (yet)
- Interest u/s 234C, which depends on instalment dates (the e-filing utility calculates it)
- Indexation option for property bought before 23 Jul 2024
- Losses carried forward from earlier years, clubbing of income, AMT, foreign tax credit
- GSTR-9 annual return

All data stays in the browser (localStorage). This app does not file returns.
