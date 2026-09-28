import { describe, expect, it } from "vitest";
import { campaignQuerySchema } from "@/modules/job-market/application/contracts";

describe("campaignQuerySchema", () => {
  it("treats empty optional form controls as omitted filters", () => {
    expect(
      campaignQuerySchema.parse({
        q: "不存在的企业",
        location: "",
        status: "",
        postedFrom: "",
        favorite: "",
      }),
    ).toEqual({
      q: "不存在的企业",
      page: 1,
      limit: 20,
    });
  });
});
