import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "@/modules/reminders";
import { ReminderItem } from "@/modules/reminders/ui/reminder-item";

const base: Reminder = {
  id: crypto.randomUUID(),
  applicationId: crypto.randomUUID(),
  sourceStageOccurrenceId: null,
  companyName: "示例公司",
  positionName: "工程师",
  title: "跟进招聘进度",
  eventAt: "2026-10-08T06:00:00.000Z",
  notifyAt: "2026-10-08T05:00:00.000Z",
  emailEnabled: false,
  status: "due",
  version: 3,
  emailStatus: null,
  completedAt: null,
  cancelledAt: null,
};

describe("ReminderItem actions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-08T04:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("offers one hour, tomorrow, and custom snooze choices", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...base, status: "pending", version: 4 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ReminderItem
        reminder={base}
        email={{ available: false, address: null }}
        defaultSnoozeMinutes={30}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("稍后提醒"));
    fireEvent.click(screen.getByRole("button", { name: "1 小时" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      version: 3,
      notifyAt: "2026-10-08T05:00:00.000Z",
    });
    expect(screen.getByRole("button", { name: "明天此时" })).toBeVisible();
    expect(screen.getByLabelText("自定义时间")).toBeVisible();
  });

  it("requires explicit event and notification times when reopening", async () => {
    const completed = {
      ...base,
      status: "completed" as const,
      completedAt: "2026-10-08T03:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...completed,
        status: "pending",
        completedAt: null,
        version: 4,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ReminderItem
        reminder={completed}
        email={{ available: false, address: null }}
        defaultSnoozeMinutes={30}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("重新打开"));
    fireEvent.change(screen.getByLabelText("事项时间"), {
      target: { value: "2026-10-09T14:00" },
    });
    fireEvent.change(screen.getByLabelText("提醒时间"), {
      target: { value: "2026-10-09T13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认重新打开" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      version: 3,
      eventAt: "2026-10-09T06:00:00.000Z",
      notifyAt: "2026-10-09T05:00:00.000Z",
    });
  });

  it.each([
    { label: "完成", path: "/complete", method: "POST" },
    { label: "取消", path: "", method: "DELETE" },
    { label: "重试邮件", path: "/retry-email", method: "POST" },
  ])("submits the $label action once", async ({ label, path, method }) => {
    const reminder = {
      ...base,
      emailStatus: "failed" as const,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...reminder, version: 4 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <ReminderItem
        reminder={reminder}
        email={{ available: true, address: "user@example.test" }}
        defaultSnoozeMinutes={30}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe(
      `/api/reminders/${reminder.id}${path}`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method });
  });
});
