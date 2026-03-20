import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Book, CheckCircle } from "lucide-react";
import { UserContext } from "../context/UserContext";
import { selectProject } from "../services/api";

export default function ProjectList() {
  const { userStatus, username, loadUserStatus } = useContext(UserContext);
  const navigate = useNavigate();
  const [error, setError] = useState("");

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
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => handleSelectProject(project)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              project.id === currentProjectId
                ? "bg-blue-100 border-2 border-blue-500"
                : "bg-slate-50 border-2 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {project.originalName}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(project.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              {project.id === currentProjectId && (
                <CheckCircle className="h-5 w-5 text-blue-600 ml-2 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
