import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  GripVertical,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  FileText,
} from "lucide-react";

export const mockData = {
  book_title: "Python for Everybody",
  chapters: [
    {
      chapter_number: 1,
      chapter_title: "Why should you learn to write programs?",
      sections: [
        {
          section_id: "1.1",
          section_title: "Creativity and motivation",
          key_topics_analysis: {
            core_concepts: [
              "编程是创造性活动，可以把想法转化为可运行的工具。",
              "学习编程的初始价值在于提升个人处理信息与数据的效率。",
            ],
            fundamental_rules: [
              "先面向自己的真实问题做小工具，再逐步扩展复杂度。",
              "以可用性为目标：程序要能稳定、重复地完成任务。",
            ],
            common_pitfalls: [
              "只关注语法，忽略“要解决什么问题”。",
              "一开始就追求复杂项目，导致挫败感。",
            ],
            examples: [
              "写一个脚本统计文本中出现频率最高的单词。",
              "把重复性文件整理工作交给程序自动完成。",
            ],
            one_sentence_summary:
              "编程的核心价值是把重复劳动自动化，让人把精力留给创造与判断。",
          },
        },
        {
          section_id: "1.2",
          section_title: "Computer hardware architecture",
          key_topics_analysis: {
            core_concepts: [
              "CPU 执行指令，内存保存临时数据，外存保存长期数据。",
              "输入输出设备和网络共同构成程序与外部世界交互的通道。",
            ],
            fundamental_rules: [
              "程序必须以清晰顺序给出“下一步做什么”的指令。",
              "根据任务选择合适资源：速度优先用内存，持久化用外存。",
            ],
            common_pitfalls: [
              "混淆主存和外存的职责。",
              "忽视网络延迟与不稳定性对程序流程的影响。",
            ],
            examples: [
              "读取文件到内存后计算，再把结果写回磁盘。",
              "通过网络 API 获取数据时设置重试和超时机制。",
            ],
            one_sentence_summary:
              "程序员的任务是协调 CPU、内存、外存和 I/O 资源，高效完成数据处理。",
          },
        },
      ],
    },
    {
      chapter_number: 2,
      chapter_title: "Variables, expressions, and statements",
      sections: [
        {
          section_id: "2.1",
          section_title: "Values and types",
          key_topics_analysis: {
            core_concepts: [
              "值有类型，如 int、str、float。",
              "类型决定了值可参与的运算方式。",
            ],
            fundamental_rules: [
              "不确定类型时，用 type() 先检查再计算。",
              "字符串数字与数值类型要先转换再运算。",
            ],
            common_pitfalls: [
              "把 '17' 当作 17 参与算术运算。",
              "用错误类型导致语义错误但不一定报错。",
            ],
            examples: [
              "int('17') + 5 -> 22",
              "type('3.2') -> str，float('3.2') -> 3.2",
            ],
            one_sentence_summary:
              "理解值与类型是写出正确表达式和语句的起点。",
          },
        },
        {
          section_id: "2.3",
          section_title: "Variable names and keywords",
          key_topics_analysis: {
            core_concepts: [
              "变量名应语义清晰且符合命名规则。",
              "关键字是保留词，不能作为变量名。",
            ],
            fundamental_rules: [
              "变量名使用字母、数字、下划线，且不能数字开头。",
              "使用助记命名（mnemonic naming）提高可读性。",
            ],
            common_pitfalls: [
              "变量名与关键字冲突（如 class）。",
              "过度简写导致后续难维护。",
            ],
            examples: [
              "hours, rate, pay 比 a, b, c 更易读。",
              "my_name 合法，76trombones 非法。",
            ],
            one_sentence_summary:
              "好的变量命名能显著降低阅读和调试成本。",
          },
        },
      ],
    },
  ],
};

const sectionStyles = {
  core_concepts: {
    title: "核心概念",
    icon: Lightbulb,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  fundamental_rules: {
    title: "基本规则",
    icon: CheckCircle2,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  common_pitfalls: {
    title: "常见误区",
    icon: ShieldAlert,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  examples: {
    title: "示例",
    icon: Sparkles,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

const LAB_BOX_CONFIG = [
  { key: "core_concepts", label: "核心概念" },
  { key: "fundamental_rules", label: "基本规则" },
  { key: "common_pitfalls", label: "常见误区" },
  { key: "examples", label: "示例" },
];

const LAB_BOX_THEME = {
  core_concepts: "bg-amber-50 border-amber-200",
  fundamental_rules: "bg-blue-50 border-blue-200",
  common_pitfalls: "bg-rose-50 border-rose-200",
  examples: "bg-emerald-50 border-emerald-200",
};

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

export default function TextbookContentViewer({ data }) {
  const [expandedChapterId, setExpandedChapterId] = useState(null);
  const [expandedSectionKey, setExpandedSectionKey] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("key_topics_analysis");
  const [draggingKey, setDraggingKey] = useState(null);
  const [droppedKey, setDroppedKey] = useState(null);
  const [generatedText, setGeneratedText] = useState("");

  const activeData = useMemo(() => {
    if (data && Array.isArray(data.chapters) && data.chapters.length) {
      return data;
    }
    return mockData;
  }, [data]);

  const chapters = useMemo(() => activeData.chapters || [], [activeData]);

  useEffect(() => {
    setExpandedChapterId(null);
    setExpandedSectionKey(null);
    setSelectedSection(null);
    setSelectedCategory("key_topics_analysis");
  }, [activeData]);

  useEffect(() => {
    setDroppedKey(null);
    setGeneratedText("");
  }, [selectedSection?.section_id, selectedCategory]);

  const handleToggleChapter = (chapterId) => {
    setExpandedChapterId((prev) => {
      const next = prev === chapterId ? null : chapterId;
      if (prev !== next) {
        setExpandedSectionKey(null);
      }
      return next;
    });
  };

  const getSectionKey = (chapter, section) => `${chapter.chapter_number}-${section.section_id}`;

  const handleSelectSection = (chapter, section, options = {}) => {
    const { toggleSubmenu = false } = options;
    const sectionKey = getSectionKey(chapter, section);

    setExpandedChapterId(chapter.chapter_number);
    setSelectedCategory("key_topics_analysis");
    setSelectedSection({
      chapterTitle: chapter.chapter_title,
      chapterNumber: chapter.chapter_number,
      ...section,
    });

    setExpandedSectionKey((prev) => {
      if (toggleSubmenu) {
        return prev === sectionKey ? null : sectionKey;
      }
      return sectionKey;
    });
  };

  const handleOpenLab = (chapter, section, mode) => {
    handleSelectSection(chapter, section, { toggleSubmenu: false });
    setSelectedCategory(mode);
  };

  const labCards = useMemo(() => {
    const topics = selectedSection?.key_topics_analysis || {};
    return LAB_BOX_CONFIG.map((item) => ({
      ...item,
      points: normalizeList(topics[item.key]),
    }));
  }, [selectedSection]);

  const droppedCard = labCards.find((card) => card.key === droppedKey);

  const generateContent = () => {
    if (!droppedCard) {
      setGeneratedText("请先将一个小 box 拖入下方大 box。");
      return;
    }

    const points = droppedCard.points.length
      ? droppedCard.points.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "暂无可用要点。";

    const prefix =
      selectedCategory === "quiz-for-section"
        ? `【${droppedCard.label}】测验生成\n请基于以下要点设计 3 道题（含简短答案）：\n`
        : `【${droppedCard.label}】详细解释生成\n请基于以下要点输出结构化解释：\n`;

    setGeneratedText(`${prefix}${points}`);
  };

  return (
    <div className="h-[calc(100vh-120px)] min-h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="h-full overflow-y-auto border-r border-slate-200 bg-slate-50">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-800">{activeData.book_title || "Textbook"}</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">章节与小节导航</p>
          </div>

          <div className="space-y-2 p-3">
            {chapters.map((chapter) => {
              const isOpen = expandedChapterId === chapter.chapter_number;

              return (
                <div key={chapter.chapter_number} className="rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => handleToggleChapter(chapter.chapter_number)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-100"
                  >
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">Chapter {chapter.chapter_number}</p>
                      <p className="text-sm font-semibold text-slate-800">{chapter.chapter_title}</p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="space-y-1 px-2 pb-2">
                      {(chapter.sections || []).map((section) => {
                        const isActive = selectedSection?.section_id === section.section_id;
                        const sectionKey = getSectionKey(chapter, section);
                        const isSubmenuOpen = expandedSectionKey === sectionKey;

                        return (
                          <div
                            key={section.section_id}
                            className={`rounded-lg border px-2 py-2 ${
                              isActive ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectSection(chapter, section, { toggleSubmenu: true })}
                              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm text-slate-800"
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${isSubmenuOpen ? "rotate-90" : "rotate-0"}`}
                              />
                              <span className="line-clamp-2 font-medium">{section.section_title}</span>
                            </button>

                            <div
                              className={`grid grid-cols-1 gap-1 overflow-hidden transition-all duration-200 ${
                                isSubmenuOpen ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectSection(chapter, section, { toggleSubmenu: false })}
                                className={`rounded-md px-2 py-1 text-left text-xs transition-colors ${
                                  isActive && selectedCategory === "key_topics_analysis"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                key_topics_analysis
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenLab(chapter, section, "detailed-explanation")}
                                className={`rounded-md px-2 py-1 text-left text-xs transition-colors ${
                                  isActive && selectedCategory === "detailed-explanation"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                detailed explanation
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenLab(chapter, section, "quiz-for-section")}
                                className={`rounded-md px-2 py-1 text-left text-xs transition-colors ${
                                  isActive && selectedCategory === "quiz-for-section"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                quiz for section
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="h-full overflow-y-auto bg-white p-6">
          {!selectedSection ? (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
              <div className="text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">请从左侧选择一个章节进行查看</p>
                <p className="mt-1 text-xs text-slate-500">选择 Section 后将展示关键知识分析</p>
              </div>
            </div>
          ) : selectedCategory === "key_topics_analysis" ? (
            <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 border-b border-slate-200 pb-4">
                <p className="text-xs font-medium text-slate-500">
                  Chapter {selectedSection.chapterNumber} · Section {selectedSection.section_id}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedSection.section_title}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedSection.chapterTitle}</p>
              </div>

              <div className="space-y-4">
                {Object.entries(sectionStyles).map(([field, meta]) => {
                  const items = normalizeList(selectedSection?.key_topics_analysis?.[field]);
                  const Icon = meta.icon;

                  return (
                    <section key={field} className={`rounded-xl border border-slate-200 ${meta.bg} p-4`}>
                      <div className="mb-2 flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <h4 className="text-sm font-semibold text-slate-800">{meta.title}</h4>
                      </div>
                      {items.length ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {items.map((item, idx) => (
                            <li key={`${field}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">暂无内容</p>
                      )}
                    </section>
                  );
                })}

                <section className="rounded-xl border border-slate-200 bg-indigo-50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-indigo-700">一句话总结</h4>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {selectedSection?.key_topics_analysis?.one_sentence_summary || "暂无总结"}
                  </p>
                </section>
              </div>
            </article>
          ) : (
            <article className="mx-auto max-w-5xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 border-b border-slate-200 pb-3">
                <p className="text-xs font-medium text-slate-500">
                  Chapter {selectedSection.chapterNumber} · Section {selectedSection.section_id}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedSection.section_title}</h3>
                <p className="mt-1 text-sm text-indigo-700">
                  {selectedCategory === "quiz-for-section" ? "Quiz for Section" : "Detailed Explanation"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {labCards.map((card) => (
                  <div
                    key={card.key}
                    draggable
                    onDragStart={() => setDraggingKey(card.key)}
                    onDragEnd={() => setDraggingKey(null)}
                    className={`cursor-move rounded-xl border p-4 shadow-sm ${
                      LAB_BOX_THEME[card.key] || "bg-white border-slate-200"
                    } ${
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
                  <div
                    className={`mt-3 rounded-lg border p-3 ${
                      LAB_BOX_THEME[droppedCard.key] || "bg-white border-indigo-200"
                    }`}
                  >
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
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
