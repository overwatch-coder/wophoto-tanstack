import { Generator, getConfig } from "@tanstack/router-generator";

async function main() {
  const config = await getConfig({
    routesDirectory: "./src/routes",
    generatedRouteTree: "./src/routeTree.gen.ts",
    routeTreeFileHeader: ["/* eslint-disable */", "// @ts-nocheck"],
  });
  const gen = new Generator({ config, root: process.cwd() });
  await gen.run();
  console.log("TanStack Router route tree generated.");
}

main().catch((err) => {
  console.error("Failed to generate route tree:", err);
  process.exit(1);
});

