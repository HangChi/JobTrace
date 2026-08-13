import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "coverage/**", "dist/**", "src/generated/**"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**",
                "@/modules/*/application/**",
                "@/modules/*/infrastructure/**",
                "@/modules/*/ui/**",
              ],
              message: "领域层只能依赖自身领域与 shared 纯工具。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**", "@/modules/*/ui/**"],
              message: "应用层不得依赖传输或 UI 层。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/shared/database/supabase.admin.server.ts",
      "src/modules/identity-access/infrastructure/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/shared/database/supabase.admin.server"],
              message:
                "Service-role 客户端仅允许 identity-access 基础设施使用。",
            },
          ],
        },
      ],
    },
  },
]);
