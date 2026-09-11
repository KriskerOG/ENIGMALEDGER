import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENIGMA Verse Index",
  description: "Unofficial Star Citizen lookup, trade, and logistics index for ENIGMA.",
  icons: {
    icon: "/enigma-icon.png",
    apple: "/enigma-icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
