import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplyAction } from "@/modules/job-market/ui/apply-action";
import { TrackApplicationDialog } from "@/modules/job-market/ui/track-application-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("campaign apply actions", () => {
  it("opens the company recruitment website directly", () => {
    render(
      <ApplyAction url="https://jobs.example.com" status="open" />,
    );
    expect(screen.getByRole("link", { name: "立即投递" })).toHaveAttribute(
      "href",
      "https://jobs.example.com",
    );
  });

  it("keeps the official website available while a campaign is stale", () => {
    render(
      <ApplyAction url="https://jobs.example.com" status="stale" />,
    );
    expect(screen.getByRole("link", { name: "立即投递" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("prefills a normal application form without selecting a job", () => {
    render(
      <TrackApplicationDialog
        companyName="示例科技"
        officialUrl="https://jobs.example.com"
        status="open"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "记录投递" }));
    expect(screen.getByLabelText("公司名称 *")).toHaveValue("示例科技");
    expect(screen.getByLabelText("岗位名称 *")).toHaveValue("");
    expect(screen.getByLabelText("职位链接")).toHaveValue(
      "https://jobs.example.com",
    );
  });

  it("disables closed records", () => {
    render(
      <ApplyAction url="https://jobs.example.com" status="closed" />,
    );
    expect(screen.getByRole("button", { name: "立即投递" })).toBeDisabled();
  });
});
