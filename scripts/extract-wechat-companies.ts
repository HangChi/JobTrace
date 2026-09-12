import { writeFile, mkdir } from "node:fs/promises";
import { DEFAULT_COMPANY_DIRECTORY } from "../src/modules/job-market/application/default-company-directory";

const outputDir = "tmp/company-research";
await mkdir(outputDir, { recursive: true });

const wechatCompanies = DEFAULT_COMPANY_DIRECTORY.filter(
  (entry) => entry.channel === "wechat",
).map(({ identityKey, companyName, companyType, industry }) => ({
  identityKey,
  companyName,
  companyType,
  industry,
}));

await writeFile(
  `${outputDir}/wechat-companies.json`,
  `${JSON.stringify(wechatCompanies, null, 2)}\n`,
);

console.log(`wechat-channel companies: ${wechatCompanies.length}`);
