import { describe, expect, it } from "vitest";
import { parseListQuery } from "@/modules/applications/application/list-query";

describe("列表查询", () => {
  it("解析组合筛选并限制分页", () => {
    const query = parseListQuery(
      new URLSearchParams(
        "q=字节&status=submitted&status=offer&limit=999&page=7&sort=company",
      ),
    );
    expect(query).toMatchObject({
      q: "字节",
      status: ["submitted", "offer"],
      limit: 100,
      page: 7,
      sort: "company",
    });
  });
  it("未知排序回退默认值", () =>
    expect(parseListQuery(new URLSearchParams("sort=hacker"))).toMatchObject({
      sort: "latestDate",
      direction: "desc",
    }));
});
