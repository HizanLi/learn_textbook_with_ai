import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Study from "./pages/Study";
import Explain from "./pages/Explain";
import SectionLab from "./pages/SectionLab";

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/study/:projectId" element={<Study />} />
        <Route path="/section-lab/:chapterId/:sectionId/:mode" element={<SectionLab />} />
        <Route path="/explain/:keypointId" element={<Explain />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </UserProvider>
  );
}