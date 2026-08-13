"use client";

import { DismissibleDetails } from "@/shared/ui/dismissible-details";

export function ExportButton({ query = "" }: { query?: string }) {
  const suffix = query ? `&${query}` : "";
  return (
    <DismissibleDetails className="export-menu">
      <summary className="button secondary">
        导出
        <svg className="export-chevron" aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
        </svg>
      </summary>
      <div className="export-options">
        <p>选择导出格式</p>
        <a
          href={`/api/exports/applications?scope=filtered&format=xlsx${suffix}`}
        >
          <span className="file-type file-xlsx">X</span>
          <span>
            <strong>Excel 工作簿</strong>
            <small>.xlsx · 保留表格格式</small>
          </span>
        </a>
        <a
          href={`/api/exports/applications?scope=filtered&format=csv${suffix}`}
        >
          <span className="file-type file-csv">C</span>
          <span>
            <strong>CSV 文件</strong>
            <small>.csv · 通用数据格式</small>
          </span>
        </a>
      </div>
    </DismissibleDetails>
  );
}
