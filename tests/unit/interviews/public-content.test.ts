import { describe, expect, it } from "vitest";
import { sanitizePublicInterviewMarkdown } from "@/modules/interviews/application/public-content";

describe("公开面经正文净化", () => {
  it("兼容清理旧编辑器曾写入正文的个人评分和行动项", () => {
    const markdown = [
      "## 面试问题",
      "缓存穿透是什么？",
      "**自评分：4/5**",
      "## 做得好的地方",
      "表达清楚",
      "## 下一步行动",
      "- [ ] 补充案例",
      "- [x] 阅读资料",
    ].join("\n\n");

    expect(sanitizePublicInterviewMarkdown(markdown)).toBe(
      "## 面试问题\n\n缓存穿透是什么？\n\n## 做得好的地方\n\n表达清楚",
    );
  });
});
