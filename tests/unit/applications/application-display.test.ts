import { describe, expect, it } from "vitest";
import { formatCompanyWithCity } from "@/modules/applications/application/display";

describe("formatCompanyWithCity", () => {
  it("在公司名称后展示单个工作城市", () => {
    expect(formatCompanyWithCity("腾讯", "深圳")).toBe("腾讯（深圳）");
  });

  it("保留多个工作城市的原始分隔格式", () => {
    expect(formatCompanyWithCity("华为", "上海，北京")).toBe(
      "华为（上海，北京）",
    );
  });

  it("没有工作城市时只展示公司名称", () => {
    expect(formatCompanyWithCity("字节跳动", null)).toBe("字节跳动");
    expect(formatCompanyWithCity("字节跳动", "  ")).toBe("字节跳动");
  });
});
