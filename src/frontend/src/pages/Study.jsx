import React, { useContext, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle, Loader, RefreshCw } from "lucide-react";
import { UserContext } from "../context/UserContext";
import MarkdownPreview from "../components/MarkdownPreview";
import KeypointsSidebar from "../components/KeypointsSidebar";
import { summarize, setCurrentProject, processProject, getProjectStatus } from "../services/api";
import { notifyPythonServerUnavailable } from "../utils/notifications";

export default function Study() {
  const { username, userStatus, loadUserStatus } = useContext(UserContext);
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [markdown, setMarkdown] = useState("");
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [processingStatus, setProcessingStatus] = useState("checking");
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const processedRef = useRef(false); // Track if we've already attempted processing

  useEffect(() => {
    // Reset processed flag when projectId changes
    processedRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    let isMounted = true;

    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);

        // Set this as the current project
        if (projectId) {
          await setCurrentProject(username, projectId);
        }

        

        // Check if project needs processing
        setProcessingStatus("checking");
        const projectStatus = await getProjectStatus(username, projectId);
        if (isMounted) {
          setProjectName(projectStatus.originalName || "Project");
        }

        if (
          projectStatus.status === "completed" ||
          projectStatus.status === "processing"
        ) {
          // Already processed or processing, load content
          setProcessingStatus("loading");
          const summary = await summarize(username);
          if (isMounted) {
            setSections(summary.sections || []);
            setMarkdown(summary.markdown || "");
          }
        } else if (
          projectStatus.status === "uploaded" ||
          projectStatus.status === "failed"
        ) {
          // Only process if we haven't already attempted it
          if (!processedRef.current) {
            processedRef.current = true; // Mark that we're attempting processing
            
            // Need to process
            setProcessingStatus("processing");
            console.log(`[STUDY] Processing project ${projectId}...`);

            const processResult = await processProject(username, projectId);

            if (processResult.status === "completed") {
              setProcessingStatus("loading");
              // Load content
              const summary = await summarize(username);
              if (isMounted) {
                setSections(summary.sections || []);
                setMarkdown(summary.markdown || "");
              }
            } else {
              setError(
                `Processing failed: ${processResult.error || "Unknown error"}`
              );
              setProcessingStatus("failed");
            }
          }
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        if (isMounted) {
          setError(err.message || "Failed to load project");
          setErrorType(err.errorType || null);
          setProcessingStatus("failed");
          
          // Show notification if Python server is unavailable
          if (err.errorType === "python_unavailable") {
            notifyPythonServerUnavailable();
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [username, projectId, navigate]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Study Project</h1>
              <p className="text-sm text-slate-500">{projectName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {error ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  {errorType === "python_unavailable" ? "Python API Server Not Available" : "Error"}
                </p>
                <p className="text-sm">{error}</p>
                {errorType === "python_unavailable" && (
                  <div className="mt-3 p-3 bg-red-100 rounded border border-red-300 text-sm font-mono">
                    python src/core/main.py
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {errorType !== "python_unavailable" && (
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              )}
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            {processingStatus === "checking" && (
              <>
                <Loader className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-slate-600">Checking project status...</p>
              </>
            )}
            {processingStatus === "processing" && (
              <>
                <Loader className="h-8 w-8 text-amber-500 animate-spin" />
                <p className="text-slate-600">Processing your document...</p>
                <p className="text-xs text-slate-500">This may take a few moments</p>
              </>
            )}
            {processingStatus === "loading" && (
              <>
                <Loader className="h-8 w-8 text-green-500 animate-spin" />
                <p className="text-slate-600">Loading content...</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 min-h-[600px]">
            <div>
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Markdown Preview</h2>
              <MarkdownPreview markdown={markdown} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Key Points</h2>
              <KeypointsSidebar sections={sections} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
