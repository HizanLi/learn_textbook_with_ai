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

export async function updateProjectRemark(username, projectId, remark) {
  const res = await fetch(`${API_BASE}/api/project-remark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectId, remark }),
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    throw new Error(
      data?.error || "Unable to save the remark. Restart the backend so it loads the latest API routes."
    );
  }
  if (!data) {
    throw new Error("The backend returned an invalid response while saving the remark.");
  }
  return data;
}

export async function getProjectPdf(username, filename) {
  const url = `${API_BASE}/api/project-pdf?username=${encodeURIComponent(username)}&filename=${encodeURIComponent(filename)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch PDF");
  }
  return res.blob();
}

export async function getProjectPdfPreferences(username, projectId) {
  const url = `${API_BASE}/api/project-pdf-preferences?username=${encodeURIComponent(username)}&projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch PDF preferences");
  }
  return data;
}

export async function saveProjectPdfPreferences(username, projectId, preference) {
  const res = await fetch(`${API_BASE}/api/project-pdf-preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectId, ...preference }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to save PDF preferences");
  }
  return data;
}

export async function getProjectProcessingSteps(username, projectName) {
  const url = `${API_BASE}/api/project-processing-steps?username=${encodeURIComponent(username)}&projectName=${encodeURIComponent(projectName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch processing steps");
  }
  return res.json();
}

export async function getProjectProcessingProgress(username, projectName) {
  const url = `${API_BASE}/api/project-processing-progress?username=${encodeURIComponent(username)}&projectName=${encodeURIComponent(projectName)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch processing progress");
  }
  return data;
}

export async function triggerProcessingStep(username, projectName, step) {
  const res = await fetch(`${API_BASE}/api/trigger-processing-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectName, step }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to trigger processing step");
  }
  return data;
}

export async function getProjectMarkdown(username, projectName) {
  const url = `${API_BASE}/api/project-markdown?username=${encodeURIComponent(username)}&projectName=${encodeURIComponent(projectName)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch project markdown");
  }
  return data;
}

export async function submitProjectToc(username, projectName, tocString) {
  const res = await fetch(`${API_BASE}/api/parse-project-toc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, projectName, tocString }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.detail || "Failed to parse project TOC");
  }
  return data;
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
