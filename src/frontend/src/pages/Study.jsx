import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader, FileText, Layout, CheckCircle2, Circle } from "lucide-react";
import TextbookContentViewer from "../components/TextbookContentViewer";
import { UserContext } from "../context/UserContext";
import bankLogo from "../images/LogoHNoBackground.png";
import {
  getUserStatus,
  getMineruJobs,
  selectProject,
  getProjectPdf,
  getProjectPdfPreferences,
  saveProjectPdfPreferences,
  getProjectProcessingSteps,
  getProjectProcessingProgress,
  triggerProcessingStep,
  getProjectMarkdown,
  getProjectToc,
  submitProjectToc,
  retryProjectToc,
} from "../services/api";

export default function Study() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { username, t } = useContext(UserContext);
  const [textbookData, setTextbookData] = useState(null);
  const [projectName, setProjectName] = useState(t("study.project"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("summary"); // summary | pdf
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfPreferences, setPdfPreferences] = useState(null);
  const [processingSteps, setProcessingSteps] = useState(null);
  const [processingStep, setProcessingStep] = useState(null);
  const [startingStep, setStartingStep] = useState(null);
  const [currentProjectStatus, setCurrentProjectStatus] = useState(null);
  const [mineruJobs, setMineruJobs] = useState([]);
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(null);
  const [summaryProgress, setSummaryProgress] = useState(null);
  const [showStep2Panel, setShowStep2Panel] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState("");
  const [tocInput, setTocInput] = useState("");
  const [step2Error, setStep2Error] = useState("");
  const [submittingToc, setSubmittingToc] = useState(false);
  const [tocPreview, setTocPreview] = useState(null);
  const [tocPreviewError, setTocPreviewError] = useState("");
  const [tocRetryStatus, setTocRetryStatus] = useState("");
  const [retryingToc, setRetryingToc] = useState(false);
  const loadedProjectRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup URL object
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    loadedProjectRef.current = null;
    setShowStep2Panel(false);
    setMarkdownPreview("");
    setTocInput("");
    setStep2Error("");
    setTocPreview(null);
    setTocPreviewError("");
    setTocRetryStatus("");
    setRetryingToc(false);
    setStartingStep(null);
    setCurrentProjectStatus(null);
    setMineruJobs([]);
    setPdfProcessingProgress(null);
    setSummaryProgress(null);
    setPdfPreferences(null);
    setPdfUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
  }, [projectId]);

  const isProjectPdfProcessing = (project) => (
    project?.splitProcessing?.status === "processing" ||
    Object.values(project?.parts || {}).some((value) => value === "processing")
  );

  const projectNameFromFile = (name) => String(name || "").trim().replace(/\.[^/.]+$/, "");
  const findActiveMineruJob = (project) => {
    const names = new Set([
      project?.filename,
      project?.originalName,
      projectName,
      `${projectNameFromFile(project?.filename || project?.originalName || projectName)}.pdf`,
    ].filter(Boolean).map((name) => String(name).trim()));
    const stems = new Set(Array.from(names).map(projectNameFromFile));
    return mineruJobs.find((job) => (
      names.has(String(job.file_name || "").trim()) ||
      stems.has(String(job.project_name || "").trim()) ||
      stems.has(projectNameFromFile(job.file_name))
    ));
  };
  const activeMineruJob = findActiveMineruJob(currentProjectStatus);
  const isBackendStep1Active = !!activeMineruJob || isProjectPdfProcessing(currentProjectStatus);

  useEffect(() => {
    if (processingStep !== "step1" && !isBackendStep1Active) {
      return undefined;
    }
    if (!username || !projectId) {
      return undefined;
    }

    let active = true;
    const pollProgress = async () => {
      try {
        const [status, jobsResult] = await Promise.all([
          getUserStatus(username),
          getMineruJobs(username),
        ]);
        const project = (status.uploadedProjects || []).find((item) => item.id === projectId);
        if (!active || !project) {
          return;
        }

        const jobs = jobsResult?.data?.jobs || [];
        setMineruJobs(jobs);
        setCurrentProjectStatus(project);
        const hasActiveJob = jobs.some((job) => (
          String(job.file_name || "").trim() === String(project.filename || project.originalName || "").trim() ||
          String(job.project_name || "").trim() === projectNameFromFile(project.filename || project.originalName)
        ));
        setPdfProcessingProgress(project.splitProcessing || {
          status: (hasActiveJob || isProjectPdfProcessing(project)) ? "processing" : "idle",
          partCount: project.splitPreparation?.partCount || null,
          convertedCount: Object.values(project.parts || {}).filter((value) => value === "converted").length,
          currentPart: Object.entries(project.parts || {})
            .find(([, value]) => value === "processing")?.[0]
            ?.replace("part_number", "") || null,
        });

        if (!hasActiveJob && !isProjectPdfProcessing(project)) {
          const steps = await getProjectProcessingSteps(username, project.filename || project.originalName || projectName);
          if (!active) {
            return;
          }

          setProcessingSteps(steps);
          const terminalStatus = project.splitProcessing?.status;
          const step1Finished = !!steps?.step1?.complete || terminalStatus === "completed" || terminalStatus === "failed";
          if (steps?.step1?.complete && terminalStatus !== "failed") {
            const completedProgress = {
              ...(project.splitProcessing || {}),
              status: "completed",
              partCount: project.splitProcessing?.partCount || project.splitPreparation?.partCount || null,
              convertedCount: project.splitProcessing?.convertedCount ?? Object.values(project.parts || {}).filter((value) => value === "converted").length,
              currentPart: null,
              currentStartPage: null,
              currentEndPage: null,
            };
            setCurrentProjectStatus({
              ...project,
              splitProcessing: completedProgress,
            });
            setPdfProcessingProgress(completedProgress);
          }
          if (processingStep === "step1" && step1Finished) {
            setProcessingStep(null);
            setStartingStep(null);
          }
        }
      } catch (err) {
        // Keep the last known progress visible if a polling request fails briefly.
      }
    };

    pollProgress();
    const intervalId = window.setInterval(pollProgress, 1500);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [processingStep, isBackendStep1Active, username, projectId, projectName]);

  useEffect(() => {
    if (processingStep !== "step3" || !username || !projectName) {
      return undefined;
    }

    let active = true;
    const pollProgress = async () => {
      try {
        const result = await getProjectProcessingProgress(username, projectName);
        if (active) {
          setSummaryProgress(result?.data || null);
        }
      } catch (err) {
        // The summary request still owns the final error; keep the last known
        // progress visible if a polling request fails transiently.
      }
    };

    pollProgress();
    const intervalId = window.setInterval(pollProgress, 1500);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [processingStep, username, projectName]);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    let mounted = true;

    const loadFromSelectedProject = async () => {
      setLoading(true);
      setError("");

      try {
          const [status, jobsResult] = await Promise.all([
            getUserStatus(username),
            getMineruJobs(username),
          ]);
          if (mounted) {
            setMineruJobs(jobsResult?.data?.jobs || []);
          }
        const matchedProject = (status.uploadedProjects || []).find(
          (project) => project.id === projectId
        );

        if (!matchedProject) {
          throw new Error(t("study.projectNotFound"));
        }

        setCurrentProjectStatus(matchedProject);
        setPdfProcessingProgress(matchedProject.splitProcessing || null);
        setProjectName(matchedProject.originalName || matchedProject.filename || t("study.project"));

        const projectNameToSelect =
          matchedProject.filename || matchedProject.originalName || projectId;
        let savedPdfPreferences = null;
        try {
          const preferenceResult = await getProjectPdfPreferences(username, projectId);
          savedPdfPreferences = preferenceResult?.data || null;
        } catch (preferenceErr) {
          console.error("Failed to load PDF preferences:", preferenceErr);
        }
        const result = await selectProject(username, projectNameToSelect);

        let steps = null;
        try {
          steps = await getProjectProcessingSteps(username, projectNameToSelect);
        } catch (stepsErr) {
          console.error("Failed to get processing steps:", stepsErr);
        }

        if (steps?.step2?.complete) {
          try {
            const tocResult = await getProjectToc(username, projectNameToSelect);
            if (mounted) {
              setTocPreview(tocResult?.data || null);
              setTocPreviewError("");
            }
          } catch (tocErr) {
            if (mounted) {
              setTocPreview(null);
              setTocPreviewError(tocErr.message || t("study.loadTocFailed"));
            }
          }
        }

        const step3Complete = !!steps?.step3?.complete;

        if (!result?.textbookWithContent?.content || !step3Complete) {
          if (mounted) {
            setProcessingSteps(
              steps || {
                step1: { name: "PDF to Markdown", complete: false },
                step2: { name: "Markdown to JSON", complete: false },
                step3: { name: "Generate Summary", complete: false },
              }
            );
          }
          return;
        }

        if (mounted) {
          setTextbookData(result.textbookWithContent.content);
          setPdfPreferences(savedPdfPreferences);
          setProcessingSteps(null);
          loadedProjectRef.current = projectId;
        }

        // Fetch PDF by username + filename and cache in browser memory
        const pdfFilename = matchedProject.filename || matchedProject.originalName;
        if (!pdfFilename) {
          throw new Error(t("study.pdfNameMissing"));
        }
        const pdfBlob = await getProjectPdf(username, pdfFilename);
        const url = URL.createObjectURL(pdfBlob);
        if (mounted) {
          setPdfUrl(url);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || t("study.loadFailed"));
          loadedProjectRef.current = null;
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadFromSelectedProject();

    return () => {
      mounted = false;
    };
  }, [username, projectId, navigate, t]);

  const getStepName = (stepKey, step) => {
    const labels = {
      step1: t("study.step1"),
      step2: t("study.step2"),
      step3: t("study.step3"),
    };
    return labels[stepKey] || step?.name || stepKey;
  };

  const renderPdfProgress = () => {
    if (!pdfProcessingProgress) {
      return t("study.pdfProcessingPreparing");
    }

    const total = pdfProcessingProgress.partCount;
    const converted = pdfProcessingProgress.convertedCount ?? 0;
    const current = pdfProcessingProgress.currentPart;
    const startPage = pdfProcessingProgress.currentStartPage;
    const endPage = pdfProcessingProgress.currentEndPage;

    if (pdfProcessingProgress.status === "completed") {
      return t("study.pdfProcessingCompleted", { converted, total });
    }

    if (pdfProcessingProgress.status === "failed") {
      return t("study.pdfProcessingFailed", {
        part: pdfProcessingProgress.failedPart || current || "?",
        total: total || "?",
      });
    }

    if (current && total) {
      const pageRange = startPage && endPage ? t("study.pdfProcessingPageRange", { start: startPage, end: endPage }) : "";
      return t("study.pdfProcessingPart", { current, total, converted, pageRange });
    }

    if (total) {
      return t("study.pdfProcessingConverted", { converted, total });
    }

    return t("study.pdfProcessingPreparing");
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{t("study.title")}</h1>
              <p className="text-sm text-slate-500">{projectName}</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("summary")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "summary"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Layout className="h-4 w-4" />
              {t("study.summary")}
            </button>
            <button
              onClick={() => setViewMode("pdf")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "pdf"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              {t("study.originalPdf")}
            </button>
          </div>

          {!loading && !processingSteps && !error && (
            <img
              src={bankLogo}
              alt="Bank of Shanghai"
              className="pointer-events-none absolute left-1/2 top-1/2 hidden h-14 w-auto -translate-x-1/2 -translate-y-1/2 object-contain md:block"
            />
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
            <Loader className="h-5 w-5 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-600">{t("study.loading")}</p>
          </div>
        ) : processingSteps ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
            <div className="w-full max-w-6xl space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">{t("study.processingTitle")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("study.processingSubtitle")}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {["step1", "step2", "step3"].map((stepKey) => {
                  const step = processingSteps[stepKey];
                  const isStep1Processing = stepKey === "step1" && (processingStep === "step1" || startingStep === "step1" || isBackendStep1Active);
                  const isProcessing = processingStep === stepKey || startingStep === stepKey || isStep1Processing;
                  const hasAnyProcessing = processingStep !== null || startingStep !== null || isBackendStep1Active;
                  const isRetryingTocStep = retryingToc && (stepKey === "step2" || stepKey === "step3");
                  const step1CompletedByStatus = (
                    currentProjectStatus?.splitProcessing?.status === "completed" ||
                    pdfProcessingProgress?.status === "completed"
                  );
                  const displayedComplete = (step.complete || (stepKey === "step1" && step1CompletedByStatus)) && !isRetryingTocStep;
                  const step1Complete = !!processingSteps?.step1?.complete || step1CompletedByStatus;
                  const step2Disabled = stepKey === "step2" && (!step1Complete || isBackendStep1Active);
                  return (
                    <div key={stepKey} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        {displayedComplete ? (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 flex-shrink-0 text-slate-400" />
                        )}
                        <span className={`text-sm font-medium ${
                          displayedComplete ? "text-green-700" : "text-slate-600"
                        }`}>
                          {isRetryingTocStep ? t("study.regeneratingToc") : getStepName(stepKey, step)}
                        </span>
                      </div>
                      {!displayedComplete && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (stepKey === "step2") {
                              setStep2Error("");
                              setProcessingStep(stepKey);
                              try {
                                const markdownResult = await getProjectMarkdown(username, projectName);
                                setMarkdownPreview(markdownResult?.data?.content || "");
                                setShowStep2Panel(true);
                              } catch (err) {
                                console.error("Failed to load markdown for step2:", err);
                                setStep2Error(err.message || t("study.loadMarkdownFailed"));
                                setShowStep2Panel(false);
                              } finally {
                                setProcessingStep(null);
                              }
                              return;
                            }

                            if (stepKey === "step3") {
                              setSummaryProgress(null);
                            }
                            if (stepKey === "step1") {
                              setStartingStep("step1");
                              setPdfProcessingProgress({
                                status: "processing",
                                partCount: currentProjectStatus?.splitPreparation?.partCount || null,
                                convertedCount: Object.values(currentProjectStatus?.parts || {}).filter((value) => value === "converted").length,
                                currentPart: Object.entries(currentProjectStatus?.parts || {})
                                  .find(([, value]) => value === "processing")?.[0]
                                  ?.replace("part_number", "") || null,
                              });
                            }
                            setProcessingStep(stepKey);
                            let keepStep1Processing = false;
                            try {
                              const triggerResult = await triggerProcessingStep(username, projectName, stepKey);
                              if (stepKey === "step1" && triggerResult?.status === "processing") {
                                keepStep1Processing = true;
                                setStartingStep(null);
                                const status = await getUserStatus(username);
                                const project = (status.uploadedProjects || []).find((item) => item.id === projectId);
                                setCurrentProjectStatus(project || null);
                                setPdfProcessingProgress(project?.splitProcessing || {
                                  status: "processing",
                                  partCount: project?.splitPreparation?.partCount || null,
                                  convertedCount: Object.values(project?.parts || {}).filter((value) => value === "converted").length,
                                  currentPart: Object.entries(project?.parts || {})
                                    .find(([, value]) => value === "processing")?.[0]
                                    ?.replace("part_number", "") || null,
                                });
                                return;
                              }
                              const steps = await getProjectProcessingSteps(username, projectName);
                              setProcessingSteps(steps);
                            } catch (err) {
                              console.error(`Failed to trigger ${stepKey}:`, err);
                            } finally {
                              if (stepKey !== "step1" || !keepStep1Processing) {
                                setProcessingStep(null);
                                setStartingStep(null);
                              }
                            }
                          }}
                          disabled={isProcessing || hasAnyProcessing || step2Disabled}
                          className="ml-auto rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isProcessing ? (
                            <span className="flex items-center gap-1">
                              <Loader className="h-3 w-3 animate-spin" />
                              {t("study.processing")}
                            </span>
                          ) : (
                            t("study.start")
                          )}
                        </button>
                      )}
                      {stepKey === "step2" && step2Disabled && (
                        <p className="text-xs text-amber-700">{t("study.completeStep1First")}</p>
                      )}
                      {stepKey === "step1" && isProcessing && (
                        <div className="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-800">
                          {renderPdfProgress()}
                        </div>
                      )}
                      {stepKey === "step3" && isProcessing && (
                        <div className="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-800">
                          {summaryProgress?.status === "processing" && summaryProgress.total_chapters > 0 ? (
                            <>
                              {summaryProgress.item_title
                                ? t("study.analysisItem", { title: summaryProgress.item_title })
                                : t("study.analysisCurrent", { current: summaryProgress.current_chapter, total: summaryProgress.total_chapters })}
                              {summaryProgress.item_title
                                ? `（第 ${summaryProgress.current_chapter}/${summaryProgress.total_chapters} 章）`
                                : summaryProgress.chapter_title
                                  ? `：${summaryProgress.chapter_title}`
                                  : ""}
                            </>
                          ) : (
                            t("study.analysisPreparing")
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {showStep2Panel && (
                <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{t("study.step2Input")}</h3>
                    <span className="text-xs text-slate-500">{t("study.step2Hint")}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 text-xs font-medium text-slate-600">{t("study.convertedMarkdown")}</div>
                      <textarea
                        value={markdownPreview}
                        readOnly
                        className="h-80 w-full resize-none rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                      />
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 text-xs font-medium text-slate-600">{t("study.toc")}</div>
                      <textarea
                        value={tocInput}
                        onChange={(e) => setTocInput(e.target.value)}
                        placeholder={t("study.tocPlaceholder")}
                        className="h-80 w-full resize-none rounded border border-slate-300 bg-white p-3 text-sm text-slate-700"
                      />
                    </div>
                  </div>

                  {step2Error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {step2Error}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStep2Panel(false);
                        setStep2Error("");
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t("study.close")}
                    </button>
                    <button
                      type="button"
                      disabled={submittingToc || !tocInput.trim()}
                      onClick={async () => {
                        setSubmittingToc(true);
                        setStep2Error("");
                        try {
                          await submitProjectToc(username, projectName, tocInput.trim());
                          const [steps, tocResult] = await Promise.all([
                            getProjectProcessingSteps(username, projectName),
                            getProjectToc(username, projectName),
                          ]);
                          setProcessingSteps(steps);
                          setTocPreview(tocResult?.data || null);
                          setTocPreviewError("");
                          if (steps?.step2?.complete) {
                            setShowStep2Panel(false);
                          }
                        } catch (err) {
                          console.error("Failed to submit TOC for step2:", err);
                          setStep2Error(err.message || t("study.processTocFailed"));
                        } finally {
                          setSubmittingToc(false);
                        }
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {submittingToc ? t("study.processing") : t("study.generateToc")}
                    </button>
                  </div>
                </div>
              )}
              {processingSteps?.step2?.complete && (
                <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("study.tocReviewTitle")}</h3>
                      <p className="mt-1 text-xs text-slate-600">{t("study.tocReviewHint")}</p>
                    </div>
                    <button
                      type="button"
                      disabled={retryingToc || processingStep !== null}
                      onClick={async () => {
                        setRetryingToc(true);
                        setProcessingStep("toc-retry");
                        setTocPreviewError("");
                        setTocRetryStatus("");
                        setTocPreview(null);
                        setProcessingSteps((prev) => prev ? ({
                          ...prev,
                          step2: { ...prev.step2, complete: false },
                          step3: { ...prev.step3, complete: false },
                        }) : prev);
                        try {
                          const retryResult = await retryProjectToc(username, projectName, tocInput);
                          console.info("TOC retry completed:", retryResult);
                          const changedFileCount = (retryResult?.afterFiles || []).filter((afterFile) => {
                            const beforeFile = (retryResult?.beforeFiles || []).find(
                              (file) => file.filename === afterFile.filename
                            );
                            return beforeFile && (
                              beforeFile.inode !== afterFile.inode ||
                              beforeFile.modifiedAt !== afterFile.modifiedAt ||
                              beforeFile.size !== afterFile.size
                            );
                          }).length;
                          setTocRetryStatus(t("study.retryTocSuccess", {
                            count: retryResult?.deletedFiles?.length ?? 0,
                            changed: changedFileCount,
                            path: retryResult?.outputDir || "",
                          }));
                          const [tocResult, steps] = await Promise.all([
                            getProjectToc(username, projectName),
                            getProjectProcessingSteps(username, projectName),
                          ]);
                          setTocPreview(tocResult?.data || null);
                          setProcessingSteps(steps);
                        } catch (err) {
                          console.error("Failed to regenerate TOC:", err);
                          setTocPreviewError(err.message || t("study.retryTocFailed"));
                          try {
                            const steps = await getProjectProcessingSteps(username, projectName);
                            setProcessingSteps(steps);
                          } catch (stepsErr) {
                            console.error("Failed to refresh processing steps after TOC retry failure:", stepsErr);
                          }
                        } finally {
                          setRetryingToc(false);
                          setProcessingStep(null);
                        }
                      }}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {retryingToc ? (
                        <span className="flex items-center gap-1">
                          <Loader className="h-3 w-3 animate-spin" />
                          {t("study.regeneratingToc")}
                        </span>
                      ) : (
                        t("study.retryToc")
                      )}
                    </button>
                  </div>

                  {tocPreviewError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {tocPreviewError}
                    </div>
                  ) : tocRetryStatus ? (
                    <div className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                      {tocRetryStatus}
                    </div>
                  ) : null}

                  {tocPreview ? (
                    <pre className="max-h-[28rem] overflow-auto rounded-md border border-emerald-100 bg-white p-4 text-xs leading-5 text-slate-700">
                      {JSON.stringify(tocPreview, null, 2)}
                    </pre>
                  ) : (
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      {t("study.tocPreviewEmpty")}
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  <strong>{t("study.tip")}</strong> {t("study.tipText")}
                </p>
              </div>
              <div className="flex justify-center pt-2">
                <img
                  src={bankLogo}
                  alt="Bank of Shanghai"
                  className="h-16 w-auto object-contain sm:h-20"
                />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex max-w-xl items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">{t("study.readFailed")}</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <TextbookContentViewer
            data={textbookData}
            viewMode={viewMode}
            pdfUrl={pdfUrl}
            projectKey={`${username}:${projectId}`}
            projectName={projectName}
            pdfPreferences={pdfPreferences}
            onSavePdfPreferences={(preference) => {
              saveProjectPdfPreferences(username, projectId, preference).catch((saveError) => {
                console.error("Failed to save PDF preferences:", saveError);
              });
            }}
          />
        )}
      </main>
    </div>
  );
}
