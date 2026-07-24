import React, { useContext } from "react";
import { UserContext } from "../context/UserContext";

export default function MarkdownPreview({ markdown }) {
  const { t } = useContext(UserContext);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 h-full overflow-auto">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
        {markdown || t("markdown.empty")}
      </pre>
    </div>
  );
}
