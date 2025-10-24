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
      ".next/**",
      "node_modules/**",
      "out/**",
      "coverage/**",
      "*.config.js",
      "jest.setup.js",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Disable img element warning - we use regular img tags for dynamic user content
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;

