import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soul of Hero — Map Lab Studio",
  description: "Công cụ thiết kế thế giới Soul of Hero: địa hình, thủy lưu, giao thông, POI, vùng xây và sáu Elder.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, background: "#0d1520", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
