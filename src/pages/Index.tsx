import { MainLayout } from "@/components/layout/MainLayout";
import { QuickActions } from "@/components/home/QuickActions";
import { SearchBar } from "@/components/home/SearchBar";
import { CategoryCards } from "@/components/home/CategoryCards";
import { FeaturedHospitals } from "@/components/home/FeaturedHospitals";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Stethoscope, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

const PatientFollowUp = ({ userId }: { userId: string }) => {
  const { data: nextFollowUp } = useQuery({
    queryKey: ["patient-followup", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("follow_up_date, doctors:doctors(name)")
        .eq("user_id", userId)
        .not("follow_up_date", "is", null)
        .gte("follow_up_date", new Date().toISOString().split("T")[0])
        .order("follow_up_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  if (!nextFollowUp) return null;

  return (
    <Card className="mx-4 mb-4 border-amber-500/30 bg-slate-900/90 shadow-lg shadow-black/40">
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <CalendarCheck className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-100">Upcoming Chair Reservation</p>
          <p className="text-xs text-slate-400">
            Stylist: {(nextFollowUp.doctors as any)?.name || "Master Stylist"} &bull;{" "}
            {format(new Date(nextFollowUp.follow_up_date!), "MMM dd, yyyy")}
          </p>
        </div>
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Reserved</Badge>
      </CardContent>
    </Card>
  );
};

const Index = () => {
  useProfileCompletion();
  const { isAdmin, isDoctor, user, loading } = useUserRole();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const displayName =
    authUser?.user_metadata?.full_name?.split(" ")[0] || "Gentleman";

  return (
    <MainLayout>
      <div className="bg-slate-950 text-slate-100 min-h-screen max-w-7xl mx-auto pb-24">
        {/* Luxury Obsidian & Gold Hero Banner */}
        <div className="relative px-5 pt-7 pb-12 rounded-b-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800/80 overflow-hidden shadow-2xl">
          {/* Subtle gold decorative glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-10 w-48 h-48 bg-amber-600/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE QUEUES ACTIVE</span>
            </div>

            <p className="text-slate-400 text-sm font-medium">
              {greeting}, {displayName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-slate-100">
              Precision Cuts. <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">Zero Waiting.</span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-md">
              Skip barber shop queues. Reserve your chair & check in with a digital VIP pass.
            </p>
          </div>
        </div>

        {/* SearchBar overlapping the banner */}
        <div className="-mt-6 px-4 mb-3 relative z-20">
          <SearchBar />
        </div>

        {/* Role-based quick access */}
        {!loading && (isAdmin || isDoctor) && (
          <div className="flex gap-2 px-4 pt-1 pb-2">
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all"
              >
                <Shield className="h-4 w-4" /> Studio Admin
              </button>
            )}
            {isDoctor && (
              <button
                onClick={() => navigate("/doctor-dashboard")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all"
              >
                <Stethoscope className="h-4 w-4" /> Barber Chair Queue
              </button>
            )}
          </div>
        )}

        {/* Chair reservation reminder */}
        {user && <PatientFollowUp userId={user.id} />}

        <QuickActions />
        <FeaturedHospitals />
        <CategoryCards />
      </div>
    </MainLayout>
  );
};

export default Index;
