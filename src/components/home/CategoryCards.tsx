import { Scissors, Sparkles, Palette, Flame, Droplets, Crown, Zap, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const services = [
  { name: "Signature Fade", icon: Scissors, bg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-400", link: "/search?service=fade" },
  { name: "Beard Sculpt", icon: Sparkles, bg: "bg-orange-500/10 border-orange-500/20", iconColor: "text-orange-400", link: "/search?service=beard" },
  { name: "Hair Color", icon: Palette, bg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400", link: "/search?service=color" },
  { name: "Hot Shave", icon: Flame, bg: "bg-red-500/10 border-red-500/20", iconColor: "text-red-400", link: "/search?service=shave" },
  { name: "Hair Spa", icon: Droplets, bg: "bg-cyan-500/10 border-cyan-500/20", iconColor: "text-cyan-400", link: "/search?service=spa" },
  { name: "VIP Package", icon: Crown, bg: "bg-yellow-500/10 border-yellow-500/20", iconColor: "text-yellow-400", link: "/search?service=vip" },
  { name: "Express Trim", icon: Zap, bg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400", link: "/search?service=trim" },
  { name: "Top Stylists", icon: UserCheck, bg: "bg-blue-500/10 border-blue-500/20", iconColor: "text-blue-400", link: "/search" },
];

export const CategoryCards = () => {
  return (
    <div className="px-4 py-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Grooming Services</h2>
          <p className="text-xs text-slate-400">Select a service to find available chairs</p>
        </div>
        <Link to="/search" className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
          View All &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {services.map((service) => (
          <Link key={service.name} to={service.link} className="group">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl border flex items-center justify-center active:scale-95 transition-all duration-200 group-hover:scale-105 group-hover:border-amber-400/50 shadow-sm",
                  service.bg
                )}
              >
                <service.icon className={cn("h-6 w-6 transition-transform group-hover:rotate-6", service.iconColor)} />
              </div>
              <span className="text-[11px] text-center font-medium text-slate-300 leading-tight group-hover:text-amber-300 transition-colors">
                {service.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
