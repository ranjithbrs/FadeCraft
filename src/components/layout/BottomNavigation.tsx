import { Home, Ticket, Search, User, Shield, Scissors } from "lucide-react";
import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

export const BottomNavigation = () => {
  const { isAdmin, isDoctor } = useUserRole();

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin" }] : []),
    ...(isDoctor ? [{ to: "/doctor-dashboard", icon: Scissors, label: "Stylist Queue" }] : []),
    { to: "/appointments", icon: Ticket, label: "Passes" },
    { to: "/search", icon: Search, label: "Salons" },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around h-16 relative">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 relative z-10",
                isActive ? "text-amber-400 scale-105" : "text-slate-400 hover:text-slate-200"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <div className="h-10 w-10 bg-amber-500/15 rounded-xl blur-md" />
                  </div>
                )}
                <item.icon className={cn("h-5 w-5 transition-transform", isActive ? "stroke-[2.5px] text-amber-400" : "stroke-2")} />
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", isActive ? "opacity-100 text-amber-400 font-extrabold" : "opacity-60")}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 h-1 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
                )}
              </>
            )}
          </RouterNavLink>
        ))}
      </div>
    </nav>
  );
};
