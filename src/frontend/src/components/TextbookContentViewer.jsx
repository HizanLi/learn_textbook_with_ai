import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { Document, Page, pdfjs } from "react-pdf";
import { getAvailableLlmProviders, generateDetailedExplanation, generateQuizForSection } from "../services/api";
import { UserContext } from "../context/UserContext";
import MarkdownRenderer from "./MarkdownRenderer";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

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
              "Programming is a creative activity that turns ideas into usable tools.",
              "The initial value of learning programming is improving personal efficiency in handling data and information.",
            ],
            fundamental_rules: [
              "Start with small tools for real problems, then gradually increase complexity.",
              "Aim for usability: programs should complete tasks reliably and repeatedly.",
            ],
            common_pitfalls: [
              "Focusing only on syntax while ignoring the actual problem to solve.",
              "Jumping into complex projects too early and getting frustrated.",
            ],
            examples: [
              "Write a script to count the most frequent word in a text.",
              "Automate repetitive file organization tasks with a program.",
            ],
            one_sentence_summary:
              "The core value of programming is automating repetitive work so people can focus on creativity and judgment.",
          },
        },
        {
          section_id: "1.2",
          section_title: "Computer hardware architecture",
          key_topics_analysis: {
            core_concepts: [
              "The CPU executes instructions, memory stores temporary data, and storage keeps persistent data.",
              "I/O devices and networks together form how programs interact with the outside world.",
            ],
            fundamental_rules: [
              "Programs must provide clear step-by-step instructions for what happens next.",
              "Choose resources based on task needs: memory for speed, storage for persistence.",
            ],
            common_pitfalls: [
              "Confusing the roles of main memory and persistent storage.",
              "Ignoring network latency and instability in program flow.",
            ],
            examples: [
              "Load a file into memory, process it, then write results back to disk.",
              "Use retries and timeouts when fetching data from network APIs.",
            ],
            one_sentence_summary:
              "A programmer’s job is to coordinate CPU, memory, storage, and I/O resources for efficient data processing.",
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
              "Values have types, such as int, str, and float.",
              "Type determines which operations are valid for a value.",
            ],
            fundamental_rules: [
              "When unsure about type, check with type() before computing.",
              "Convert numeric strings to numeric types before arithmetic.",
            ],
            common_pitfalls: [
              "Treating '17' as 17 in arithmetic operations.",
              "Using incorrect types can cause semantic errors without obvious exceptions.",
            ],
            examples: [
              "int('17') + 5 -> 22",
              "type('3.2') -> str，float('3.2') -> 3.2",
            ],
            one_sentence_summary:
              "Understanding values and types is the foundation of correct expressions and statements.",
          },
        },
        {
          section_id: "2.3",
          section_title: "Variable names and keywords",
          key_topics_analysis: {
            core_concepts: [
              "Variable names should be meaningful and follow naming rules.",
              "Keywords are reserved words and cannot be used as variable names.",
            ],
            fundamental_rules: [
              "Use letters, digits, and underscores; names cannot start with a digit.",
              "Use mnemonic names to improve readability.",
            ],
            common_pitfalls: [
              "Using names that conflict with keywords (e.g., class).",
              "Over-abbreviation makes code harder to maintain.",
            ],
            examples: [
              "hours, rate, pay are clearer than a, b, c.",
              "my_name is valid, 76trombones is invalid.",
            ],
            one_sentence_summary:
              "Good variable naming significantly reduces reading and debugging cost.",
          },
        },
      ],
    },
  ],
};

const sectionStyles = {
  core_concepts: {
    titleKey: "viewer.coreConcepts",
    icon: Lightbulb,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  fundamental_rules: {
    titleKey: "viewer.fundamentalRules",
    icon: CheckCircle2,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  common_pitfalls: {
    titleKey: "viewer.commonPitfalls",
    icon: ShieldAlert,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  examples: {
    titleKey: "viewer.examples",
    icon: Sparkles,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

const LAB_BOX_CONFIG = [
  { key: "core_concepts", labelKey: "viewer.coreConcepts" },
  { key: "fundamental_rules", labelKey: "viewer.fundamentalRules" },
  { key: "common_pitfalls", labelKey: "viewer.commonPitfalls" },
  { key: "examples", labelKey: "viewer.examples" },
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

const toPositivePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export default function TextbookContentViewer({
  data,
  viewMode = "summary",
  pdfUrl = null,
  projectKey = null,
  pdfPreferences = null,
  onSavePdfPreferences = null,
}) {
  const { language, t } = useContext(UserContext);
  const [expandedChapterId, setExpandedChapterId] = useState(null);
  const [expandedSectionKey, setExpandedSectionKey] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("key_topics_analysis");
  const [pdfPage, setPdfPage] = useState(1);
  const [pageOffset, setPageOffset] = useState(0);
  const [pdfPageInput, setPdfPageInput] = useState("1");
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfLoadError, setPdfLoadError] = useState("");
  const [requestedPdfPage, setRequestedPdfPage] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const [droppedKey, setDroppedKey] = useState(null);
  const [generatedText, setGeneratedText] = useState("");
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [llmProviders, setLlmProviders] = useState([
    { id: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  ]);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const pdfScrollRef = useRef(null);
  const pdfPageRefs = useRef(new Map());

  const activeData = useMemo(() => {
    if (data && Array.isArray(data.chapters) && data.chapters.length) {
      return data;
    }
    return mockData;
  }, [data]);

  const chapters = useMemo(() => activeData.chapters || [], [activeData]);
  const pdfStateKey = `textbook-pdf-state:${projectKey || activeData.book_title || "default"}`;

  const firstChapterJsonPage = toPositivePage(chapters[0]?.start_page) || 1;

  const applyPageOffset = (jsonPageValue) => {
    const jsonPage = toPositivePage(jsonPageValue);
    if (!jsonPage) {
      return null;
    }
    return Math.max(1, jsonPage + pageOffset);
  };

  const setCurrentPdfPage = (page, { scrollToPage = false } = {}) => {
    const nextPage = toPositivePage(page);
    if (!nextPage) {
      return false;
    }

    // Keep the editable field synchronized before another click can use it.
    setPdfPage(nextPage);
    setPdfPageInput(String(nextPage));
    if (scrollToPage) {
      setRequestedPdfPage(nextPage);
    }
    return true;
  };

  useEffect(() => {
    if (!requestedPdfPage || !pdfPageCount || viewMode !== "pdf") {
      return;
    }

    const targetPage = Math.min(requestedPdfPage, pdfPageCount);
    const target = pdfPageRefs.current.get(targetPage);
    if (!target) {
      return;
    }

    target.scrollIntoView({ block: "start", behavior: "auto" });
    setRequestedPdfPage(null);
  }, [pdfPageCount, requestedPdfPage, viewMode]);

  useEffect(() => {
    const scrollContainer = pdfScrollRef.current;
    if (!scrollContainer || !pdfPageCount || viewMode !== "pdf") {
      return undefined;
    }

    let animationFrame = null;
    const updateCurrentPage = () => {
      animationFrame = null;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let closestPage = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      pdfPageRefs.current.forEach((pageElement, pageNumber) => {
        const distance = Math.abs(pageElement.getBoundingClientRect().top - containerTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNumber;
        }
      });

      if (closestPage) {
        setCurrentPdfPage(closestPage);
      }
    };

    const handleScroll = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(updateCurrentPage);
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    updateCurrentPage();

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [pdfPageCount, viewMode]);

  useEffect(() => {
    setExpandedChapterId(null);
    setExpandedSectionKey(null);
    setSelectedSection(null);
    setSelectedCategory("key_topics_analysis");
    const firstPage = toPositivePage(activeData?.chapters?.[0]?.start_page) || 1;
    let savedState = null;

    try {
      savedState = JSON.parse(sessionStorage.getItem(pdfStateKey) || "null");
    } catch {
      // A malformed saved value should not prevent the textbook from opening.
    }

    const browserSavedPage = toPositivePage(savedState?.page);
    const browserSavedOffset = Number.parseInt(savedState?.pageOffset, 10);
    const savedPage = toPositivePage(pdfPreferences?.lastPage) || browserSavedPage;
    const savedOffset = Number.parseInt(pdfPreferences?.pageOffset, 10);
    const nextPage = savedPage || firstPage;

    setPageOffset(
      Number.isFinite(savedOffset)
        ? savedOffset
        : Number.isFinite(browserSavedOffset)
          ? browserSavedOffset
          : 0
    );
    setCurrentPdfPage(nextPage, { scrollToPage: true });
  }, [pdfPreferences?.lastPage, pdfPreferences?.pageOffset, pdfStateKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        pdfStateKey,
        JSON.stringify({ page: pdfPage, pageOffset })
      );
    } catch {
      // Session storage is optional; keep the in-memory viewer working.
    }
  }, [pageOffset, pdfPage, pdfStateKey]);

  useEffect(() => {
    setDroppedKey(null);
    setGeneratedText("");
    setGeneratedQuiz(null);
    setQuizAnswers({});
    setRevealedAnswers({});
  }, [selectedSection?.section_id, selectedCategory]);

  useEffect(() => {
    pdfPageRefs.current.clear();
    setPdfPageCount(0);
    setPdfLoadError("");
  }, [pdfUrl]);

  useEffect(() => {
    setPdfPageInput(String(pdfPage));
  }, [pdfPage]);

  useEffect(() => {
    let active = true;
    getAvailableLlmProviders()
      .then((result) => {
        if (!active || !Array.isArray(result?.providers) || !result.providers.length) {
          return;
        }
        setLlmProviders(result.providers);
        setSelectedProvider((current) =>
          result.providers.some((provider) => provider.id === current)
            ? current
            : result.providers[0].id
        );
      })
      .catch((error) => {
        console.error("Failed to load LLM providers:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleToggleChapter = (chapter) => {
    const chapterId = chapter.chapter_number;
    setExpandedChapterId((prev) => {
      const next = prev === chapterId ? null : chapterId;
      if (prev !== next) {
        setExpandedSectionKey(null);
      }
      return next;
    });

    const targetPdfPage = applyPageOffset(chapter?.start_page);
    if (targetPdfPage) {
      setCurrentPdfPage(targetPdfPage, { scrollToPage: true });
    }
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

    const targetPage = applyPageOffset(section?.page) || applyPageOffset(chapter?.start_page);
    if (targetPage) {
      setCurrentPdfPage(targetPage, { scrollToPage: true });
    }

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
      label: t(item.labelKey),
      points: normalizeList(topics[item.key]),
    }));
  }, [selectedSection, t]);

  const droppedCard = labCards.find((card) => card.key === droppedKey);
  const quizQuestions = Array.isArray(generatedQuiz?.quiz) ? generatedQuiz.quiz : [];

  const generateContent = async () => {
    if (!droppedCard) {
      setGeneratedText(t("viewer.dragFirst"));
      return;
    }

    setIsGenerating(true);
    setGeneratedText("");
    setGeneratedQuiz(null);
    setQuizAnswers({});
    setRevealedAnswers({});

    try {
      const payload = {
        provider: selectedProvider,
        chapterTitle: selectedSection?.chapterTitle || "",
        sectionTitle: selectedSection?.section_title || "",
        topicType: droppedCard.key,
        points: droppedCard.points,
        content: selectedSection?.content || "",
        language: language === "zh" ? "zh-CN" : "en-US",
        includeRaw: false,
      };

      if (selectedCategory === "quiz-for-section") {
        const result = await generateQuizForSection({
          ...payload,
          questionCount: 5,
          temperature: 0.4,
          maxTokens: 2200,
          strictJson: true,
        });

        if (result?.quiz) {
          setGeneratedQuiz(result.quiz);
        } else {
          setGeneratedText(result?.text || t("viewer.noQuizOutput"));
        }
      } else {
        const result = await generateDetailedExplanation({
          ...payload,
          temperature: 0.5,
          maxTokens: 1400,
        });
        setGeneratedText(result?.text || t("viewer.noExplanationOutput"));
      }
    } catch (err) {
      const apiText = err?.data?.text;
      setGeneratedText(
        apiText
          ? `${t("viewer.requestFailed", { message: err.message })}\n\n${t("viewer.modelOutput")}\n${apiText}`
          : t("viewer.requestFailed", { message: err.message })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSetAsInitialPage = () => {
    const actualPdfPage = toPositivePage(pdfPageInput);
    if (!actualPdfPage) {
      return;
    }

    const nextOffset = actualPdfPage - firstChapterJsonPage;
    setPageOffset(nextOffset);
    setCurrentPdfPage(actualPdfPage, { scrollToPage: true });
    onSavePdfPreferences?.({
      pageOffset: nextOffset,
      lastPage: actualPdfPage,
    });
  };

  const handleGoToPage = () => {
    const targetPage = toPositivePage(pdfPageInput);
    if (!targetPage) {
      return;
    }
    setCurrentPdfPage(targetPage, { scrollToPage: true });
  };

  return (
    <div className="h-[calc(100vh-120px)] min-h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="h-full overflow-y-auto border-r border-slate-200 bg-slate-50">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-800">{activeData.book_title || t("viewer.textbook")}</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t("viewer.navigation")}</p>
          </div>

          <div className="space-y-2 p-3">
            {chapters.map((chapter) => {
              const isOpen = expandedChapterId === chapter.chapter_number;

              return (
                <div key={chapter.chapter_number} className="rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => handleToggleChapter(chapter)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-100"
                  >
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">{t("viewer.chapter", { number: chapter.chapter_number })}</p>
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
                                {t("viewer.keyTopics")}
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
                                {t("viewer.detailedExplanation")}
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
                                {t("viewer.quizForSection")}
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

        <main className="relative h-full overflow-y-auto bg-white p-6">
          <div
            aria-hidden={viewMode !== "pdf"}
            className={
              viewMode === "pdf"
                ? "h-full"
                : "pointer-events-none absolute inset-0 -z-10 h-full opacity-0"
            }
          >
            <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-[190px]">
                  <p className="text-xs font-medium text-slate-700">{t("viewer.currentPdfPage")}</p>
                  <input
                    type="number"
                    min="1"
                    value={pdfPageInput}
                    onChange={(e) => setPdfPageInput(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400"
                    placeholder={t("viewer.pageNumber")}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGoToPage}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  {t("viewer.go")}
                </button>
                <button
                  type="button"
                  onClick={handleSetAsInitialPage}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  {t("viewer.setInitialPage")}
                </button>
                <div className="text-xs text-slate-600">
                  <p>
                    {t("viewer.currentBookPage")} <span className="font-semibold text-slate-800">{pdfPage}</span>
                    {pdfPageCount ? ` / ${pdfPageCount}` : ""}
                  </p>
                  <p className="mt-1">
                    {t("viewer.alignsChapter", { chapter: chapters[0]?.chapter_number || 1, page: firstChapterJsonPage })}
                  </p>
                  <p className="mt-1">{t("viewer.offset", { offset: pageOffset >= 0 ? `+${pageOffset}` : pageOffset })}</p>
                </div>
              </div>
              {pdfUrl ? (
                <div ref={pdfScrollRef} className="min-h-0 flex-1 overflow-auto bg-slate-200">
                  <Document
                    file={pdfUrl}
                    loading={
                      <div className="flex min-h-full items-center justify-center p-8 text-sm text-slate-600">
                        {t("viewer.loadingOriginal")}
                      </div>
                    }
                    error={
                      <div className="flex min-h-full items-center justify-center p-8 text-sm text-red-700">
                        {pdfLoadError || t("viewer.loadPdfFailed")}
                      </div>
                    }
                    onLoadSuccess={({ numPages }) => {
                      pdfPageRefs.current.clear();
                      setPdfPageCount(numPages);
                      setPdfLoadError("");
                    }}
                    onLoadError={(error) => {
                      setPdfPageCount(0);
                      setPdfLoadError(error.message || t("viewer.loadPdfFailed"));
                    }}
                    className="mx-auto flex w-fit min-w-full flex-col items-center gap-4 p-4"
                  >
                    {Array.from({ length: pdfPageCount }, (_, index) => {
                      const pageNumber = index + 1;
                      return (
                        <div
                          key={pageNumber}
                          ref={(element) => {
                            if (element) {
                              pdfPageRefs.current.set(pageNumber, element);
                            } else {
                              pdfPageRefs.current.delete(pageNumber);
                            }
                          }}
                          className="rounded-sm bg-white shadow-md"
                        >
                          <Page
                            pageNumber={pageNumber}
                            width={780}
                            renderAnnotationLayer={false}
                            renderTextLayer={false}
                          />
                        </div>
                      );
                    })}
                  </Document>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">{t("viewer.loadingOriginal")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {viewMode !== "pdf" && (!selectedSection ? (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
              <div className="text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">{t("viewer.selectSection")}</p>
                <p className="mt-1 text-xs text-slate-500">{t("viewer.sectionHint")}</p>
              </div>
            </div>
          ) : selectedCategory === "key_topics_analysis" ? (
            <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 border-b border-slate-200 pb-4">
                <p className="text-xs font-medium text-slate-500">
                  {t("viewer.chapter", { number: selectedSection.chapterNumber })} · {t("viewer.section", { number: selectedSection.section_id })}
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
                        <h4 className="text-sm font-semibold text-slate-800">{t(meta.titleKey)}</h4>
                      </div>
                      {items.length ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {items.map((item, idx) => (
                            <li key={`${field}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">{t("viewer.noContent")}</p>
                      )}
                    </section>
                  );
                })}

                <section className="rounded-xl border border-slate-200 bg-indigo-50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-indigo-700">{t("viewer.oneSentenceSummary")}</h4>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {selectedSection?.key_topics_analysis?.one_sentence_summary || t("viewer.noSummary")}
                  </p>
                </section>
              </div>
            </article>
          ) : (
            <article className="mx-auto max-w-5xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 border-b border-slate-200 pb-3">
                <p className="text-xs font-medium text-slate-500">
                  {t("viewer.chapter", { number: selectedSection.chapterNumber })} · {t("viewer.section", { number: selectedSection.section_id })}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedSection.section_title}</h3>
                <p className="mt-1 text-sm text-indigo-700">
                  {selectedCategory === "quiz-for-section" ? t("viewer.quizForSection") : t("viewer.detailedExplanation")}
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
                    <p className="text-xs text-slate-500">
                      {selectedCategory === "quiz-for-section"
                        ? t("viewer.dragQuizSource")
                        : t("viewer.dragIntoBox")}
                    </p>
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
                <h2 className="text-sm font-semibold text-indigo-700">
                  {selectedCategory === "quiz-for-section" ? t("viewer.quizSourceSelection") : t("viewer.workspace")}
                </h2>
                {!droppedCard ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedCategory === "quiz-for-section"
                      ? t("viewer.dragQuizPrompt")
                      : t("viewer.dragPrompt")}
                  </p>
                ) : (
                  <div
                    className={`mt-3 rounded-lg border p-3 ${
                      LAB_BOX_THEME[droppedCard.key] || "bg-white border-indigo-200"
                    }`}
                  >
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
                <div className="flex flex-wrap items-end gap-3">
                  <button
                    onClick={generateContent}
                    disabled={isGenerating}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                  >
                    {isGenerating
                      ? selectedCategory === "quiz-for-section" ? t("viewer.generatingQuiz") : t("viewer.generating")
                      : selectedCategory === "quiz-for-section" ? t("viewer.generateQuiz") : t("viewer.generateContent")}
                  </button>
                  <label className="min-w-[190px] text-xs font-medium text-slate-600">
                    {t("viewer.modelProvider")}
                    <select
                      value={selectedProvider}
                      onChange={(event) => setSelectedProvider(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
                    >
                      {llmProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label || provider.id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="min-h-[180px] rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {selectedCategory === "quiz-for-section" ? t("viewer.yourQuiz") : t("viewer.generatedResult")}
                  </h3>
                  {selectedCategory === "quiz-for-section" && quizQuestions.length ? (
                    <div className="mt-4 space-y-5">
                      {quizQuestions.map((question, index) => {
                        const questionKey = String(question.question_id || index + 1);
                        const answer = quizAnswers[questionKey] || "";
                        const revealed = revealedAnswers[questionKey];
                        const isCorrect = answer.trim() === String(question.correct_answer || "").trim();
                        const isMultipleChoice = question.question_type === "mcq";

                        return (
                          <section key={questionKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                {t("viewer.question", { number: index + 1 })} · {isMultipleChoice ? t("viewer.multipleChoice") : t("viewer.shortAnswer")}
                              </span>
                              {question.difficulty && (
                                <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-500">{question.difficulty}</span>
                              )}
                            </div>
                            <p className="mt-3 font-medium text-slate-900">{question.question}</p>

                            {isMultipleChoice ? (
                              <div className="mt-3 space-y-2">
                                {(Array.isArray(question.options) ? question.options : []).map((option, optionIndex) => (
                                  <label
                                    key={`${questionKey}-${optionIndex}`}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                                      answer === option ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`quiz-${questionKey}`}
                                      value={option}
                                      checked={answer === option}
                                      onChange={() => setQuizAnswers((current) => ({ ...current, [questionKey]: option }))}
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <textarea
                                value={answer}
                                onChange={(event) => setQuizAnswers((current) => ({ ...current, [questionKey]: event.target.value }))}
                                placeholder={t("viewer.answerPlaceholder")}
                                className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500"
                              />
                            )}

                            <button
                              type="button"
                              onClick={() => setRevealedAnswers((current) => ({ ...current, [questionKey]: true }))}
                              disabled={!answer.trim()}
                              className="mt-3 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t("viewer.checkAnswer")}
                            </button>

                            {revealed && (
                              <div className={`mt-3 rounded-lg border p-3 text-sm ${isCorrect ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                                <p className="font-semibold text-slate-800">
                                  {isCorrect
                                    ? t("viewer.correct")
                                    : t("viewer.suggestedAnswer", { answer: question.correct_answer || t("viewer.notProvided") })}
                                </p>
                                {question.explanation && <p className="mt-1 text-slate-700">{question.explanation}</p>}
                                {question.source_alignment_note && (
                                  <p className="mt-2 text-xs italic text-slate-500">{question.source_alignment_note}</p>
                                )}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <MarkdownRenderer
                        markdown={generatedText}
                        emptyText={
                          selectedCategory === "quiz-for-section"
                            ? t("viewer.chooseQuizSource")
                            : t("viewer.generatedPlaceholder")
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}
