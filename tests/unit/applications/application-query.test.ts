import { describe, expect, it } from "vitest";
import { parseListQuery } from "@/modules/applications/application/list-query";

describe("列表查询", () => {
  it("解析组合筛选并限制分页", () => {
    const query = parseListQuery(
      new URLSearchParams(
        "q=字节&status=active&status=offer&limit=999&sort=company",
      ),
    );
    expect(query).toMatchObject({
      q: "字节",
      status: ["active", "offer"],
      limit: 100,
      sort: "company",
    });
  });
  it("未知排序回退默认值", () =>
    expect(parseListQuery(new URLSearchParams("sort=hacker"))).toMatchObject({
      sort: "latestDate",
      direction: "desc",
    }));
});
