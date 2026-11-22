"use client";
// Cadangan terakhir kalau root layout sendiri gagal — harus punya <html>/<body> sendiri.
import "./globals.css";
import ErrorView from "./components/ErrorView";

export default function GlobalError({ error, reset, retry }: { error: unknown; reset?: () => void; retry?: () => void }) {
  return (
    <html lang="id">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossOrigin="anonymous" referrerPolicy="no-referrer" />
      </head>
      <body>
        <ErrorView kind="error" error={error} onRetry={retry ?? reset} />
      </body>
    </html>
  );
}
