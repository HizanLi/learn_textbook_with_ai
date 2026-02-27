import React, { useRef } from "react";
import { UploadCloud } from "lucide-react";

export default function UploadZone({ onFileSelected, isLoading }) {
  const inputRef = useRef(null);

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      files.forEach((file) => onFileSelected(file));
    }
  };

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      files.forEach((file) => onFileSelected(file));
    }
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
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <UploadCloud className="h-10 w-10 text-blue-500 mx-auto mb-3" />
      <p className="font-medium">Drag & drop textbooks here</p>
      <p className="text-sm text-slate-500">PDF, Markdown, or text files (multiple supported)</p>
      <button
        type="button"
        disabled={isLoading}
        onClick={handleBrowse}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-blue-400"
      >
        {isLoading ? "Uploading..." : "Browse files"}
      </button>
    </div>
  );
}