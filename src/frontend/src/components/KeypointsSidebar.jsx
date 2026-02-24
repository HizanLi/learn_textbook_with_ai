import React from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function KeypointsSidebar({ sections }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-slate-800 mb-2">{section.title}</h3>
          <div className="space-y-2">
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  navigate(`/explain/${item.id}`, {
                    state: { item, sectionTitle: section.title },
                  })
                }
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100"
              >
                <span className="text-sm font-medium text-slate-700">{item.title}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}