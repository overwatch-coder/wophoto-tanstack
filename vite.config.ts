import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

function prismaClientBrowserPlugin(): Plugin {
  return {
    name: "prisma-client-browser",
    enforce: "pre",
    resolveId(id, importer, options) {
      if (!options?.ssr && (id === "@/generated/prisma/client" || id.endsWith("/generated/prisma/client") || id.endsWith("/generated/prisma/client.ts"))) {
        return path.resolve(import.meta.dirname, "./src/lib/prisma-browser.ts");
      }
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  plugins: [
    prismaClientBrowserPlugin(),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: ["@auth/core", "@auth/prisma-adapter"],
  },
});
