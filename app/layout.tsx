import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import LoadingScreen from "@/components/LoadingScreen";

export const metadata: Metadata = {
  title: "My Task Manager",
  description: "Personal task manager and reminder",
  applicationName: "My Task Manager",
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

        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var theme = localStorage.getItem("theme");
              var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              var dark = theme ? theme === "dark" : prefersDark;
              if (dark) {
                document.documentElement.classList.add("dark");
              } else {
                document.documentElement.classList.remove("dark");
              }
            } catch (e) {}
          `}
        </Script>
      </head>
      <body>
        <LoadingScreen duration={2000} />
        {children}
      </body>
    </html>
  );
}