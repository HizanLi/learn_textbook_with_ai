import React, { createContext, useEffect, useMemo, useState } from "react";

export const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [username, setUsername] = useState("");
  const [userStatus, setUserStatus] = useState({
    uploadedProjects: [],
    currentProject: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("username");
    if (saved) {
      setUsername(saved);
    }
  }, []);

  const loadUserStatus = async (user) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:5001"}/api/user-status?username=${encodeURIComponent(user)}`
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
  };

  useEffect(() => {
    if (username) {
      loadUserStatus(username);
    }
  }, [username]);

  const value = useMemo(
    () => ({
      username,
      setUsername,
      userStatus,
      setUserStatus,
      loading,
      loadUserStatus,
    }),
    [username, userStatus, loading]
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}