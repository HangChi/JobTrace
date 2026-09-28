import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderSettings } from "@/modules/reminders/ui/reminder-settings";

describe("ReminderSettings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves one homepage source and reminder defaults", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => ({
      ok: true,
      json: async () => JSON.parse(String(options.body)),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ReminderSettings
        emailAvailable={false}
        initial={{
          homeEnabled: true,
          homeView: "scheduled",
          defaultLead: "1h",
          defaultSnoozeMinutes: 30,
          emailDefault: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /系统建议/ }));
    fireEvent.change(screen.getByLabelText("新提醒默认时间"), {
      target: { value: "30m" },
    });
    fireEvent.change(screen.getByLabelText("“稍后提醒”默认时间"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存提醒设置" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      homeEnabled: true,
      homeView: "suggestions",
      defaultLead: "30m",
      defaultSnoozeMinutes: 60,
      emailDefault: false,
    });
    expect(screen.getByText(/首页会按新选择展示/)).toBeVisible();
  });

  it("can hide the homepage reminder card", () => {
    render(
      <ReminderSettings
        emailAvailable={false}
        initial={{
          homeEnabled: true,
          homeView: "scheduled",
          defaultLead: "1h",
          defaultSnoozeMinutes: 30,
          emailDefault: false,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "显示" }));
    expect(
      screen.getByRole("group", { name: "首页显示哪一种" }),
    ).toBeDisabled();
  });
});
