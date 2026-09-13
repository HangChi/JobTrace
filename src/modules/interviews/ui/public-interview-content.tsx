import type { PublicInterviewContent as Content } from "../application/contracts";
import { QUESTION_CATEGORY_LABELS } from "../domain/catalog";
import { MarkdownPreview } from "./markdown-preview";

function Answer({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="public-answer-section">
      <h4>{label}</h4>
      <MarkdownPreview value={value} headingOffset={4} />
    </div>
  );
}

export function PublicInterviewContent({ interview }: { interview: Content }) {
  return (
    <div className="public-post-content">
      {interview.questions.map((question, index) => (
        <section
          className="public-post-question"
          aria-label={`面经内容 ${index + 1}`}
          key={index}
        >
          <span className="public-question-category">
            {QUESTION_CATEGORY_LABELS[question.category]}
          </span>
          <MarkdownPreview value={question.question} headingOffset={2} />
          <Answer label="当时回答" value={question.originalAnswer} />
          <Answer label="追问记录" value={question.followUpNotes} />
          <Answer label="改进回答" value={question.improvedAnswer} />
        </section>
      ))}
      {(interview.highlights || interview.gaps) && (
        <section className="public-post-reflection" aria-label="复盘摘要">
          {interview.highlights && (
            <div>
              <strong>亮点</strong>
              <p>{interview.highlights}</p>
            </div>
          )}
          {interview.gaps && (
            <div>
              <strong>不足</strong>
              <p>{interview.gaps}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
