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

function serverActionsPlugin(): Plugin {
  return {
    name: "server-actions-client-stub",
    enforce: "pre",
    transform(code, id, options) {
      if (!options?.ssr && id.includes("/app/actions/") && (id.endsWith(".ts") || id.endsWith(".js"))) {
        const fileKey = path.basename(id, path.extname(id));
        const fnNames = new Set<string>();

        const fnRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g;
        let match;
        while ((match = fnRegex.exec(code)) !== null) {
          fnNames.add(match[1]);
        }

        const constRegex = /export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g;
        while ((match = constRegex.exec(code)) !== null) {
          fnNames.add(match[1]);
        }

        const stubs = Array.from(fnNames)
          .map((fn) => `export const ${fn} = (...args) => callServerAction("${fileKey}", "${fn}", args);`)
          .join("\n");

        return {
          code: `import { callServerAction } from "@/src/lib/action-client";\n${stubs}\n`,
          map: null,
        };
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
    serverActionsPlugin(),
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
