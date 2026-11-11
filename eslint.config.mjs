import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: [
      "dist/**",
      ".output/**",
      "src/routeTree.gen.ts",
      "out/**",
      "build/**",
      "spy-doc/**",
      "generated/**",
      "**/prototypes/**",
    ],
  }
);
