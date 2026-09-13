import type {
  CreateInterviewInput,
  UpdateInterviewInput,
} from "../domain/interview.schema";
import type {
  InterviewDetail,
  InterviewPage,
  PublicInterviewDetail,
  PublicInterviewComment,
  PublicInterviewEngagement,
  PublicInterviewPage,
  StageInterviewSummary,
} from "./contracts";
import type { InterviewListQuery } from "./list-query";
import type { PublicInterviewListQuery } from "./public-list-query";

export interface InterviewRepository {
  create(
    ownerId: string,
    input: CreateInterviewInput,
  ): Promise<InterviewDetail>;
  get(ownerId: string, id: string): Promise<InterviewDetail | null>;
  update(
    ownerId: string,
    id: string,
    input: UpdateInterviewInput,
  ): Promise<InterviewDetail>;
  delete(ownerId: string, id: string): Promise<boolean>;
  list(ownerId: string, query: InterviewListQuery): Promise<InterviewPage>;
  listForApplication(
    ownerId: string,
    applicationId: string,
  ): Promise<StageInterviewSummary[]>;
  listPublic(
    viewerId: string,
    query: PublicInterviewListQuery,
  ): Promise<PublicInterviewPage>;
  getPublic(
    viewerId: string,
    id: string,
  ): Promise<PublicInterviewDetail | null>;
  togglePublicLike(
    viewerId: string,
    id: string,
  ): Promise<PublicInterviewEngagement | null>;
  addPublicComment(
    viewerId: string,
    id: string,
    content: string,
  ): Promise<{
    comment: PublicInterviewComment;
    engagement: PublicInterviewEngagement;
  } | null>;
  listPublicComments(
    viewerId: string,
    id: string,
  ): Promise<PublicInterviewComment[] | null>;
}
