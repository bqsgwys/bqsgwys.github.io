import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import MatrixEditor from "@/components/matrix-editor";
import type { FontFamily } from "@/lib/fonts";

type FontManifest = {
  fontFiles: string[];
  fontFamilies: FontFamily[];
};

export const metadata: Metadata = {
  title: "Dot Matrix",
  description: "BDF dot-matrix display composer.",
};

export default function MatrixPage() {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "generated", "font-catalog.json"), "utf8"),
  ) as FontManifest;

  return <MatrixEditor fontFiles={manifest.fontFiles} fontFamilies={manifest.fontFamilies} />;
}
