import React, { useContext, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical } from "lucide-react";
import { UserContext } from "../context/UserContext";
import MarkdownRenderer from "../components/MarkdownRenderer";

const BOX_CONFIG = [
  { key: "core_concepts", labelKey: "viewer.coreConcepts" },
  { key: "fundamental_rules", labelKey: "viewer.fundamentalRules" },
  { key: "common_pitfalls", labelKey: "viewer.commonPitfalls" },
  { key: "examples", labelKey: "viewer.examples" },
];

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

export default function SectionLab() {
  const { t } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();

  const section = location.state?.section;
  const [draggingKey, setDraggingKey] = useState(null);
  const [droppedKey, setDroppedKey] = useState(null);
  const [generatedText, setGeneratedText] = useState("");

  const modeLabel = mode === "quiz-for-section" ? t("viewer.quizForSection") : t("viewer.detailedExplanation");

  const cards = useMemo(() => {
    const topics = section?.key_topics_analysis || {};
    return BOX_CONFIG.map((item) => ({
      ...item,
      label: t(item.labelKey),
      points: normalizeList(topics[item.key]),
    }));
  }, [section, t]);

  const droppedCard = cards.find((card) => card.key === droppedKey);

  const generateContent = () => {
    if (!droppedCard) {
      setGeneratedText(t("viewer.dragFirst"));
      return;
    }

    const points = droppedCard.points.length
      ? droppedCard.points.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : t("sectionLab.noPoints");

    const prefix =
      mode === "quiz-for-section"
        ? `[${droppedCard.label}] ${t("sectionLab.quizPrefix")}\n`
        : `[${droppedCard.label}] ${t("sectionLab.explanationPrefix")}\n`;

    setGeneratedText(`${prefix}${points}`);
  };

  if (!section) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-white p-6">
          <p className="text-red-700">{t("sectionLab.missing")}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          >
            {t("sectionLab.back")}
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
              {t("viewer.chapter", { number: section.chapterNumber })} · {t("viewer.section", { number: section.section_id })} · {section.section_title}
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
              <p className="text-xs text-slate-500">{t("viewer.dragIntoBox")}</p>
              <p className="mt-2 text-xs text-slate-600">{t("viewer.pointCount", { count: card.points.length })}</p>
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
          <h2 className="text-sm font-semibold text-indigo-700">{t("viewer.workspace")}</h2>
          {!droppedCard ? (
            <p className="mt-2 text-sm text-slate-600">{t("viewer.dragPrompt")}</p>
          ) : (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">{t("viewer.selected", { label: droppedCard.label })}</p>
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
            {t("viewer.generateContent")}
          </button>

          <div className="min-h-[180px] rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">{t("viewer.generatedResult")}</h3>
            <div className="mt-2">
              <MarkdownRenderer markdown={generatedText} emptyText={t("viewer.generatedPlaceholder")} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
