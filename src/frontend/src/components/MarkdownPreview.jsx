import React from "react";

export default function MarkdownPreview({ markdown }) {
  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 h-full overflow-auto">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
        {markdown || "Upload a textbook to see the converted markdown."}
      </pre>
    </div>
  );
}