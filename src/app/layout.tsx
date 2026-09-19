import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Company Tasks", description: "Your team's internal task platform", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
