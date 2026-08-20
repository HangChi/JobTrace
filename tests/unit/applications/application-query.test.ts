import { describe, expect, it } from "vitest";
import { parseListQuery } from "@/modules/applications/application/list-query";

describe("列表查询", () => {
  it("解析组合筛选并限制分页", () => {
    const query = parseListQuery(
      new URLSearchParams(
        "q=字节&status=submitted&status=offer&type=summer_internship&limit=999&page=7&sort=company",
      ),
    );
    expect(query).toMatchObject({
      q: "字节",
      status: ["submitted", "offer"],
      type: ["summer_internship"],
      limit: 100,
      page: 7,
      sort: "company",
      direction: "asc",
    });
  });
  it("未知排序回退默认值", () =>
    expect(parseListQuery(new URLSearchParams("sort=hacker"))).toMatchObject({
      sort: "latestDate",
      direction: "desc",
    }));
  it("忽略未知筛选和无效日期并约束页码", () => {
    const query = parseListQuery(
      new URLSearchParams(
        "status=unknown&type=unknown&stage=unknown&appliedFrom=nope&appliedTo=2026-08-13&direction=sideways&page=-2&limit=0&city=Shanghai",
      ),
    );
    expect(query).toMatchObject({
      status: [],
      type: [],
      stage: [],
      city: ["Shanghai"],
      appliedFrom: undefined,
      appliedTo: "2026-08-13",
      direction: "desc",
      page: 1,
      limit: 50,
    });
  });
});
