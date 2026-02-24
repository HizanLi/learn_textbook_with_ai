const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function login(username) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    throw new Error("Login failed");
  }
  return res.json();
}

export async function uploadTextbook(username, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("username", username);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Upload failed");
  }
  return res.json();
}

export async function summarize(username) {
  const res = await fetch(`${API_BASE}/api/summarize?username=${encodeURIComponent(username)}`);
  if (!res.ok) {
    throw new Error("Summarize failed");
  }
  return res.json();
}

export async function explain(id, title, keypoints = []) {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (keypoints.length) params.set("keypoints", keypoints.join("|"));

  const res = await fetch(`${API_BASE}/api/explain/${encodeURIComponent(id)}?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Explain failed");
  }
  return res.json();
}