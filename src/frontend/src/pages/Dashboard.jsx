import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import UploadZone from "../components/UploadZone";
import ProjectList from "../components/ProjectList";
import { uploadTextbook, checkServerHealth } from "../services/api";

export default function Dashboard() {
  const { username, loadUserStatus, health, checkHealth } = useContext(UserContext);
  const navigate = useNavigate();
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [statusType, setStatusType] = useState("neutral"); // neutral, success, error

  useEffect(() => {
    if (!username) {
      navigate("/");
    }
    // Refresh health immediately when landing on dashboard
    checkHealth();
  }, [username, navigate, checkHealth]);

  const handleFileSelected = async (file) => {
    if (!username) return;
    setLoading(true);
    setStatus("Uploading and converting...");
    setStatusType("neutral");
    try {
      await uploadTextbook(username, file);
      setStatus("Upload successful!");
      setStatusType("success");
      // Reload user status to update projects
      await loadUserStatus(username);
      setTimeout(() => {
        setStatus("Ready");
        setStatusType("neutral");
      }, 3000);
    } catch (err) {
      setStatus(err.message || "Upload failed");
      setStatusType("error");
      console.error("Upload error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = () => {
    switch (statusType) {
      case "success":
        return "bg-green-100 text-green-700 border-green-200";
      case "error":
        return "bg-red-100 text-red-700 border-red-200 font-bold";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const HealthBadge = ({ label, status }) => {
    let color = "bg-slate-200 text-slate-600";
    if (status === "healthy" || status === "ok" || status === "ready") color = "bg-green-500 text-white";
    if (status === "unhealthy" || status === "error" || status === "unavailable") color = "bg-red-500 text-white";
    if (status === "loading") color = "bg-blue-400 text-white animate-pulse";
    
    return (
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</span>
        <div className={`px-2 py-0.5 rounded text-[11px] font-medium ${color}`}>
          {status}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome, {username}</p>
            </div>
            
            <div className="flex gap-4 border-l pl-8 border-slate-200">
              <HealthBadge label="Backend" status={health.backend} />
              <HealthBadge label="Python" status={health.core} />
              <HealthBadge label="MinerU" status={health.minerU} />
            </div>
          </div>
          
          <div className={`px-4 py-2 rounded-lg border text-sm transition-all ${getStatusStyle()}`}>
            Status: {status}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        <section>
          <UploadZone onFileSelected={handleFileSelected} isLoading={loading} />
        </section>
        <aside>
          <ProjectList />
        </aside>
      </main>
    </div>
  );
}