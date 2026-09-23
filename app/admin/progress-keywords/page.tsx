"use client";

import { useEffect, useState } from "react";

type ProgressKeyword = {
  keyword: string;
  label: string;
  description: string;
  enabled: boolean;
  webhook_url: string | null;
};

export default function ProgressKeywordsPage() {
  const [keywords, setKeywords] = useState<Record<string, ProgressKeyword>>({});
  const [loading, setLoading] = useState(true);
  
  // Form tambah
  const [newKeyword, setNewKeyword] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/progress-keywords");
      const data = await res.json();
      if (data.success) setKeywords(data.data || {});
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    load();
  }, []);
  
  const handleAdd = async () => {
    if (!newKeyword || !newLabel) {
      alert("Keyword & label wajib");
      return;
    }
    
    const res = await fetch("/api/progress-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: newKeyword,
        label: newLabel,
        description: newDescription,
        enabled: true,
      }),
    });
    
    const data = await res.json();
    if (data.success) {
      setNewKeyword("");
      setNewLabel("");
      setNewDescription("");
      load();
    } else {
      alert(`Gagal: ${data.message}`);
    }
  };
  
  const handleToggle = async (keyword: string, currentEnabled: boolean) => {
    const kw = keywords[keyword];
    const res = await fetch("/api/progress-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        label: kw.label,
        description: kw.description,
        enabled: !currentEnabled,
        webhook_url: kw.webhook_url,
      }),
    });
    const data = await res.json();
    if (data.success) load();
  };
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        🎯 Progress Keywords
      </h1>
      
      <p className="text-sm text-slate-500 mb-6">
        Kalau product title itemku ada keyword ini → tipe order jadi <b>PROGRESS</b> (bukan countdown).
        Contoh: product "Joki <b>Eternal</b> Egg" → progress order.
      </p>
      
      {/* Form Tambah */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border mb-6">
        <h2 className="font-bold mb-4">➕ Tambah Keyword Baru</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            type="text"
            placeholder="keyword (eternal)"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="border rounded-xl px-4 py-2"
          />
          <input
            type="text"
            placeholder="Label (Eternal Egg)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="border rounded-xl px-4 py-2"
          />
          <input
            type="text"
            placeholder="Deskripsi (opsional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="border rounded-xl px-4 py-2"
          />
        </div>
        <button
          onClick={handleAdd}
          className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2 rounded-xl"
        >
          Tambah
        </button>
      </div>
      
      {/* List Keywords */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(keywords).map(([keyword, config]) => (
            <div
              key={keyword}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 border flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-violet-600">
                    {keyword}
                  </span>
                  {!config.enabled && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold">{config.label}</p>
                {config.description && (
                  <p className="text-xs text-slate-500">{config.description}</p>
                )}
              </div>
              <button
                onClick={() => handleToggle(keyword, config.enabled)}
                className={`px-4 py-2 rounded-xl font-bold text-white ${
                  config.enabled
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                {config.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}