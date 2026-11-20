import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

// Nomor versi build — dipakai VersionWatcher untuk tahu ada versi baru (halaman yang terbuka lama memuat ulang)
const BUILD_ID = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 12) || String(Date.now());

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
