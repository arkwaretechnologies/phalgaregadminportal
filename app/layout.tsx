import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phalga Online Registration Admin",
  description: "Admin dashboard for registration management",
  icons: {
    icon: "/left.png",
    shortcut: "/left.png",
    apple: "/left.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" style={{ colorScheme: 'light' }}>
      <body className="min-h-screen h-full overflow-x-hidden bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
