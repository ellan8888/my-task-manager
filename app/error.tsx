"use client";
import ErrorView from "./components/ErrorView";

export default function Error({ error, reset, retry }: { error: unknown; reset?: () => void; retry?: () => void }) {
  return <ErrorView kind="error" error={error} onRetry={retry ?? reset} />;
}
