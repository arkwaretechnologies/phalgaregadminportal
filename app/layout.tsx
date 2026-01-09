import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phalga Online Registration Admin",
  description: "Admin dashboard for registration management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen h-full overflow-x-hidden bg-gray-50 text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}


