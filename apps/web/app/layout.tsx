import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Riskline",
  description: "See what can break in a diff before you merge.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
