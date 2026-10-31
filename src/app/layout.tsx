import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘 뭐 먹지, 아가? — 맞춤 유아식·간식 아이디어",
  description: "12~48개월 아기의 월령·간 단계·알레르기에 맞춘 안심 유아식과 간식 레시피 추천 웹앱",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "오늘 뭐 먹지, 아가?",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[var(--color-canvas)] text-[var(--color-text)]">
        <a href="#main-content" className="skip-link">
          본문 바로가기
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
