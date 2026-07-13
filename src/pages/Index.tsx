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
    <Card className="mx-4 mb-4 border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Next Follow-up Visit</p>
          <p className="text-xs text-muted-foreground">
            Dr. {(nextFollowUp.doctors as any)?.name} —{" "}
            {format(new Date(nextFollowUp.follow_up_date!), "MMM dd, yyyy")}
          </p>
        </div>
        <Badge variant="outline">Upcoming</Badge>
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
  const firstName =
    authUser?.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <MainLayout>
      <div className="bg-white min-h-screen max-w-7xl mx-auto">
        {/* Purple gradient greeting banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          }}
          className="px-5 pt-5 pb-10 rounded-b-3xl"
        >
          <p className="text-white/80 text-sm font-medium">
            {greeting},
          </p>
          <h1 className="text-white text-2xl font-bold">{firstName} ??</h1>
          <p className="text-white/70 text-xs mt-1">
            Find doctors & hospitals near you
          </p>
        </div>

        {/* SearchBar overlapping the banner */}
        <div className="-mt-6 px-4 mb-2">
          <SearchBar />
        </div>

        {/* Role-based quick access */}
        {!loading && (isAdmin || isDoctor) && (
          <div className="flex gap-2 px-4 pt-2 pb-1">
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold"
              >
                <Shield className="h-4 w-4" /> Admin Dashboard
              </button>
            )}
            {isDoctor && (
              <button
                onClick={() => navigate("/doctor-dashboard")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold"
              >
                <Stethoscope className="h-4 w-4" /> My Queue
              </button>
            )}
          </div>
        )}

        {/* Patient follow-up reminder */}
        {user && <PatientFollowUp userId={user.id} />}

        <QuickActions />
        <FeaturedHospitals />
        <CategoryCards />
      </div>
    </MainLayout>
  );
};

export default Index;
