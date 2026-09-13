import { describe, expect, it } from "vitest";
import { updateInterviewSchema } from "@/modules/interviews/domain/interview.schema";

describe("interview publication input", () => {
  it("keeps publication fields optional for compatible owner updates", () => {
    const parsed = updateInterviewSchema.parse({ version: 1 });
    expect(parsed).not.toHaveProperty("visibility");
    expect(parsed).not.toHaveProperty("authorMode");
  });

  it("accepts explicit anonymous and attributed publication modes", () => {
    expect(
      updateInterviewSchema.parse({
        version: 1,
        status: "completed",
        visibility: "public",
        authorMode: "attributed",
        questions: [{ question: "复盘正文" }],
      }),
    ).toMatchObject({ visibility: "public", authorMode: "attributed" });
  });

  it("rejects unknown publication values", () => {
    expect(
      updateInterviewSchema.safeParse({ version: 1, visibility: "team" })
        .success,
    ).toBe(false);
  });
});
