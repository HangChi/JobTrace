"use client";

import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(
    /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\)]+\))/g,
  );
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) {
      const safeHref = /^https?:\/\//i.test(link[2]) ? link[2] : undefined;
      return safeHref ? (
        <a key={index} href={safeHref} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      ) : (
        <span key={index}>{link[1]}</span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function MarkdownPreview({ value }: { value: string }) {
  const lines = value.replaceAll("\r\n", "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>
        {paragraph.map((part, index) => (
          <span key={index}>
            {index > 0 && " "}
            {inline(part)}
          </span>
        ))}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    flushParagraph();
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {list.items.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  }

  function flushCode() {
    if (!code) return;
    flushParagraph();
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>,
    );
    code = null;
  }

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      flushList();
      flushParagraph();
      if (code) flushCode();
      else code = [];
      return;
    }
    if (code) {
      code.push(line);
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      flushParagraph();
      const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3";
      blocks.push(<Tag key={`heading-${index}`}>{inline(heading[2])}</Tag>);
      return;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const orderedList = Boolean(ordered);
      if (!list || list.ordered !== orderedList) {
        flushList();
        list = { ordered: orderedList, items: [] };
      }
      list.items.push((unordered ?? ordered)![1]);
      return;
    }
    if (/^\s*(---+|___+|\*\s*\*\s*\*)\s*$/.test(line)) {
      flushList();
      flushParagraph();
      blocks.push(<hr key={`rule-${index}`} />);
      return;
    }
    if (/^\s*>\s?/.test(line)) {
      flushList();
      flushParagraph();
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {inline(line.replace(/^\s*>\s?/, ""))}
        </blockquote>,
      );
      return;
    }
    if (!line.trim()) {
      flushList();
      flushParagraph();
      return;
    }
    flushList();
    paragraph.push(line.trim());
  });

  flushList();
  flushParagraph();
  flushCode();
  return blocks.length ? (
    <div className="markdown-rendered">{blocks}</div>
  ) : (
    <p className="markdown-empty">还没有内容，右侧输入后会在这里预览。</p>
  );
}
