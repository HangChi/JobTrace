// 服务端页面把 Next.js searchParams 对象还原成 URL 查询串的统一实现。
// 显式空字符串会被保留（用于翻页链接携带"清空筛选"的语义），
// undefined/null 被忽略；数组值逐项 append。
export function toSearchParams(
  search: Record<string, string | string[] | undefined | null>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined && value !== null) params.set(key, value);
  }
  return params;
}

// Next.js searchParams 的同键多值（重复查询参数）在表单解析场景只需要首个值。
export function firstSearchValues(
  values: Record<string, string | string[] | undefined>,
) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}
