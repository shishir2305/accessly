import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Accessly — Accessibility, with evidence",
  description:
    "Assess web experiences, understand barriers, and preserve trustworthy accessibility evidence.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
