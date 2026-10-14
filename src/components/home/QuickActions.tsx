import { Scissors, Clock, Sparkles, QrCode } from "lucide-react";
import { Link } from "react-router-dom";

export const QuickActions = () => {
  return (
    <div className="grid grid-cols-2 gap-3.5 px-4 py-3">
      {/* Book Chair - Gold Gradient */}
      <Link to="/search" className="group">
        <div className="w-full h-28 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all duration-200 relative overflow-hidden border border-amber-400/30">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-slate-950/20 flex items-center justify-center">
            <Scissors className="h-6 w-6 text-slate-950 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold text-slate-950 text-center leading-tight tracking-tight">
            Book a Chair
          </span>
        </div>
      </Link>

      {/* Live Queue Tracker - Dark Obsidian */}
      <Link to="/appointments" className="group">
        <div className="w-full h-28 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-md active:scale-95 transition-all duration-200 relative overflow-hidden hover:border-amber-500/40">
          <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-400 stroke-[2.2]" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-slate-100 text-center leading-tight tracking-tight">
              Live Chair Queue
            </span>
            <span className="text-[10px] text-amber-400/80 font-medium mt-0.5">
              Check wait times
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
};
