import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import UploadZone from "../components/UploadZone";
import MarkdownPreview from "../components/MarkdownPreview";
import KeypointsSidebar from "../components/KeypointsSidebar";
import { summarize, uploadTextbook } from "../services/api";

export default function Dashboard() {
  const { username } = useContext(UserContext);
  const navigate = useNavigate();
  const [markdown, setMarkdown] = useState("");
  const [sections, setSections] = useState([]);
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
      const uploadRes = await uploadTextbook(username, file);
      setMarkdown(uploadRes.markdown);
      setStatus("Generating keypoints...");
      const summary = await summarize(username);
      setSections(summary.sections || []);
      setStatus("Ready");
    } catch (err) {
      setStatus(err.message || "Upload failed");
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
        <section className="space-y-6">
          <UploadZone onFileSelected={handleFileSelected} isLoading={loading} />
          <div className="grid lg:grid-cols-2 gap-6 min-h-[420px]">
            <div>
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Markdown Preview</h2>
              <MarkdownPreview markdown={markdown} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Key Points</h2>
              <KeypointsSidebar sections={sections} />
            </div>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold mb-2">Next steps</h3>
            <ul className="text-sm text-slate-600 list-disc ml-4 space-y-1">
              <li>Upload a textbook to generate Markdown.</li>
              <li>Pick a keypoint to open the deep-dive page.</li>
              <li>Review AI explanations and continue learning.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}