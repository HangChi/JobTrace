import type { UpdateInterviewInput } from "./interview.schema";

export function canCompleteReview(input: UpdateInterviewInput) {
  return input.questions.some((item) => item.question.trim());
}

export function validateCompletion(input: UpdateInterviewInput) {
  return input.status !== "completed" || canCompleteReview(input);
}
