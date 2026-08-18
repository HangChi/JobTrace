import type {
  CreateInterviewInput,
  UpdateInterviewInput,
} from "../domain/interview.schema";
import type {
  InterviewDetail,
  InterviewPage,
  StageInterviewSummary,
} from "./contracts";
import type { InterviewListQuery } from "./list-query";

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
}
