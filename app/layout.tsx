import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZEV Admin Portal | مدیریت کاربران اپلیکیشن زو",
  description: "Official Admin Dashboard for ZEV App - User verification, blue badge, moderation and account management",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className="h-full bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-[#080b11] text-slate-100 font-sans" style={{ fontFamily: "Vazirmatn, 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
