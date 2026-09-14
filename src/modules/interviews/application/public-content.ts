const PRIVATE_RATING = /(?:\r?\n){1,2}\*\*自评分：[^\r\n]*\*\*/g;
const PRIVATE_ACTIONS =
  /(?:\r?\n){1,2}## 下一步行动(?:\r?\n)+[\s\S]*?(?=(?:\r?\n){1,2}##\s|$)/g;

export function sanitizePublicInterviewMarkdown(value: string) {
  return value
    .replace(PRIVATE_RATING, "")
    .replace(PRIVATE_ACTIONS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
