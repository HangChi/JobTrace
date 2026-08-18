import type { UpdateInterviewInput } from "./interview.schema";

export function canCompleteReview(input: UpdateInterviewInput) {
  if (!input.questions.length) return false;
  return Boolean(
    input.gaps?.trim() ||
    input.actionItems.length ||
    input.questions.some((item) => item.improvedAnswer?.trim()),
  );
}

export function validateCompletion(input: UpdateInterviewInput) {
  return input.status !== "completed" || canCompleteReview(input);
}
