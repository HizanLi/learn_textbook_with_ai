import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import UploadZone from "../components/UploadZone";
import ProjectList from "../components/ProjectList";
import { uploadTextbook } from "../services/api";

export default function Dashboard() {
  const { username, loadUserStatus } = useContext(UserContext);
  const navigate = useNavigate();
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) {
      navigate("/");
    }
  }, [username, navigate]);

  const handleFileSelected = async (file) => {
    if (!username) return;
    setLoading(true);
    setStatus("Uploading and converting...");
    try {
      await uploadTextbook(username, file);
      setStatus("Upload successful!");
      // Reload user status to update projects
      await loadUserStatus(username);
      setTimeout(() => setStatus("Ready"), 2000);
    } catch (err) {
      setStatus(err.message || "Upload failed");
      console.error("Upload error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome, {username}</p>
          </div>
          <div className="text-sm text-slate-500">Status: {status}</div>
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