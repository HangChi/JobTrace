import Link from "next/link";
import type { PublicInterviewDetail as Detail } from "../application/contracts";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import { UserAvatar } from "@/modules/identity-access/ui/user-avatar";
import { MarkdownPreview } from "./markdown-preview";
import { QUESTION_CATEGORY_LABELS } from "../domain/catalog";

export function PublicInterviewDetail({ interview }: { interview: Detail }) {
  return (
    <article className="interview-editor stack public-interview-detail">
      <header className="interview-editor-header">
        <div>
          <p className="eyebrow">公开面经 · {STAGE_LABELS[interview.stage]}</p>
          <h1>
            {interview.companyName} · {interview.positionName}
          </h1>
          <p className="lead">
            面试日期 {interview.interviewedOn} · 发布于{" "}
            <time dateTime={interview.publishedAt}>
              {interview.publishedAt.slice(0, 10)}
            </time>
          </p>
        </div>
        <div className="public-interview-author">
          {interview.author ? (
            <>
              <UserAvatar
                className="public-author-avatar"
                image={interview.author.image}
                name={interview.author.username}
              />
              <span>@{interview.author.username}</span>
            </>
          ) : (
            <span>匿名用户</span>
          )}
        </div>
      </header>
      {interview.questions.map((question, index) => (
        <section className="panel stack" key={index}>
          <div className="section-heading">
            <h2>
              {interview.questions.length === 1
                ? "面经内容"
                : `面经内容 ${index + 1}`}
            </h2>
            <span className="status-badge">
              {QUESTION_CATEGORY_LABELS[question.category]}
            </span>
          </div>
          <MarkdownPreview value={question.question} />
          {question.originalAnswer && (
            <div className="stack public-answer-section">
              <h3>当时回答</h3>
              <MarkdownPreview value={question.originalAnswer} />
            </div>
          )}
          {question.followUpNotes && (
            <div className="stack public-answer-section">
              <h3>追问记录</h3>
              <MarkdownPreview value={question.followUpNotes} />
            </div>
          )}
          {question.improvedAnswer && (
            <div className="stack public-answer-section">
              <h3>改进回答</h3>
              <MarkdownPreview value={question.improvedAnswer} />
            </div>
          )}
        </section>
      ))}
      {(interview.highlights || interview.gaps) && (
        <section className="panel stack">
          <h2>复盘摘要</h2>
          {interview.highlights && (
            <div>
              <h3>亮点</h3>
              <p>{interview.highlights}</p>
            </div>
          )}
          {interview.gaps && (
            <div>
              <h3>不足</h3>
              <p>{interview.gaps}</p>
            </div>
          )}
        </section>
      )}
      <footer className="interview-editor-footer">
        <Link className="button secondary" href="/interviews">
          返回面经广场
        </Link>
      </footer>
    </article>
  );
}
