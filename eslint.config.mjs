import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",

      // ✅ generado
      "app/generated/**",
      "**/generated/**",

      // ✅ scripts sueltos (Node)
      "debugSqlite.js",
      "prisma/seed.js",
    ],
  },

  // Plan C: no bloquear por any (ya lo resolviste, pero lo puedes dejar)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Opcional: en d.ts suele haber cosas raras
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
