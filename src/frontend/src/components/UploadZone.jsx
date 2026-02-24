import React, { useRef } from "react";
import { UploadCloud } from "lucide-react";

export default function UploadZone({ onFileSelected, isLoading }) {
  const inputRef = useRef(null);

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileSelected(event.dataTransfer.files[0]);
    }
  };

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-white"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md"
        onChange={(e) => e.target.files[0] && onFileSelected(e.target.files[0])}
        className="hidden"
      />
      <UploadCloud className="h-10 w-10 text-blue-500 mx-auto mb-3" />
      <p className="font-medium">Drag & drop a textbook here</p>
      <p className="text-sm text-slate-500">PDF, Markdown, or text files</p>
      <button
        type="button"
        disabled={isLoading}
        onClick={handleBrowse}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        {isLoading ? "Uploading..." : "Browse files"}
      </button>
    </div>
  );
}