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

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || "Upload failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function processProject(username, projectId) {
  const res = await fetch(`${API_BASE}/api/process-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectId }),
  });

  const data = await res.json();
  
  if (!res.ok) {
    const error = new Error(data.error || "Processing failed");
    error.status = res.status;
    error.errorType = data.errorType;
    throw error;
  }
  return data;
}

export async function getProjectStatus(username, projectId) {
  const res = await fetch(
    `${API_BASE}/api/project-status?username=${encodeURIComponent(username)}&projectId=${encodeURIComponent(projectId)}`
  );

  if (!res.ok) {
    throw new Error("Failed to get project status");
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

export async function getUserStatus(username) {
  const res = await fetch(
    `${API_BASE}/api/user-status?username=${encodeURIComponent(username)}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch user status");
  }
  return res.json();
}

export async function setCurrentProject(username, projectId) {
  const res = await fetch(`${API_BASE}/api/set-current-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectId }),
  });
  if (!res.ok) {
    throw new Error("Failed to set current project");
  }
  return res.json();
}

export async function checkServerHealth() {
  const res = await fetch(`${API_BASE}/health`, {
    signal: AbortSignal.timeout(3000)
  });
  if (!res.ok) {
    throw new Error("Backend unavailable");
  }
  return res.json();
}

export async function selectProject(username, projectName) {
  const res = await fetch(`${API_BASE}/api/select-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectName }),
  });
  if (!res.ok) {
    throw new Error("Failed to select project");
  }
  return res.json();
}

export async function generateDetailedExplanation(payload) {
  const res = await fetch(`${API_BASE}/api/llm/detailed-explanation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Failed to generate detailed explanation");
    error.status = res.status;
    error.errorType = data.errorType;
    error.data = data;
    throw error;
  }
  return data;
}

export async function generateQuizForSection(payload) {
  const res = await fetch(`${API_BASE}/api/llm/quiz-for-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Failed to generate quiz for section");
    error.status = res.status;
    error.errorType = data.errorType;
    error.data = data;
    throw error;
  }
  return data;
}