import type {
  InterviewFormat,
  InterviewStage,
  QuestionCategory,
  ReviewStatus,
  RoundResult,
} from "../domain/catalog";

export type InterviewQuestion = {
  id: string;
  category: QuestionCategory;
  question: string;
  originalAnswer: string | null;
  followUpNotes: string | null;
  improvedAnswer: string | null;
  selfRating: number | null;
};
export type InterviewActionItem = {
  id: string;
  content: string;
  completed: boolean;
};
export type InterviewSummary = {
  id: string;
  applicationId: string;
  companyName: string;
  positionName: string;
  stage: InterviewStage;
  interviewedOn: string;
  status: ReviewStatus;
  roundResult: RoundResult;
  linked: boolean;
  questionCount: number;
  actionCount: number;
};
export type StageInterviewSummary = Pick<
  InterviewSummary,
  "id" | "stage" | "interviewedOn" | "status" | "questionCount"
> & { stageOccurrenceId: string | null };
export type InterviewDetail = InterviewSummary & {
  stageOccurrenceId: string | null;
  format: InterviewFormat | null;
  durationMinutes: number | null;
  interviewerNotes: string | null;
  highlights: string | null;
  gaps: string | null;
  version: number;
  questions: InterviewQuestion[];
  actionItems: InterviewActionItem[];
  createdAt: string;
  updatedAt: string;
};
export type InterviewPage = {
  items: InterviewSummary[];
  nextCursor: string | null;
  total: number;
  limit: number;
};
