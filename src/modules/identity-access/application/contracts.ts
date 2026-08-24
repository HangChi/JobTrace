export const accountRoles = ["user", "admin"] as const;
export type AccountRole = (typeof accountRoles)[number];

export type Actor = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  image: string | null;
  role: AccountRole;
  disabled: boolean;
};

export type Profile = Actor & {
  createdAt: string;
  updatedAt: string;
};

export type AccountAccessState = {
  role: AccountRole;
  disabled: boolean;
  accessVersion: number;
};

export type ManagedUserSummary = AccountAccessState & {
  id: string;
  username: string;
  internalEmail: string;
  createdAt: string;
  lastSignInAt: string | null;
  applicationCount: number;
  interviewCount: number;
};

export type AdminActionOutcome = "succeeded" | "denied" | "conflict" | "failed";
export type AdminAuditEvent = {
  id: string;
  requestId: string;
  actorId: string | null;
  actorIdentifier: string;
  actorDeleted: boolean;
  targetUserId: string | null;
  targetIdentifier: string;
  targetDeleted: boolean;
  eventType: "promote_admin" | "demote_admin" | "disable_user" | "enable_user";
  outcome: AdminActionOutcome;
  reason: string;
  before: AccountAccessState;
  after: AccountAccessState | null;
  failureCode: string | null;
  createdAt: string;
};

export type ManagedUserDetail = ManagedUserSummary & {
  recentAuditEvents: AdminAuditEvent[];
  applications: PageResult<AdminManagedApplication>;
  interviews: PageResult<AdminManagedInterview>;
};

export type AdminManagedApplication = {
  id: string;
  companyName: string;
  positionName: string;
  city: string | null;
  jobUrl: string | null;
  type:
    | "summer_internship"
    | "daily_internship"
    | "early_campus_recruitment"
    | "campus_recruitment"
    | "social_recruitment";
  status: "submitted" | "offer" | "refused";
  appliedDate: string;
  latestDate: string;
  notes: string | null;
  stages: Array<{ stage: string; occurredOn: string }>;
};

export type AdminManagedInterview = {
  id: string;
  applicationId: string;
  companyName: string;
  positionName: string;
  stage: string;
  interviewedOn: string;
  status: "draft" | "pending_review" | "completed";
  roundResult: "pending" | "passed" | "failed";
  format: "online" | "offline" | "phone" | null;
  durationMinutes: number | null;
  interviewerNotes: string | null;
  highlights: string | null;
  gaps: string | null;
  questions: Array<{
    category: string;
    question: string;
    originalAnswer: string | null;
    followUpNotes: string | null;
    improvedAnswer: string | null;
    selfRating: number | null;
  }>;
  actionItems: Array<{ content: string; completed: boolean }>;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminOperationalSummary = {
  generatedAt: string;
  timeZone: "Asia/Shanghai";
  activityDefinition: string;
  counts:
    | {
        status: "available";
        value: {
          users: number;
          activeUsers: number;
          disabledUsers: number;
          administrators: number;
          applications: number;
          interviews: number;
        };
      }
    | { status: "unavailable" };
  activity:
    | {
        status: "available";
        windows: {
          registered7d: number;
          active7d: number;
          registered30d: number;
          active30d: number;
        };
        dailyTrend: Array<{
          date: string;
          registeredUsers: number;
          activeUsers: number;
        }>;
      }
    | { status: "unavailable" };
};
