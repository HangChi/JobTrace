import "server-only";

import { requireUser } from "@/modules/identity-access";
import type { InterviewDetail } from "@/modules/interviews/application/contracts";
import { interviewToMarkdown } from "@/modules/interviews/application/interview-markdown";
import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import { createZip } from "../infrastructure/zip-writer";

type Row = Record<string, unknown>;

const filenameStage: Record<InterviewDetail["stage"], string> = {
  assessment: "测评",
  interview_1: "一面",
  interview_2: "二面",
  interview_3: "三面",
  hr_interview: "HR面",
  final_interview: "终面",
};

function safeFilenamePart(value: string, maxLength = 60) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[-. ]+$/g, "")
      .slice(0, maxLength) || "未命名"
  );
}

export function interviewExportFilename(interview: InterviewDetail) {
  const company = safeFilenamePart(interview.companyName);
  const position = safeFilenamePart(interview.positionName);
  const stage = filenameStage[interview.stage];
  const duration = interview.durationMinutes
    ? `${interview.durationMinutes}分钟`
    : "时长未记录";
  return `${company}-${position}-${stage}面经-${duration}.md`;
}

function mapDetail(row: Row): InterviewDetail {
  const questions = Array.isArray(row.questions)
    ? (row.questions as Row[])
    : [];
  const actionItems = Array.isArray(row.actionItems)
    ? (row.actionItems as Row[])
    : [];
  return {
    id: String(row.id),
    applicationId: String(row.applicationId),
    stageOccurrenceId: row.stageOccurrenceId
      ? String(row.stageOccurrenceId)
      : null,
    companyName: String(row.companyName),
    positionName: String(row.positionName),
    stage: row.displayStage as InterviewDetail["stage"],
    interviewedOn: String(row.displayInterviewedOn).slice(0, 10),
    status: row.status as InterviewDetail["status"],
    roundResult: row.roundResult as InterviewDetail["roundResult"],
    linked: Boolean(row.stageOccurrenceId),
    questionCount: questions.length,
    actionCount: actionItems.length,
    format: row.format as InterviewDetail["format"],
    durationMinutes:
      row.durationMinutes == null ? null : Number(row.durationMinutes),
    interviewerNotes: row.interviewerNotes as string | null,
    highlights: row.highlights as string | null,
    gaps: row.gaps as string | null,
    version: Number(row.version),
    questions: questions.map((question) => ({
      id: String(question.id),
      category:
        question.category as InterviewDetail["questions"][number]["category"],
      question: String(question.question),
      originalAnswer: question.originalAnswer as string | null,
      followUpNotes: question.followUpNotes as string | null,
      improvedAnswer: question.improvedAnswer as string | null,
      selfRating:
        question.selfRating == null ? null : Number(question.selfRating),
    })),
    actionItems: actionItems.map((item) => ({
      id: String(item.id),
      content: String(item.content),
      completed: Boolean(item.completed),
    })),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export async function exportInterviews(ids: string[]) {
  const actor = await requireUser();
  const sql = createServerDatabase();
  const rows = await sql<Row[]>`
    select r.*,a.company_name,a.position_name,
      coalesce(s.stage,r.stage_snapshot) as display_stage,
      r.interviewed_on as display_interviewed_on,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id',q.id,
              'category',q.category,
              'question',q.question,
              'originalAnswer',q.original_answer,
              'followUpNotes',q.follow_up_notes,
              'improvedAnswer',q.improved_answer,
              'selfRating',q.self_rating
            ) order by q.sort_order
          )
          from interview_questions q where q.interview_review_id=r.id
        ),'[]'::jsonb
      ) questions,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id',i.id,'content',i.content,'completed',i.completed
            ) order by i.sort_order
          )
          from interview_action_items i where i.interview_review_id=r.id
        ),'[]'::jsonb
      ) action_items
    from interview_reviews r
    join applications a on a.id=r.application_id and a.owner_id=${actor.id}
    left join application_stage_occurrences s on s.id=r.stage_occurrence_id
    where r.owner_id=${actor.id} and r.id=any(${ids}::uuid[])
    order by array_position(${ids}::uuid[],r.id)
  `;
  const interviews = rows.map(mapDetail);
  if (!interviews.length) {
    throw new Problem("not_found", "没有找到可导出的面经。", 404);
  }

  const usedNames = new Map<string, number>();
  const files = interviews.map((interview) => {
    const preferred = interviewExportFilename(interview);
    const count = (usedNames.get(preferred) ?? 0) + 1;
    usedNames.set(preferred, count);
    const name =
      count === 1 ? preferred : preferred.replace(/\.md$/, `-${count}.md`);
    return { name, content: interviewToMarkdown(interview) };
  });

  if (files.length === 1) {
    return {
      kind: "markdown" as const,
      filename: files[0].name,
      content: Buffer.from(files[0].content, "utf8"),
    };
  }
  return {
    kind: "zip" as const,
    filename: `JobTrace-面经-${new Date().toISOString().slice(0, 10)}.zip`,
    content: createZip(files),
  };
}
