import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments } from "@/hooks/useAppointments";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentEmptyState } from "@/components/appointments/AppointmentEmptyState";
import { Plus } from "lucide-react";

const Appointments = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: appointments = [], isLoading } = useAppointments(user?.id);

  const filteredAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      aptDate.setHours(0, 0, 0, 0);
      return (
        (apt.status === "scheduled" || apt.status === "confirmed") &&
        aptDate >= today
      );
    });

    const past = appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      aptDate.setHours(0, 0, 0, 0);
      return (
        apt.status === "completed" ||
        ((apt.status === "scheduled" || apt.status === "confirmed") &&
          aptDate < today)
      );
    });

    const cancelled = appointments.filter((apt) => apt.status === "cancelled");

    return { upcoming, past, cancelled };
  }, [appointments]);

  if (authLoading) {
    return (
      <MainLayout>
        <div className="container py-6">
          <div className="text-center">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <MainLayout>
      <div className="container py-6 px-4 max-w-4xl mx-auto min-h-screen text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100">My Chair Passes</h1>
            <p className="text-xs text-slate-400 mt-0.5">Track your live queue position and grooming passes</p>
          </div>
          <Button onClick={() => navigate("/search")} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20">
            <Plus className="h-4 w-4 mr-1.5" />
            Book a Chair
          </Button>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-800 text-slate-400">
            <TabsTrigger value="upcoming" className="relative data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=active]:font-bold transition-all">
              Active Passes
              {filteredAppointments.upcoming.length > 0 && (
                <span className="ml-2 bg-slate-950 text-amber-300 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {filteredAppointments.upcoming.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=active]:font-bold transition-all">Past Cuts</TabsTrigger>
            <TabsTrigger value="cancelled" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=active]:font-bold transition-all">Cancelled</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="space-y-4 mt-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="upcoming" className="space-y-4 mt-6">
                {filteredAppointments.upcoming.length > 0 ? (
                  filteredAppointments.upcoming.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))
                ) : (
                  <AppointmentEmptyState type="upcoming" />
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-4 mt-6">
                {filteredAppointments.past.length > 0 ? (
                  filteredAppointments.past.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))
                ) : (
                  <AppointmentEmptyState type="past" />
                )}
              </TabsContent>

              <TabsContent value="cancelled" className="space-y-4 mt-6">
                {filteredAppointments.cancelled.length > 0 ? (
                  filteredAppointments.cancelled.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))
                ) : (
                  <AppointmentEmptyState type="cancelled" />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Appointments;
