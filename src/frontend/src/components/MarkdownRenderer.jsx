import React from "react";

function parseInline(text) {
  const tokens = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      tokens.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      tokens.push(
        <code key={`${match.index}-code`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-800">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const labelEnd = token.indexOf("]");
      const label = token.slice(1, labelEnd);
      const href = token.slice(labelEnd + 2, -1);
      tokens.push(
        <a
          key={`${match.index}-link`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2"
        >
          {label}
        </a>
      );
    } else {
      tokens.push(<em key={`${match.index}-em`}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

function flushList(blocks, listItems, ordered, keyPrefix) {
  if (!listItems.length) return;

  const ListTag = ordered ? "ol" : "ul";
  blocks.push(
    <ListTag
      key={`${keyPrefix}-list-${blocks.length}`}
      className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6 text-sm leading-6 text-slate-700`}
    >
      {listItems.map((item, index) => (
        <li key={`${keyPrefix}-li-${index}`}>{parseInline(item)}</li>
      ))}
    </ListTag>
  );
  listItems.length = 0;
}

export default function MarkdownRenderer({ markdown, emptyText }) {
  const source = String(markdown || "").trim();
  if (!source) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  const blocks = [];
  const lines = source.split(/\r?\n/);
  const listItems = [];
  let listOrdered = false;
  let paragraph = [];
  let codeLines = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-6 text-slate-700">
        {parseInline(paragraph.join(" "))}
      </p>
    );
    paragraph = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    blocks.push(
      <pre key={`code-${blocks.length}`} className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
    codeLines = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList(blocks, listItems, listOrdered, "md");
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushParagraph();
      flushList(blocks, listItems, listOrdered, "md");
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList(blocks, listItems, listOrdered, "md");
      const level = heading[1].length;
      const HeadingTag = `h${Math.min(level + 2, 6)}`;
      blocks.push(
        <HeadingTag key={`h-${blocks.length}`} className="font-semibold leading-tight text-slate-900">
          {parseInline(heading[2])}
        </HeadingTag>
      );
      return;
    }

    const unorderedItem = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedItem = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextOrdered = Boolean(orderedItem);
      if (listItems.length && listOrdered !== nextOrdered) {
        flushList(blocks, listItems, listOrdered, "md");
      }
      listOrdered = nextOrdered;
      listItems.push((orderedItem || unorderedItem)[1]);
      return;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList(blocks, listItems, listOrdered, "md");
      blocks.push(
        <blockquote key={`quote-${blocks.length}`} className="border-l-4 border-indigo-200 bg-indigo-50 px-3 py-2 text-sm italic text-slate-700">
          {parseInline(quote[1])}
        </blockquote>
      );
      return;
    }

    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList(blocks, listItems, listOrdered, "md");
  if (inCode) flushCode();

  return <div className="space-y-3">{blocks}</div>;
}
