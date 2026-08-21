import type { InterviewDetail } from "./contracts";

export function interviewToMarkdown(review: InterviewDetail) {
  const onlyQuestion = review.questions[0];
  const isPlainMarkdown =
    review.questions.length === 1 &&
    !onlyQuestion?.originalAnswer &&
    !onlyQuestion?.followUpNotes &&
    !onlyQuestion?.improvedAnswer &&
    onlyQuestion?.selfRating === null &&
    !review.highlights &&
    !review.gaps &&
    review.actionItems.length === 0;
  if (isPlainMarkdown) return onlyQuestion?.question ?? "";

  const sections: string[] = [];
  review.questions.forEach((question, index) => {
    sections.push(
      review.questions.length > 1 ? `## 问题 ${index + 1}` : "## 面试问题",
      question.question,
    );
    if (question.originalAnswer) {
      sections.push("### 当时的回答", question.originalAnswer);
    }
    if (question.followUpNotes) {
      sections.push("### 追问或反馈", question.followUpNotes);
    }
    if (question.improvedAnswer) {
      sections.push("### 复盘后的回答", question.improvedAnswer);
    }
    if (question.selfRating !== null) {
      sections.push(`**自评分：${question.selfRating}/5**`);
    }
  });
  if (review.highlights) {
    sections.push("## 做得好的地方", review.highlights);
  }
  if (review.gaps) {
    sections.push("## 可以改进的地方", review.gaps);
  }
  if (review.actionItems.length) {
    sections.push(
      "## 下一步行动",
      review.actionItems
        .map((item) => `- [${item.completed ? "x" : " "}] ${item.content}`)
        .join("\n"),
    );
  }
  return sections.join("\n\n");
}
