import type { Metadata } from "next";
import ItrWizard from "@/components/itr/ItrWizard";

export const metadata: Metadata = { title: "Income Tax Return calculator — Kar Saathi" };

export default function ItrPage() {
  return <ItrWizard />;
}
