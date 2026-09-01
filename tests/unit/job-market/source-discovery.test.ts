import { describe, expect, it } from "vitest";
import {
  detectSourceCandidate,
  scanDiscoveryTargets,
} from "@/modules/job-market/application/source-discovery";

describe("job-market source discovery", () => {
  it.each([
    [
      "https://boards.greenhouse.io/acme",
      "greenhouse",
      "acme",
      "https://boards-api.greenhouse.io/",
    ],
    [
      "https://jobs.lever.co/acme-cn",
      "lever",
      "acme-cn",
      "https://api.lever.co/",
    ],
    [
      "https://jobs.ashbyhq.com/acme",
      "ashby",
      "acme",
      "https://api.ashbyhq.com/",
    ],
    [
      "https://jobs.smartrecruiters.com/AcmeChina",
      "smartrecruiters",
      "AcmeChina",
      "https://api.smartrecruiters.com/",
    ],
    [
      "https://app.mokahr.com/campus-recruitment/acme/1234",
      "moka",
      "acme|campus|1234",
      "https://api.mokahr.com/",
    ],
    [
      "https://app.mokahr.com/apply/acme/5678",
      "moka",
      "acme|social|5678",
      "https://api.mokahr.com/",
    ],
    [
      "https://app.mokahr.com/m/campus_apply/acme/9012",
      "moka",
      "acme|campus|9012",
      "https://api.mokahr.com/",
    ],
    [
      "https://example.jobs.feishu.cn/experienced",
      "feishu",
      "example.jobs.feishu.cn|experienced",
      "https://example.jobs.feishu.cn/",
    ],
  ])("recognizes a reviewed ATS URL", (url, adapter, key, baseUrl) => {
    expect(detectSourceCandidate(url)).toMatchObject({
      adapter,
      externalKey: key,
      baseUrl,
      confidence: "high",
    });
  });

  it("finds a supported ATS link from a public careers page", () => {
    const html = `
      <html><body>
        <a href="https://jobs.ashbyhq.com/example-cn">加入我们</a>
      </body></html>`;
    expect(
      detectSourceCandidate("https://careers.example.com/", html),
    ).toMatchObject({ adapter: "ashby", externalKey: "example-cn" });
  });

  it("recognizes JobPosting JSON-LD without executing page scripts", () => {
    const html = `
      <script>globalThis.compromised = true</script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"工程师"}
      </script>`;
    expect(
      detectSourceCandidate("https://careers.example.com/jobs", html),
    ).toMatchObject({
      adapter: "schema_org",
      baseUrl: "https://careers.example.com/jobs",
      allowedHosts: ["careers.example.com"],
      confidence: "medium",
    });
    expect((globalThis as Record<string, unknown>).compromised).toBeUndefined();
  });

  it("does not turn WeChat or an unknown page into an automatic source", () => {
    expect(
      detectSourceCandidate("https://mp.weixin.qq.com/s/example"),
    ).toBeNull();
    expect(
      detectSourceCandidate(
        "https://careers.example.com/",
        "<html><body>招聘信息</body></html>",
      ),
    ).toBeNull();
  });

  it("isolates one failed directory target while retaining a healthy candidate", async () => {
    const recorded: Array<{ healthStatus: string; detected: unknown }> = [];
    const repository = {
      listTargets: async () => [
        {
          companyId: "one",
          companyName: "健康企业",
          entryUrl: "https://careers.example.com/",
        },
        {
          companyId: "two",
          companyName: "失败企业",
          entryUrl: "https://offline.example.com/",
        },
      ],
      record: async (value: { healthStatus: string; detected: unknown }) => {
        recorded.push(value);
      },
    };
    const fetcher = async (url: string) => {
      if (url.includes("offline")) throw new Error("private details");
      return {
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => '<a href="https://jobs.lever.co/healthy-cn">职位</a>',
        json: async () => ({}),
      };
    };
    const result = await scanDiscoveryTargets(10, {
      repository,
      fetcher,
    });
    expect(result).toEqual({
      scanned: 2,
      recognized: 1,
      healthy: 1,
      unreachable: 1,
    });
    expect(recorded.map((item) => item.healthStatus)).toEqual([
      "healthy",
      "unreachable",
    ]);
    expect(JSON.stringify(recorded)).not.toContain("private details");
  });
});
