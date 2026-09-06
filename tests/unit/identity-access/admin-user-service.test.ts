import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  log: vi.fn(),
  readUser: vi.fn(),
  readApplications: vi.fn(),
  readInterviews: vi.fn(),
}));

vi.mock("@/shared/observability/logger", () => ({ logServerEvent: mocks.log }));
vi.mock("@/modules/identity-access/application/authorization", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id", role: "admin" }),
}));
vi.mock(
  "@/modules/identity-access/infrastructure/postgres-admin-repository",
  () => ({
    readManagedUser: mocks.readUser,
    readManagedUserApplications: mocks.readApplications,
    readManagedUserInterviews: mocks.readInterviews,
    readManagedUsers: vi.fn(),
    readRecentAdminAudit: vi.fn().mockResolvedValue([]),
    writeUserAccessChange: vi.fn(),
  }),
);

import { getManagedUserDetail } from "@/modules/identity-access/application/admin-user-service";

describe("管理员正文访问日志", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readUser.mockResolvedValue({ id: "target-id" });
    mocks.readApplications.mockResolvedValue({
      items: [{ id: "application-1" }, { id: "application-2" }],
      total: 42,
      page: 2,
      totalPages: 21,
    });
    mocks.readInterviews.mockResolvedValue({
      items: [{ id: "interview-1" }],
      total: 9,
      page: 1,
      totalPages: 9,
    });
  });

  it("只记录本次分页实际返回的数量", async () => {
    await getManagedUserDetail("target-id", {
      applicationsPage: 2,
      interviewsPage: 1,
    });
    expect(mocks.log).toHaveBeenCalledWith(
      "admin.user_data_view",
      expect.objectContaining({ applicationCount: 2, interviewCount: 1 }),
    );
  });
});
