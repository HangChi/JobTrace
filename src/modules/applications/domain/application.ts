import type { ApplicationStatus, RecruitmentStage } from "./catalog";

export type StageInput = { stage: RecruitmentStage; occurredOn: string };
export function isTerminalStatus(status: ApplicationStatus) {
  return ["rejected", "accepted", "withdrawn"].includes(status);
}
export function uniqueStages(stages: StageInput[]) {
  const seen = new Set<string>();
  return stages.filter((item) => {
    const key = `${item.stage}:${item.occurredOn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
