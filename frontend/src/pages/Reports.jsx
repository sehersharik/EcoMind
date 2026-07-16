import React from "react";
import { toast } from "sonner";
import { FileText, Download, Leaf, TrendingUp } from "lucide-react";
import { API } from "@/lib/api";
import api from "@/lib/api";

export default function Reports() {
  const download = async () => {
    try {
      const token = localStorage.getItem("ecomind_token");
      const res = await fetch(`${API}/reports/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ecomind-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Could not generate report");
    }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get("/user/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ecomind-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="p-8 max-w-[1200px]" data-testid="reports-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Reports</div>
        <h1 className="font-display font-bold text-4xl tracking-tight">Your Sustainability Report</h1>
        <p className="text-zinc-500 mt-1">Download a beautiful PDF with every metric that matters.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-5 glow-emerald">
            <Leaf className="w-6 h-6 text-black" />
          </div>
          <h3 className="font-display font-semibold text-2xl mb-2">Sustainability PDF</h3>
          <p className="text-zinc-500 text-sm mb-6">
            Includes eco score, total carbon/water/energy/cost saved, recent optimizations, and personalized recommendations.
          </p>
          <button
            onClick={download}
            data-testid="download-pdf-btn"
            className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold text-sm glow-emerald flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>

        <div className="glass rounded-3xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="font-display font-semibold text-2xl mb-2">Raw JSON Export</h3>
          <p className="text-zinc-500 text-sm mb-6">
            Full dump of your prompts, chats, messages, and stats. Use it for analysis or migration.
          </p>
          <button
            onClick={exportData}
            data-testid="export-json-btn"
            className="w-full py-3 rounded-full glass border border-white/10 hover:bg-white/5 text-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
