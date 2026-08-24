import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecruitmentStageTimeline } from "@/modules/applications/ui/recruitment-stage-timeline";
import { InterviewCreateForm } from "@/modules/interviews/ui/interview-create-form";
import type { ApplicationDetail } from "@/modules/applications";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const application: ApplicationDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  companyName: "闭环科技",
  positionName: "前端工程师",
  city: "上海",
  jobUrl: null,
  appliedDate: "2026-08-01",
  type: "campus_recruitment",
  status: "submitted",
  latestDate: "2026-08-18",
  stages: ["screening", "interview_1", "interview_2"],
  needsFollowUp: false,
  followUpDays: 0,
  followUpReason: null,
  version: 3,
  notes: null,
  stageOccurrences: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      stage: "interview_1",
      occurredOn: "2026-08-18",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      stage: "interview_2",
      occurredOn: "2026-08-19",
    },
  ],
  events: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

describe("面经创建闭环", () => {
  it("阶段时间线区分记录面经和继续复盘", () => {
    render(
      <RecruitmentStageTimeline
        application={application}
        interviews={[
          {
            id: "44444444-4444-4444-8444-444444444444",
            stage: "interview_1",
            interviewedOn: "2026-08-18",
            status: "pending_review",
            questionCount: 1,
            stageOccurrenceId: "22222222-2222-4222-8222-222222222222",
          },
        ]}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "继续复盘" })).toHaveAttribute(
      "href",
      "/interviews/44444444-4444-4444-8444-444444444444",
    );
    expect(screen.getByRole("link", { name: "记录面经" })).toHaveAttribute(
      "href",
      expect.stringContaining("33333333-3333-4333-8333-333333333333"),
    );
  });

  it("从阶段入口锁定投递和阶段，但允许独立修改实际日期", () => {
    render(
      <InterviewCreateForm
        applications={[
          {
            id: application.id,
            label: "闭环科技 · 前端工程师",
            appliedDate: application.appliedDate,
          },
        ]}
        applicationId={application.id}
        stageOccurrenceId="22222222-2222-4222-8222-222222222222"
        stage="interview_1"
        interviewedOn="2026-08-18"
      />,
    );

    expect(screen.getByLabelText("关联投递")).toBeDisabled();
    expect(screen.getByLabelText("面试 / 测评阶段")).toHaveValue("interview_1");
    expect(screen.getByLabelText("面试 / 测评日期")).toHaveValue("2026-08-18");
    expect(screen.getByLabelText("面试 / 测评日期")).not.toBeDisabled();
  });

  it("测评阶段也提供记录面经入口", () => {
    render(
      <RecruitmentStageTimeline
        application={{
          ...application,
          stageOccurrences: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              stage: "assessment",
              occurredOn: "2026-08-17",
            },
          ],
        }}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "记录面经" })).toHaveAttribute(
      "href",
      expect.stringContaining("55555555-5555-4555-8555-555555555555"),
    );
  });

  it("选择投递后可选择未关联的已有面试阶段", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => application })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                stageOccurrenceId: "22222222-2222-4222-8222-222222222222",
              },
            ],
          }),
        }),
    );
    render(
      <InterviewCreateForm
        applications={[
          {
            id: application.id,
            label: "闭环科技 · 前端工程师",
            appliedDate: application.appliedDate,
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("关联投递"), {
      target: { value: application.id },
    });
    expect(
      await screen.findByRole("option", { name: "二面 · 2026-08-19" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "一面 · 2026-08-18" }),
    ).not.toBeInTheDocument();
  });
});
