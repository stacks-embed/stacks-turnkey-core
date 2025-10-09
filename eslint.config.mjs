// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Base ESLint configuration
  js.configs.recommended,
  // TypeScript configuration
  ...tseslint.configs.recommended,
  // React configuration
  {
    plugins: {
      react: pluginReact,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  // Global browser variables
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  // Shared rules for all files
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    rules: {
      quotes: ["error", "double"], // Use base ESLint "quotes" rule
      semi: ["error", "always"], // Use base ESLint "semi" rule
      "@typescript-eslint/no-unused-vars": "warn", // TS-specific rule
    },
  },
]);
