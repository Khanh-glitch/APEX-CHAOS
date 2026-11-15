import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEX CHAOS — TOTAL EVOLUTION",
  description:
    "APEX CHAOS: Total Evolution — High-intensity tactical arena combat in the Scrap Basin. 10 Gold fighters, 5 living interactive arenas, Aegis Clash Parries, Hero Overdrive Ultimates, 34+ Arsenal weapons, and real-time WebGL2 shaders.",
  icons: {
    icon: "/gold/assets/gold/favicon-r72-owner.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080b0e",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-[#080b0e]">
      <body className="m-0 h-dvh w-screen overflow-hidden bg-[#080b0e] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
