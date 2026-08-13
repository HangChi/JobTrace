import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from "../domain/application.schema";
import type { ApplicationDetail, ApplicationPage } from "./contracts";
import type { ListQuery } from "./list-query";
export interface ApplicationRepository {
  create(input: CreateApplicationInput): Promise<ApplicationDetail>;
  get(id: string): Promise<ApplicationDetail | null>;
  update(id: string, input: UpdateApplicationInput): Promise<ApplicationDetail>;
  delete(id: string): Promise<boolean>;
  addStage(
    id: string,
    stage: string,
    occurredOn: string,
  ): Promise<ApplicationDetail>;
  removeStage(
    id: string,
    occurrenceId: string,
    changeDate: string,
  ): Promise<ApplicationDetail>;
  list(query: ListQuery): Promise<ApplicationPage>;
}
