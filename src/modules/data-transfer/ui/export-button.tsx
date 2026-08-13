export function ExportButton({ query = "" }: { query?: string }) {
  const suffix = query ? `&${query}` : "";
  return (
    <div className="actions">
      <a
        className="button secondary"
        href={`/api/exports/applications?scope=filtered&format=xlsx${suffix}`}
      >
        导出 XLSX
      </a>
      <a
        className="button secondary"
        href={`/api/exports/applications?scope=filtered&format=csv${suffix}`}
      >
        导出 CSV
      </a>
    </div>
  );
}
