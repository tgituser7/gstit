import type { Metadata } from "next";
import GstWizard from "@/components/gst/GstWizard";

export const metadata: Metadata = { title: "GST return calculator — Kar Saathi" };

export default function GstPage() {
  return <GstWizard />;
}
