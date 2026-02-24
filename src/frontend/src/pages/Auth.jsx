import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { UserContext } from "../context/UserContext";
import { login } from "../services/api";

export default function Auth() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const { setUsername } = useContext(UserContext);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!value.trim()) {
      setError("Please enter a username.");
      return;
    }
    try {
      await login(value.trim());
      localStorage.setItem("username", value.trim());
      setUsername(value.trim());
      navigate("/dashboard");
    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-emerald-500 p-6">
      <div className="bg-white/95 backdrop-blur rounded-2xl p-8 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-semibold">Textbook AI Learning</h1>
        </div>
        <p className="text-slate-600 mb-6">
          Enter a username to load or create your learning workspace.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full rounded-lg border-slate-200 focus:ring-blue-500"
            placeholder="Username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}