import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["**/dist/**", "**/node_modules/**"] },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ["packages/frontend/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },
]);
