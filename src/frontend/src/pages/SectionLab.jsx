import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical } from "lucide-react";

const BOX_CONFIG = [
  { key: "core_concepts", label: "核心概念" },
  { key: "fundamental_rules", label: "基本规则" },
  { key: "common_pitfalls", label: "常见误区" },
  { key: "examples", label: "示例" },
];

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

export default function SectionLab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();

  const section = location.state?.section;
  const [draggingKey, setDraggingKey] = useState(null);
  const [droppedKey, setDroppedKey] = useState(null);
  const [generatedText, setGeneratedText] = useState("");

  const modeLabel = mode === "quiz-for-section" ? "Quiz for Section" : "Detailed Explanation";

  const cards = useMemo(() => {
    const topics = section?.key_topics_analysis || {};
    return BOX_CONFIG.map((item) => ({
      ...item,
      points: normalizeList(topics[item.key]),
    }));
  }, [section]);

  const droppedCard = cards.find((card) => card.key === droppedKey);

  const generateContent = () => {
    if (!droppedCard) {
      setGeneratedText("请先将一个小 box 拖入下方大 box。");
      return;
    }

    const points = droppedCard.points.length
      ? droppedCard.points.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "暂无可用要点。";

    const prefix =
      mode === "quiz-for-section"
        ? `【${droppedCard.label}】测验生成\n请基于以下要点设计 3 道题（含简短答案）：\n`
        : `【${droppedCard.label}】详细解释生成\n请基于以下要点输出结构化解释：\n`;

    setGeneratedText(`${prefix}${points}`);
  };

  if (!section) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-white p-6">
          <p className="text-red-700">缺少 section 数据，请返回学习页重新选择。</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{modeLabel}</h1>
            <p className="text-sm text-slate-500">
              Chapter {section.chapterNumber} · Section {section.section_id} · {section.section_title}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.key}
              draggable
              onDragStart={() => setDraggingKey(card.key)}
              onDragEnd={() => setDraggingKey(null)}
              className={`cursor-move rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
                draggingKey === card.key ? "opacity-60" : "opacity-100"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{card.label}</h3>
                <GripVertical className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500">可拖动到下方大 box</p>
              <p className="mt-2 text-xs text-slate-600">要点数：{card.points.length}</p>
            </div>
          ))}
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggingKey) {
              setDroppedKey(draggingKey);
            }
          }}
          className="min-h-[180px] rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-6"
        >
          <h2 className="text-sm font-semibold text-indigo-700">内容生成工作区（大 box）</h2>
          {!droppedCard ? (
            <p className="mt-2 text-sm text-slate-600">将上方任意一个小 box 拖到这里。</p>
          ) : (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">已选择：{droppedCard.label}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {droppedCard.points.slice(0, 5).map((point, idx) => (
                  <li key={`${droppedCard.key}-${idx}`}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={generateContent}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            生成内容解释
          </button>

          <div className="min-h-[180px] rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">生成结果</h3>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {generatedText || "点击按钮后在此展示生成内容。"}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
