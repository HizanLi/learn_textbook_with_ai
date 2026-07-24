import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe2 } from "lucide-react";
import { UserContext } from "../context/UserContext";
import UploadZone from "../components/UploadZone";
import ProjectList from "../components/ProjectList";
import { uploadTextbook } from "../services/api";
import bankLogo from "../images/LogoHNoBackground.png";
import { languageOptions } from "../i18n";

export default function Dashboard() {
  const { username, loadUserStatus, health, checkHealth, language, setLanguage, t } = useContext(UserContext);
  const navigate = useNavigate();
  const [statusKey, setStatusKey] = useState("dashboard.ready");
  const [statusValues, setStatusValues] = useState({});
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
    setStatusKey("dashboard.uploading");
    setStatusValues({});
    setStatusType("neutral");
    try {
      const uploadResult = await uploadTextbook(username, file);
      if (uploadResult?.preparation?.success === false) {
        setStatusKey("dashboard.uploadPending");
        setStatusValues({ error: uploadResult.preparation.error });
        setStatusType("neutral");
      } else {
        setStatusKey("dashboard.uploadSuccess");
        setStatusValues({});
        setStatusType("success");
      }
      // Reload user status to update projects
      await loadUserStatus(username);
      setTimeout(() => {
        setStatusKey("dashboard.ready");
        setStatusValues({});
        setStatusType("neutral");
      }, 3000);
    } catch (err) {
      setStatusKey(null);
      setStatusValues({ message: err.message || t("dashboard.uploadFailed") });
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
          {t(`health.status.${status}`)}
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
              <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
              <p className="text-sm text-slate-500">{t("dashboard.welcome", { username })}</p>
            </div>
            
            <div className="flex gap-4 border-l pl-8 border-slate-200">
              <HealthBadge label={t("health.backend")} status={health.backend} />
              <HealthBadge label={t("health.python")} status={health.core} />
              <HealthBadge label={t("health.mineru")} status={health.minerU} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Globe2 className="h-4 w-4 text-slate-400" />
              <span className="sr-only">{t("dashboard.language")}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="bg-transparent text-sm outline-none"
                aria-label={t("dashboard.language")}
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={`px-4 py-2 rounded-lg border text-sm transition-all ${getStatusStyle()}`}>
              {t("dashboard.status")}: {statusKey ? t(statusKey, statusValues) : statusValues.message}
            </div>
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

      <img
        src={bankLogo}
        alt="Bank of Shanghai"
        className="fixed bottom-6 right-6 h-16 w-auto object-contain drop-shadow-sm sm:h-20"
      />
    </div>
  );
}
