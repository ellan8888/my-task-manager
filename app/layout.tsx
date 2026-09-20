import type { Metadata } from "next";
import "./globals.css";
import LoadingScreen from "@/components/LoadingScreen";
import { ToastProvider } from "./components/ToastProvider";
import ThemeScript from "./ThemeScript";

export const metadata: Metadata = {
  title: "My Task Manager",
  description: "Personal task manager and reminder",
  applicationName: "My Task Manager",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Font Awesome — load di semua halaman */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />

        {/* ★ Theme init — pake component terpisah */}
        <ThemeScript />
      </head>
      <body>
        <LoadingScreen duration={2000} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}