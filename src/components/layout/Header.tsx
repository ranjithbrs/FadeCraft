import { Bell, Menu, Scissors, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const Header = () => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 pt-[env(safe-area-inset-top)] text-slate-100 transition-colors">
      <div className="flex h-14 items-center justify-between px-4 max-w-7xl mx-auto">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-slate-900 text-slate-300 -ml-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-slate-950 border-r border-slate-800 text-slate-100">
              <div className="flex items-center gap-2 mb-6 mt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-lg shadow-lg shadow-amber-500/20">
                  <Scissors className="h-5 w-5" />
                </div>
                <span className="text-xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                  FadeCraft
                </span>
              </div>
              <nav className="flex flex-col gap-4">
                <Link to="/search" className="text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                  Explore Salons & Barbers
                </Link>
                <Link to="/appointments" className="text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                  My Chair Queue & Passes
                </Link>
                <Link to="/settings" className="text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                  Settings & Preferences
                </Link>
                <Link to="/support" className="text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                  Concierge Support
                </Link>
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Scissors className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent leading-none">
                FadeCraft
              </span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mt-0.5">
                Barber & Salon
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              {/* VIP / Queue status shortcut */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-full px-3"
                asChild
              >
                <Link to="/appointments">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>VIP Pass</span>
                </Link>
              </Button>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative hover:bg-slate-900 text-slate-300"
                asChild
              >
                <Link to="/notifications">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400 border-2 border-slate-950" />
                </Link>
              </Button>

              {/* Avatar */}
              <Link to="/profile" className="ml-1">
                <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-amber-500/50 hover:ring-amber-400 transition-all">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-black text-xs">
                    {user.user_metadata?.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </>
          ) : (
            <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
