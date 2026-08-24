import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ManagedUserDetail } from "@/modules/identity-access";
import { AdminUserDetail } from "@/modules/identity-access/ui/admin-user-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const user: ManagedUserDetail = {
  id: "user-1",
  username: "candidate",
  internalEmail: "candidate@users.jobtrace.local",
  role: "user",
  disabled: false,
  accessVersion: 3,
  createdAt: "2026-08-01T00:00:00.000Z",
  lastSignInAt: "2026-08-24T01:00:00.000Z",
  applicationCount: 1,
  interviewCount: 1,
  recentAuditEvents: [],
  applications: {
    items: [
      {
        id: "application-1",
        companyName: "星河科技",
        positionName: "前端工程师",
        city: "上海",
        jobUrl: "https://example.test/jobs/1",
        type: "campus_recruitment",
        status: "submitted",
        appliedDate: "2026-08-10",
        latestDate: "2026-08-20",
        notes: "内推渠道，等待业务面。",
        stages: [{ stage: "interview_1", occurredOn: "2026-08-20" }],
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
  interviews: {
    items: [
      {
        id: "interview-1",
        applicationId: "application-1",
        companyName: "星河科技",
        positionName: "前端工程师",
        stage: "interview_1",
        interviewedOn: "2026-08-20",
        status: "completed",
        roundResult: "passed",
        format: "online",
        durationMinutes: 45,
        interviewerNotes: "重点考察浏览器与工程化。",
        highlights: "沟通清晰。",
        gaps: "缓存策略需要加强。",
        questions: [
          {
            category: "technical",
            question: "浏览器缓存如何工作？",
            originalAnswer: "介绍了强缓存。",
            followUpNotes: null,
            improvedAnswer: "补充协商缓存与版本策略。",
            selfRating: 4,
          },
        ],
        actionItems: [{ content: "复习缓存控制头", completed: false }],
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
};

describe("admin user detail", () => {
  test("shows applications and interview reviews as read-only disclosures", () => {
    render(
      <AdminUserDetail
        user={user}
        actorId="admin-1"
        returnTo="/admin/users?q=candidate"
      />,
    );

    expect(screen.getByRole("heading", { name: "投递记录" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "面经复盘" })).toBeVisible();
    expect(screen.getAllByText("星河科技")).toHaveLength(2);
    expect(screen.getByText("内推渠道，等待业务面。")).toBeInTheDocument();
    expect(screen.getByText("浏览器缓存如何工作？")).toBeInTheDocument();
    expect(screen.getByText(/管理员只读/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /删除|导出/ }),
    ).not.toBeInTheDocument();
  });
});
