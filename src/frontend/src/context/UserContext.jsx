import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

export const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [username, setUsername] = useState("");
  const [userStatus, setUserStatus] = useState({
    uploadedProjects: [],
    currentProject: null,
  });
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({
    backend: "loading",
    core: "loading",
    minerU: "loading"
  });

  const checkHealth = useCallback(async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setHealth({
          backend: data.services.backend,
          core: data.services.core,
          minerU: data.services.minerU
        });
      } else {
        throw new Error();
      }
    } catch (err) {
      setHealth({ backend: "error", core: "error", minerU: "error" });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    const saved = localStorage.getItem("username");
    if (saved) {
      setUsername(saved);
    }
  }, []);

  const loadUserStatus = useCallback(async (user) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:4000"}/api/user-status?username=${encodeURIComponent(user)}`
      );
      if (res.ok) {
        const status = await res.json();
        setUserStatus(status);
      }
    } catch (err) {
      console.error("Failed to load user status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (username) {
      loadUserStatus(username);
    }
  }, [username, loadUserStatus]);

  const value = useMemo(
    () => ({
      username,
      setUsername,
      userStatus,
      setUserStatus,
      loading,
      loadUserStatus,
      health,
      checkHealth,
    }),
    [username, userStatus, loading, loadUserStatus, health, checkHealth]
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}