"use client";

import { useState } from "react";
import type {
  ImportPreview as Preview,
  ImportResult,
} from "../application/contracts";
import Link from "next/link";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  type ImportField,
} from "../application/import-schema";
import {
  TYPE_LABELS,
  type ApplicationType,
} from "@/modules/applications/domain/catalog";

export function ImportPreview({
  preview,
  busy,
  onConfirm,
  onRemap,
}: {
  preview: Preview;
  busy: boolean;
  onConfirm: (
    actions: { rowNumber: number; action: "import" | "skip" }[],
  ) => void;
  onRemap: (mapping: Record<string, string>) => void;
}) {
  const [mapping, setMapping] = useState(preview.columns);
  const dirty = Object.entries(mapping).some(
    ([column, field]) => preview.columns[column] !== field,
  );
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onConfirm(
      preview.rows.map((row) => ({
        rowNumber: row.rowNumber,
        action:
          data.get(`row-${row.rowNumber}`) === "import" ? "import" : "skip",
      })),
    );
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      <h2>预检结果</h2>
      <fieldset className="stack">
        <legend>列映射</legend>
        <p className="muted">
          未映射的源列会被明确忽略。每个业务字段只能选择一次。
        </p>
        <div className="grid import-column-mapping">
          {Object.entries(mapping).map(([column, field]) => (
            <label key={column}>
              {column}
              <select
                aria-label={`${column} 映射到`}
                value={field}
                disabled={busy}
                onChange={(event) =>
                  setMapping((current) => ({
                    ...current,
                    [column]: event.target.value,
                  }))
                }
              >
                <option value="">忽略</option>
                {IMPORT_FIELDS.map((candidate) => (
                  <option
                    key={candidate}
                    value={candidate}
                    disabled={Object.entries(mapping).some(
                      ([otherColumn, target]) =>
                        otherColumn !== column && target === candidate,
                    )}
                  >
                    {IMPORT_FIELD_LABELS[candidate as ImportField]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={busy || !dirty}
          onClick={() => onRemap(mapping)}
        >
          {busy ? "正在重新预检…" : "使用新映射重新预检"}
        </button>
      </fieldset>
      <div className="grid">
        <p>
          <strong>{preview.totalRows}</strong>
          <span className="table-subline">总行数</span>
        </p>
        <p>
          <strong>{preview.validRows}</strong>
          <span className="table-subline">可导入</span>
        </p>
        <p>
          <strong>{preview.invalidRows}</strong>
          <span className="table-subline">需修正</span>
        </p>
        <p>
          <strong>{preview.duplicateRows}</strong>
          <span className="table-subline">重复候选</span>
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>行</th>
              <th>内容/问题</th>
              <th>处理</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => {
              const valid = !row.errors.length && row.data;
              return (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>
                    {valid
                      ? `${row.data?.companyName} · ${row.data?.positionName} · ${TYPE_LABELS[(row.data?.type ?? "campus_recruitment") as ApplicationType]}`
                      : row.errors.map((item) => item.message).join("；")}
                    {row.duplicateApplicationIds.length > 0 && (
                      <span className="follow-up">
                        发现 {row.duplicateApplicationIds.length}{" "}
                        条重复候选，不会覆盖原记录
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      name={`row-${row.rowNumber}`}
                      defaultValue={valid ? "import" : "skip"}
                      disabled={!valid}
                    >
                      <option value="import">创建新记录</option>
                      <option value="skip">跳过</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="button" disabled={busy || dirty}>
        {busy ? "正在导入…" : "确认所选行"}
      </button>
    </form>
  );
}

export function ImportResultView({ result }: { result: ImportResult }) {
  return (
    <section className="panel stack" aria-live="polite">
      <h2>导入完成</h2>
      <div className="grid">
        <p>
          <strong>{result.created}</strong>
          <span className="table-subline">已创建</span>
        </p>
        <p>
          <strong>{result.skipped}</strong>
          <span className="table-subline">已跳过</span>
        </p>
        <p>
          <strong>{result.failed}</strong>
          <span className="table-subline">失败</span>
        </p>
      </div>
      {result.failed > 0 && (
        <ul>
          {result.rows
            .filter((row) => row.error)
            .map((row) => (
              <li key={row.rowNumber}>
                第 {row.rowNumber} 行：{row.error?.message}
              </li>
            ))}
        </ul>
      )}
      <Link className="button" href="/">
        返回投递列表
      </Link>
    </section>
  );
}
