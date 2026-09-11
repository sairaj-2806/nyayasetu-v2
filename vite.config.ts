import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// NyayaSetu - Fullstack SSR Vite Configuration
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    define: {
      "process.env.SUPABASE_URL": JSON.stringify(
        env["SUPABASE_URL"] || "https://keqlhaerxaliqljyibzx.supabase.co",
      ),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env["SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_FZvKCCOsCUtbS9qP7v2XAw_xblsYT8d",
      ),
      "process.env.DEMO_MODE": JSON.stringify(env["DEMO_MODE"] || env["VITE_DEMO_MODE"] || "false"),
      "process.env.VITE_DEMO_MODE": JSON.stringify(
        env["VITE_DEMO_MODE"] || env["DEMO_MODE"] || "false",
      ),
      "import.meta.env.DEMO_MODE": JSON.stringify(
        env["DEMO_MODE"] || env["VITE_DEMO_MODE"] || "false",
      ),
      "import.meta.env.VITE_DEMO_MODE": JSON.stringify(
        env["VITE_DEMO_MODE"] || env["DEMO_MODE"] || "false",
      ),
    },
    server: {
      watch: {
        ignored: ["**/dist-electron/**", "**/.output/**", "**/dist/**"],
      },
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
      }),
      react(),
      nitro({
        preset: "cloudflare-module",
      }),
    ],
  };
});
