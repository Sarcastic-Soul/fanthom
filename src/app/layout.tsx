import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter_Tight, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Fanthom", template: "%s · Fanthom" },
  description:
    "A rebuild of fathom.video, the AI meeting notetaker: transcripts, summaries, action items and clips for long calls.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${interTight.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
