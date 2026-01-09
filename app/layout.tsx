import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phalga Online Registration Admin",
  description: "Admin dashboard for registration management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


