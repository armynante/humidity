import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import { plugin } from "bun";
export default [
    {
        files: ["**/*.{js,mjs,cjs,ts}"]
    },
    {
        languageOptions: { globals: globals.browser }
    },
    {
        extends: [
            "eslint:recommended",
            "plugin:prettier/recommended"
        ],
        plugins: ["prettier"],
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended, {
        rules: {
            "no-undef": "error",
            "semi": ["error", "always"],
        }
    }
];
