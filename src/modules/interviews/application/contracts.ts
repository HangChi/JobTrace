import type {
  InterviewFormat,
  InterviewAuthorMode,
  InterviewStage,
  InterviewVisibility,
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
  stageOccurrenceId: string | null;
  companyName: string;
  positionName: string;
  stage: InterviewStage;
  interviewedOn: string;
  status: ReviewStatus;
  roundResult: RoundResult;
  linked: boolean;
  questionCount: number;
  actionCount: number;
  visibility: InterviewVisibility;
  authorMode: InterviewAuthorMode;
  publishedAt: string | null;
};
export type StageInterviewSummary = Pick<
  InterviewSummary,
  | "id"
  | "stage"
  | "interviewedOn"
  | "status"
  | "questionCount"
  | "stageOccurrenceId"
>;
export type InterviewDetail = InterviewSummary & {
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

export type PublicAuthor = {
  username: string;
  image: string | null;
};

export type PublicInterviewEngagement = {
  likeCount: number;
  commentCount: number;
  viewCount: number;
  likedByViewer: boolean;
};

export type PublicInterviewComment = {
  id: string;
  content: string;
  createdAt: string;
  author: PublicAuthor;
};

export type PublicInterviewQuestion = {
  category: QuestionCategory;
  question: string;
  originalAnswer: string | null;
  followUpNotes: string | null;
  improvedAnswer: string | null;
};

export type PublicInterviewSummary = {
  id: string;
  companyName: string;
  positionName: string;
  city: string | null;
  stage: InterviewStage;
  interviewedOn: string;
  publishedAt: string;
  questionCount: number;
  author: PublicAuthor | null;
  engagement: PublicInterviewEngagement;
};

export type PublicInterviewContent = {
  highlights: string | null;
  gaps: string | null;
  questions: PublicInterviewQuestion[];
  recentComments: PublicInterviewComment[];
};

export type PublicInterviewFeedItem = PublicInterviewSummary &
  PublicInterviewContent;

export type PublicInterviewDetail = PublicInterviewFeedItem;

export type PublicInterviewPage = {
  items: PublicInterviewFeedItem[];
  nextCursor: string | null;
  total: number;
  limit: number;
  facets: {
    cities: string[];
    positions: string[];
  };
};
