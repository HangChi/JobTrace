import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from "../domain/application.schema";
import type { ApplicationDetail, ApplicationPage } from "./contracts";
import type { ListQuery } from "./list-query";
export interface ApplicationRepository {
  create(
    ownerId: string,
    input: CreateApplicationInput,
  ): Promise<ApplicationDetail>;
  get(ownerId: string, id: string): Promise<ApplicationDetail | null>;
  update(
    ownerId: string,
    id: string,
    input: UpdateApplicationInput,
  ): Promise<ApplicationDetail>;
  delete(ownerId: string, id: string): Promise<boolean>;
  addStage(
    ownerId: string,
    id: string,
    stage: string,
    occurredOn: string,
  ): Promise<ApplicationDetail>;
  removeStage(
    ownerId: string,
    id: string,
    occurrenceId: string,
    changeDate: string,
  ): Promise<ApplicationDetail>;
  list(ownerId: string, query: ListQuery): Promise<ApplicationPage>;
}
