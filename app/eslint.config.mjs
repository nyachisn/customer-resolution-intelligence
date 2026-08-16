// Minimal flat config for ESLint 9. FlatCompat's next/core-web-vitals
// wrapper crashes on this dependency tree (circular structure in the react
// plugin's config object, surfaced while eslint-config-next's own error
// formatter tries to report an unrelated validation issue). Rather than
// chase that upstream compat bug, this uses @next/eslint-plugin-next and
// typescript-eslint directly — the two checks that actually matter for a
// Next.js + TypeScript app — and skips the legacy-compat wrapper entirely.
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "src/data/**"] },
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  }
);
