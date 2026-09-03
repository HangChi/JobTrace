import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import prettier from "prettier";
import { DEFAULT_SOURCE_CATALOG } from "../src/modules/job-market/application/default-source-catalog";
import { DEFAULT_COMPANY_DIRECTORY } from "../src/modules/job-market/application/default-company-directory";

type DirectoryRow = {
  companyName: string;
  companyType: string;
  industry: string;
  channel: "automatic" | "official_site" | "wechat";
  channelLabel: string;
  url: string;
};

const companyDocumentPath = "docs/company-directory.md";
const architecturePath = "docs/architecture.md";

function markdownCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(rows: DirectoryRow[]) {
  return [
    "| 公司 | 类型 | 行业 | 渠道 | 链接 |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${markdownCell(row.companyName)} | ${markdownCell(row.companyType || "—")} | ${markdownCell(row.industry || "—")} | ${markdownCell(row.channelLabel)} | <${row.url}> |`,
    ),
  ].join("\n");
}

function byCompany(rows: DirectoryRow[]) {
  return [...new Map(rows.map((row) => [row.companyName, row])).values()].sort(
    (left, right) => left.companyName.localeCompare(right.companyName, "zh-CN"),
  );
}

async function renderCompanyDocument() {
  const automatic = byCompany(
    DEFAULT_SOURCE_CATALOG.map((entry) => ({
      companyName: entry.companyName,
      companyType: entry.companyType,
      industry: entry.industry,
      channel: "automatic" as const,
      channelLabel: "自动同步",
      url: entry.websiteUrl,
    })),
  );
  const directory = byCompany(
    DEFAULT_COMPANY_DIRECTORY.map((entry) => ({
      companyName: entry.companyName,
      companyType: entry.companyType,
      industry: entry.industry,
      channel: entry.channel,
      channelLabel: entry.channel === "official_site" ? "官网" : "公众号",
      url: entry.entryUrl,
    })),
  );
  const official = directory.filter(
    (entry) => entry.channel === "official_site",
  );
  const wechat = directory.filter((entry) => entry.channel === "wechat");
  const total = automatic.length + directory.length;
  const source = `# 公司招聘入口总览

> 本文档由 \`pnpm directory:generate\` 根据 \`DEFAULT_SOURCE_CATALOG\` 与 \`DEFAULT_COMPANY_DIRECTORY\` 自动生成，请勿手工编辑。公司别名由 \`company-directory-aliases.json\` 统一归并。共计 **${total}** 家公司（自动同步 ${automatic.length} · 官网入口 ${official.length} · 公众号 ${wechat.length}）。

## 自动同步公司（${automatic.length} 家）

岗位由公开招聘来源自动同步。

${table(automatic)}

## 官网入口公司（${official.length} 家）

暂无公开岗位接口，链接直达官方招聘官网。

${table(official)}

## 公众号发布公司（${wechat.length} 家）

以微信公众号招聘推文为准。

${table(wechat)}
`;
  return prettier.format(source, { parser: "markdown" });
}

async function renderArchitecture() {
  const source = await readFile(architecturePath, "utf8");
  const automaticCompanies = new Set(
    DEFAULT_SOURCE_CATALOG.map((entry) => entry.companyName),
  ).size;
  const summary = `当前包含 ${automaticCompanies} 家可自动同步企业、${DEFAULT_SOURCE_CATALOG.length} 个来源`;
  const output = source.replace(
    /(?:截至 \d{4}-\d{2}-\d{2} |当前)包含 \d+ 家可自动同步企业、\d+ 个来源/,
    summary,
  );
  if (!output.includes(summary))
    throw new Error(`${architecturePath} 缺少可更新的目录统计标记。`);
  return output;
}

async function main() {
  const outputs = [
    [companyDocumentPath, await renderCompanyDocument()],
    [architecturePath, await renderArchitecture()],
  ] as const;
  if (process.argv.includes("--check")) {
    const stale: string[] = [];
    for (const [file, expected] of outputs)
      if ((await readFile(file, "utf8")) !== expected) stale.push(file);
    if (stale.length) {
      console.error(
        `目录生成产物已漂移：${stale.join(", ")}。请运行 pnpm directory:generate。`,
      );
      process.exitCode = 1;
    }
    return;
  }
  await Promise.all(outputs.map(([file, value]) => writeFile(file, value)));
}

await main();
