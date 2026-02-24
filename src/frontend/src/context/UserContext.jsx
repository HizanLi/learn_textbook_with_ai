import React, { createContext, useEffect, useMemo, useState } from "react";

export const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("username");
    if (saved) {
      setUsername(saved);
    }
  }, []);

  const value = useMemo(() => ({ username, setUsername }), [username]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}