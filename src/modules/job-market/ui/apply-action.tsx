"use client";

export function ApplyAction({
  url,
  status,
  label = "立即投递",
}: {
  url: string | null;
  status: string;
  label?: string;
}) {
  if (url && status !== "closed")
    return (
      <a
        className="button primary button-small"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  return (
    <button
      className="button secondary button-small"
      disabled
      title={status === "closed" ? "招聘记录已失效" : "暂无官方招聘官网"}
    >
      {label}
    </button>
  );
}
