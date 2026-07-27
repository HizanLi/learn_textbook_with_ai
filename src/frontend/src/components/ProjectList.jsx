import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Book, CheckCircle, Clock3, FileText, MessageSquare, Pencil, Save, Tag, X } from "lucide-react";
import { UserContext } from "../context/UserContext";
import { getMineruJobs, prepareProjectPdf, selectProject, updateProjectRemark } from "../services/api";

export default function ProjectList() {
  const { userStatus, username, loadUserStatus, language, t } = useContext(UserContext);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [preparingProjectId, setPreparingProjectId] = useState(null);
  const [mineruJobs, setMineruJobs] = useState([]);

  const handleSelectProject = async (project) => {
    setError("");
    try {
      if (username) {
        await selectProject(username, project.filename || project.originalName);
        await loadUserStatus(username);
      }
      navigate(`/study/${project.id}`);
    } catch (err) {
      setError(err.message || t("projects.selectFailed"));
    }
  };

  const projects = userStatus.uploadedProjects || [];
  const currentProjectId = userStatus.currentProject;
  const projectNameFromFile = (name) => String(name || "").trim().replace(/\.[^/.]+$/, "");
  const findProjectJob = (project) => {
    const names = new Set([
      project.filename,
      project.originalName,
      `${projectNameFromFile(project.filename || project.originalName)}.pdf`,
    ].filter(Boolean).map((name) => String(name).trim()));
    const stems = new Set(Array.from(names).map(projectNameFromFile));
    return mineruJobs.find((job) => (
      names.has(String(job.file_name || "").trim()) ||
      stems.has(String(job.project_name || "").trim()) ||
      stems.has(projectNameFromFile(job.file_name))
    ));
  };
  const hasActiveConversion = projects.some(
    (project) =>
      findProjectJob(project) ||
      project.splitProcessing?.status === "processing" ||
      Object.values(project.parts || {}).some((value) => value === "processing")
  );

  useEffect(() => {
    if (!username) {
      return undefined;
    }

    let active = true;
    const pollStatus = async () => {
      try {
        const result = await getMineruJobs(username);
        if (active) {
          setMineruJobs(result?.data?.jobs || []);
        }
      } catch (err) {
        if (active) {
          setMineruJobs([]);
        }
      }
      loadUserStatus(username);
    };

    pollStatus();
    const intervalId = window.setInterval(pollStatus, hasActiveConversion ? 1500 : 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [username, hasActiveConversion, loadUserStatus]);

  const formatDateTime = (value, emptyLabel = t("projects.notAvailable")) => {
    if (!value) return emptyLabel;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? emptyLabel : date.toLocaleString(language === "zh" ? "zh-CN" : undefined);
  };

  const getFileFormat = (project) => {
    if (project.fileFormat) return project.fileFormat;
    const filename = project.filename || project.originalName || "";
    const extension = filename.split(".").pop();
    return extension && extension !== filename ? extension.toUpperCase() : t("projects.unknown");
  };

  const getPartStatusSummary = (project) => {
    const activeJob = findProjectJob(project);
    const parts = project.parts || {};
    const fallbackConverted = Object.values(parts).filter((value) => value === "converted").length;
    const fallbackCurrent = Object.entries(parts)
      .find(([, value]) => value === "processing")?.[0]
      ?.replace("part_number", "");
    const progress = activeJob
      ? { status: "processing", ...(project.splitProcessing || {}) }
      : (project.splitProcessing || {});
    const total = progress.partCount || project.splitPreparation?.partCount || Object.keys(parts).length;
    const converted = progress.convertedCount ?? fallbackConverted;
    const current = progress.currentPart || fallbackCurrent;
    const startPage = progress.currentStartPage;
    const endPage = progress.currentEndPage;

    if (progress.status === "completed" || (total && converted === total)) {
      return {
        tone: "success",
        text: t("projects.conversionCompleted", { converted, total }),
      };
    }

    if (progress.status === "failed") {
      return {
        tone: "error",
        text: t("projects.conversionFailed", {
          part: progress.failedPart || current || "?",
          total: total || "?",
        }),
      };
    }

    if (current && total) {
      const pageRange = startPage && endPage
        ? t("projects.conversionPageRange", { start: startPage, end: endPage })
        : "";
      return {
        tone: "active",
        text: t("projects.conversionPart", { current, total, converted, pageRange }),
      };
    }

    if (activeJob) {
      return {
        tone: "active",
        text: t("projects.conversionStarting"),
      };
    }

    if (converted > 0 && total) {
      return {
        tone: "active",
        text: t("projects.conversionConverted", { converted, total }),
      };
    }

    return null;
  };

  const getProgressStyle = (tone) => {
    if (tone === "success") return "bg-emerald-50 text-emerald-700";
    if (tone === "error") return "border border-red-200 bg-red-50 text-red-700";
    return "border border-indigo-100 bg-indigo-50 text-indigo-800";
  };

  const beginRemarkEdit = (project) => {
    setError("");
    setEditingProjectId(project.id);
    setRemarkDraft(project.remark || "");
  };

  const saveRemark = async (projectId) => {
    if (!username) return;

    setSavingRemark(true);
    setError("");
    try {
      await updateProjectRemark(username, projectId, remarkDraft);
      await loadUserStatus(username);
      setEditingProjectId(null);
    } catch (err) {
      setError(err.message || t("projects.saveRemarkFailed"));
    } finally {
      setSavingRemark(false);
    }
  };

  const retryPreparation = async (project) => {
    if (!username) return;

    setPreparingProjectId(project.id);
    setError("");
    try {
      const result = await prepareProjectPdf(username, project.id);
      if (result?.preparation?.success === false) {
        setError(result.preparation.error || t("projects.prepareFailed"));
      }
      await loadUserStatus(username);
    } catch (err) {
      setError(err.message || t("projects.prepareFailed"));
    } finally {
      setPreparingProjectId(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-3 text-slate-700">{t("projects.title")}</h3>
        <div className="text-center py-6">
          <Book className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {t("projects.empty")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3 text-slate-700">{t("projects.title")}</h3>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
        {projects.map((project) => {
          const partStatusSummary = getPartStatusSummary(project);
          return (
            <div
              key={project.id}
              className={`overflow-hidden rounded-xl border-2 transition-colors ${
                project.id === currentProjectId
                  ? "bg-blue-100 border-2 border-blue-500"
                  : "bg-slate-50 border-2 border-slate-200 hover:bg-slate-100"
              }`}
            >
            <button
              type="button"
              onClick={() => handleSelectProject(project)}
              className="w-full p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t("projects.filename")}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                    {project.originalName || project.filename || t("projects.untitled")}
                  </p>
                </div>
                {project.id === currentProjectId && (
                  <CheckCircle className="h-5 w-5 text-blue-600 ml-2 flex-shrink-0" />
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>{t("projects.format", { format: getFileFormat(project) })}</span>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>{t("projects.created", { date: formatDateTime(project.createdAt || project.uploadedAt) })}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>{t("projects.lastAccessed", { date: formatDateTime(project.lastAccessedAt, t("projects.notOpened")) })}</span>
                </div>
                {project.splitPreparation?.status === "split_ready" && (
                  <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-700">
                    {t("projects.preparedSplit", { pages: project.splitPreparation.pageCount, parts: project.splitPreparation.partCount })}
                  </p>
                )}
                {project.splitPreparation?.status === "not_required" && (
                  <p className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-600">
                    {t("projects.preparedNoSplit", { pages: project.splitPreparation.pageCount })}
                  </p>
                )}
                {project.splitPreparation?.status === "failed" && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800">
                    {t("projects.preparationFailed", { error: project.splitPreparation.error || t("projects.unknown") })}
                  </p>
                )}
                {partStatusSummary && (
                  <p className={`rounded-md px-2 py-1.5 ${getProgressStyle(partStatusSummary.tone)}`}>
                    {partStatusSummary.text}
                  </p>
                )}
              </div>
            </button>

            <div className="border-t border-slate-200/80 bg-white/60 px-3 py-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                {editingProjectId === project.id ? (
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={remarkDraft}
                      onChange={(event) => setRemarkDraft(event.target.value)}
                      maxLength={500}
                      rows={2}
                      autoFocus
                      placeholder={t("projects.addRemark")}
                      className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProjectId(null)}
                        disabled={savingRemark}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> {t("projects.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveRemark(project.id)}
                        disabled={savingRemark}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                      >
                        <Save className="h-3.5 w-3.5" /> {savingRemark ? t("projects.saving") : t("projects.save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <span className="line-clamp-2">{t("projects.remark", { remark: project.remark?.trim() || t("projects.noRemark") })}</span>
                    <button
                      type="button"
                      onClick={() => beginRemarkEdit(project)}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t("projects.edit")}
                    </button>
                  </div>
                )}
              </div>
              {project.splitPreparation?.status === "failed" && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => retryPreparation(project)}
                    disabled={preparingProjectId === project.id}
                    className="rounded bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:bg-amber-300"
                  >
                    {preparingProjectId === project.id ? t("projects.preparing") : t("projects.retryPreparation")}
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
