import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next*/**",
    "coverage/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "src/generated/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/infrastructure/**"],
              message:
                "跨模块不得直接依赖基础设施实现；请通过模块公开 API 或应用层端口协作。",
            },
          ],
        },
      ],
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
              group: [
                "@/app/**",
                "@/modules/*/infrastructure/**",
                "@/modules/*/ui/**",
              ],
              message: "应用层不得依赖传输或 UI 层。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/ui/**/*.{ts,tsx}", "src/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/shared/database/**", "@/modules/*/infrastructure/**"],
              message: "客户端 UI 不得导入数据库或服务端基础设施。",
            },
          ],
        },
      ],
    },
  },
]);
