"use client";

export default function ThemeScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `
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
        `,
      }}
    />
  );
}