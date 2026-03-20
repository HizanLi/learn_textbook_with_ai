import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader } from "lucide-react";
import TextbookContentViewer from "../components/TextbookContentViewer";
import { UserContext } from "../context/UserContext";
import { getUserStatus, selectProject } from "../services/api";

export default function Study() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { username } = useContext(UserContext);
  const [textbookData, setTextbookData] = useState(null);
  const [projectName, setProjectName] = useState("Project");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadedProjectRef = useRef(null);

  useEffect(() => {
    loadedProjectRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    let mounted = true;

    const loadFromSelectedProject = async () => {
      if (loadedProjectRef.current === projectId && textbookData) {
        setLoading(false);
        return;
      }

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

        if (!result?.textbookWithContent?.content) {
          throw new Error("该项目暂无 textbook_with_content 内容。");
        }

        if (mounted) {
          setTextbookData(result.textbookWithContent.content);
          loadedProjectRef.current = projectId;
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
  }, [username, projectId, navigate, textbookData]);

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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
            <Loader className="h-5 w-5 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-600">正在从 /select-project 返回内容加载数据...</p>
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
          <TextbookContentViewer data={textbookData} />
        )}
      </main>
    </div>
  );
}
