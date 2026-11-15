import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], weight: ["500", "600"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://rcm-doctor.vercel.app"),
  title: "rcm-doctor — AI review for Risk & Control Matrices",
  description:
    "Open-source reviewer for Risk & Control Matrices (internal controls / IKS). Six design attributes, six consistency rules, an automation score and a rewrite per control — every finding cites the exact source text.",
  openGraph: {
    title: "rcm-doctor — AI review for Risk & Control Matrices",
    description: "Every finding cites the exact source text. Evaluated against ground truth. Try the demo, no key needed.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
