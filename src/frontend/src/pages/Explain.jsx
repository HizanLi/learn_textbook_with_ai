import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { explain } from "../services/api";
import { UserContext } from "../context/UserContext";

export default function Explain() {
  const { username } = useContext(UserContext);
  const { keypointId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);

  const item = location.state?.item;
  const sectionTitle = location.state?.sectionTitle;

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }
    const fetchExplanation = async () => {
      try {
        const data = await explain(keypointId, item?.title, item?.keypoints);
        setExplanation(data.explanation || "No explanation returned.");
      } catch (err) {
        setExplanation(err.message || "Failed to load explanation.");
      } finally {
        setLoading(false);
      }
    };
    fetchExplanation();
  }, [username, keypointId, item, navigate]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </button>
          <div className="text-sm text-slate-500">{username}</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-semibold mb-1">{item?.title || keypointId}</h1>
          <p className="text-sm text-slate-500">Section: {sectionTitle || "Overview"}</p>
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-slate-600">Key points</h2>
            <ul className="list-disc ml-6 text-slate-700">
              {(item?.keypoints || []).map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">AI explanation</h2>
          </div>
          {loading ? (
            <p className="text-slate-500">Generating explanation...</p>
          ) : (
            <pre className="whitespace-pre-wrap text-slate-700 leading-relaxed">{explanation}</pre>
          )}
        </div>
      </main>
    </div>
  );
}