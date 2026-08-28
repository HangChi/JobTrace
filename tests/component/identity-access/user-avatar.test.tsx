import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/modules/identity-access/ui/user-avatar";

describe("UserAvatar", () => {
  it("显示头像图片，并在加载失败时回退到昵称首字母", () => {
    const { container } = render(
      <UserAvatar image="https://example.com/avatar.png" name="Song Hangchi" />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);

    expect(screen.getByText("SO")).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });
});
