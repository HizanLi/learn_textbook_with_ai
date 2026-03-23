import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader, FileText, Layout, CheckCircle2, Circle } from "lucide-react";
import TextbookContentViewer from "../components/TextbookContentViewer";
import { UserContext } from "../context/UserContext";
import {
  getUserStatus,
  selectProject,
  getProjectPdf,
  getProjectProcessingSteps,
  triggerProcessingStep,
  getProjectMarkdown,
  submitProjectToc,
} from "../services/api";

export default function Study() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { username } = useContext(UserContext);
  const [textbookData, setTextbookData] = useState(null);
  const [projectName, setProjectName] = useState("Project");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("summary"); // summary | pdf
  const [pdfUrl, setPdfUrl] = useState(null);
  const [processingSteps, setProcessingSteps] = useState(null);
  const [processingStep, setProcessingStep] = useState(null);
  const [showStep2Panel, setShowStep2Panel] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState("");
  const [tocInput, setTocInput] = useState("");
  const [step2Error, setStep2Error] = useState("");
  const [submittingToc, setSubmittingToc] = useState(false);
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
    setPdfUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
  }, [projectId]);

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
        const status = await getUserStatus(username);
        const matchedProject = (status.uploadedProjects || []).find(
          (project) => project.id === projectId
        );

        if (!matchedProject) {
          throw new Error("未找到对应项目，请返回 Dashboard 重新选择。");
        }

        setProjectName(matchedProject.originalName || matchedProject.filename || "Project");

        const projectNameToSelect =
          matchedProject.filename || matchedProject.originalName || projectId;
        const result = await selectProject(username, projectNameToSelect);

        let steps = null;
        try {
          steps = await getProjectProcessingSteps(username, projectNameToSelect);
        } catch (stepsErr) {
          console.error("Failed to get processing steps:", stepsErr);
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
          setProcessingSteps(null);
          loadedProjectRef.current = projectId;
        }

        // Fetch PDF by username + filename and cache in browser memory
        const pdfFilename = matchedProject.filename || matchedProject.originalName;
        if (!pdfFilename) {
          throw new Error("未找到 PDF 文件名");
        }
        const pdfBlob = await getProjectPdf(username, pdfFilename);
        const url = URL.createObjectURL(pdfBlob);
        if (mounted) {
          setPdfUrl(url);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "加载项目内容失败");
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
  }, [username, projectId, navigate]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Textbook Knowledge Explorer</h1>
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
              Summary
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
              Original PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
            <Loader className="h-5 w-5 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-600">正在从 /select-project 返回内容加载数据...</p>
          </div>
        ) : processingSteps ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
            <div className="w-full max-w-6xl space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">Processing textbook...</h2>
                <p className="mt-1 text-sm text-slate-600">File is being prepared for study mode</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {["step1", "step2", "step3"].map((stepKey) => {
                  const step = processingSteps[stepKey];
                  const isProcessing = processingStep === stepKey;
                  const step2Disabled = stepKey === "step2" && !processingSteps?.step1?.complete;
                  return (
                    <div key={stepKey} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        {step.complete ? (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 flex-shrink-0 text-slate-400" />
                        )}
                        <span className={`text-sm font-medium ${
                          step.complete ? "text-green-700" : "text-slate-600"
                        }`}>
                          {step.name}
                        </span>
                      </div>
                      {!step.complete && (
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
                                setStep2Error(err.message || "Failed to load markdown content");
                                setShowStep2Panel(false);
                              } finally {
                                setProcessingStep(null);
                              }
                              return;
                            }

                            setProcessingStep(stepKey);
                            try {
                              await triggerProcessingStep(username, projectName, stepKey);
                              const steps = await getProjectProcessingSteps(username, projectName);
                              setProcessingSteps(steps);
                            } catch (err) {
                              console.error(`Failed to trigger ${stepKey}:`, err);
                            } finally {
                              setProcessingStep(null);
                            }
                          }}
                          disabled={isProcessing || processingStep !== null || step2Disabled}
                          className="ml-auto rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isProcessing ? (
                            <span className="flex items-center gap-1">
                              <Loader className="h-3 w-3 animate-spin" />
                              Processing...
                            </span>
                          ) : (
                            "Start"
                          )}
                        </button>
                      )}
                      {stepKey === "step2" && step2Disabled && (
                        <p className="text-xs text-amber-700">Please complete Step 1 first.</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {showStep2Panel && (
                <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Step 2 Input</h3>
                    <span className="text-xs text-slate-500">Left: Markdown | Right: Paste TOC</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 text-xs font-medium text-slate-600">Converted Markdown</div>
                      <textarea
                        value={markdownPreview}
                        readOnly
                        className="h-80 w-full resize-none rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                      />
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 text-xs font-medium text-slate-600">Table Of Contents (paste here)</div>
                      <textarea
                        value={tocInput}
                        onChange={(e) => setTocInput(e.target.value)}
                        placeholder="Paste your textbook table of contents here..."
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
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={submittingToc || !tocInput.trim()}
                      onClick={async () => {
                        setSubmittingToc(true);
                        setStep2Error("");
                        try {
                          await submitProjectToc(username, projectName, tocInput.trim());
                          const steps = await getProjectProcessingSteps(username, projectName);
                          setProcessingSteps(steps);
                          if (steps?.step2?.complete) {
                            setShowStep2Panel(false);
                          }
                        } catch (err) {
                          console.error("Failed to submit TOC for step2:", err);
                          setStep2Error(err.message || "Failed to process table of contents");
                        } finally {
                          setSubmittingToc(false);
                        }
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {submittingToc ? "Processing..." : "Generate TOC and Complete Step 2"}
                    </button>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  <strong>Tip:</strong> Processing may take a few minutes. Click "Start" for each step in order.
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex max-w-xl items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">读取失败</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <TextbookContentViewer data={textbookData} viewMode={viewMode} pdfUrl={pdfUrl} />
        )}
      </main>
    </div>
  );
}
