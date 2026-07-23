import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Book, CheckCircle, Clock3, FileText, MessageSquare, Pencil, Save, Tag, X } from "lucide-react";
import { UserContext } from "../context/UserContext";
import { prepareProjectPdf, selectProject, updateProjectRemark } from "../services/api";

export default function ProjectList() {
  const { userStatus, username, loadUserStatus } = useContext(UserContext);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [preparingProjectId, setPreparingProjectId] = useState(null);

  const handleSelectProject = async (project) => {
    setError("");
    try {
      if (username) {
        await selectProject(username, project.filename || project.originalName);
        await loadUserStatus(username);
      }
      navigate(`/study/${project.id}`);
    } catch (err) {
      setError(err.message || "Failed to select project");
    }
  };

  const projects = userStatus.uploadedProjects || [];
  const currentProjectId = userStatus.currentProject;

  const formatDateTime = (value, emptyLabel = "Not available") => {
    if (!value) return emptyLabel;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? emptyLabel : date.toLocaleString();
  };

  const getFileFormat = (project) => {
    if (project.fileFormat) return project.fileFormat;
    const filename = project.filename || project.originalName || "";
    const extension = filename.split(".").pop();
    return extension && extension !== filename ? extension.toUpperCase() : "Unknown";
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
      setError(err.message || "Failed to save remark");
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
        setError(result.preparation.error || "PDF preparation failed");
      }
      await loadUserStatus(username);
    } catch (err) {
      setError(err.message || "Failed to prepare PDF");
    } finally {
      setPreparingProjectId(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-3 text-slate-700">Projects</h3>
        <div className="text-center py-6">
          <Book className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            No projects yet. Upload a textbook to get started!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3 text-slate-700">Projects</h3>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
        {projects.map((project) => (
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
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filename</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                    {project.originalName || project.filename || "Untitled project"}
                  </p>
                </div>
                {project.id === currentProjectId && (
                  <CheckCircle className="h-5 w-5 text-blue-600 ml-2 flex-shrink-0" />
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>Format: {getFileFormat(project)}</span>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>Created: {formatDateTime(project.createdAt || project.uploadedAt)}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>Last accessed: {formatDateTime(project.lastAccessedAt, "Not opened yet")}</span>
                </div>
                {project.splitPreparation?.status === "split_ready" && (
                  <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-700">
                    Prepared: {project.splitPreparation.pageCount} pages in {project.splitPreparation.partCount} parts
                  </p>
                )}
                {project.splitPreparation?.status === "not_required" && (
                  <p className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-600">
                    Prepared: {project.splitPreparation.pageCount} pages, no split needed
                  </p>
                )}
                {project.splitPreparation?.status === "failed" && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800">
                    PDF preparation failed: {project.splitPreparation.error || "Unknown error"}
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
                      placeholder="Add a remark..."
                      className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProjectId(null)}
                        disabled={savingRemark}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveRemark(project.id)}
                        disabled={savingRemark}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                      >
                        <Save className="h-3.5 w-3.5" /> {savingRemark ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <span className="line-clamp-2">Remark: {project.remark?.trim() || "No remark"}</span>
                    <button
                      type="button"
                      onClick={() => beginRemarkEdit(project)}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
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
                    {preparingProjectId === project.id ? "Preparing..." : "Retry preparation"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
