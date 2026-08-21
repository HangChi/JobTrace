import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createZip } from "@/modules/data-transfer/infrastructure/zip-writer";

function readLocalEntries(zip: Buffer) {
  const entries = new Map<string, string>();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = zip
      .subarray(nameStart, nameStart + nameLength)
      .toString("utf8");
    const compressed = zip.subarray(
      contentStart,
      contentStart + compressedSize,
    );
    const content = method === 8 ? inflateRawSync(compressed) : compressed;
    entries.set(name, content.toString("utf8"));
    offset = contentStart + compressedSize;
  }
  return entries;
}

describe("ZIP 写出", () => {
  it("生成可读取的 UTF-8 Markdown 文件集合", () => {
    const zip = createZip([
      { name: "甲公司-前端-一面面经-45分钟.md", content: "# 第一篇" },
      { name: "乙公司-后端-二面面经-60分钟.md", content: "# 第二篇" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(readLocalEntries(zip)).toEqual(
      new Map([
        ["甲公司-前端-一面面经-45分钟.md", "# 第一篇"],
        ["乙公司-后端-二面面经-60分钟.md", "# 第二篇"],
      ]),
    );
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });
});
