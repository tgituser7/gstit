import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kar Saathi — GST & Income Tax Return Calculator",
  description: "Step-by-step GST return (GSTR-3B, GSTR-1) and Income Tax Return (ITR) calculator for India, with field-by-field filing guidance.",
};

const nav = [
  { href: "/itr", label: "Income Tax (ITR)" },
  { href: "/gst", label: "GST Return" },
  { href: "/rules", label: "Rates & Sources" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">₹</span>
              <span className="font-semibold text-slate-900">Kar Saathi</span>
            </Link>
            <nav className="flex gap-1 overflow-x-auto text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="no-print mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs leading-relaxed text-slate-500">
          Kar Saathi helps you compute and understand your returns. It does not file returns for you — file on{" "}
          <a className="underline" href="https://www.incometax.gov.in" target="_blank" rel="noreferrer">incometax.gov.in</a> and{" "}
          <a className="underline" href="https://www.gst.gov.in" target="_blank" rel="noreferrer">gst.gov.in</a>. Your data stays in this browser. For complex cases, consult a Chartered Accountant.
        </footer>
      </body>
    </html>
  );
}
