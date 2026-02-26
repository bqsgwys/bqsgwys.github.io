import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "音韵标注器",
};

export default function rhymeLayout({ children }: { children: ReactNode }) {
  return children;
}
