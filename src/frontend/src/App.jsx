import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Explain from "./pages/Explain";

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/explain/:keypointId" element={<Explain />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </UserProvider>
  );
}