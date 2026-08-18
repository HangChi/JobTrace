export const interviewInput = (
  applicationId: string,
  stageOccurrenceId: string,
) => ({
  applicationId,
  stageOccurrenceId,
  roundResult: "pending" as const,
});

export const interviewUpdate = (version = 1) => ({
  version,
  roundResult: "pending" as const,
  status: "completed" as const,
  highlights: "表达结构清晰",
  gaps: "需要补充边界条件",
  questions: [
    {
      category: "technical" as const,
      question: "如何设计缓存失效策略？",
      originalAnswer: "主动失效并设置 TTL",
      improvedAnswer: "结合版本号、TTL 与一致性监控",
    },
  ],
  actionItems: [{ content: "补充缓存一致性案例", completed: false }],
});
