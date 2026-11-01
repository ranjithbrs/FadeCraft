import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Hash,
  Users,
  AlertCircle,
  Edit,
  Trash2,
  Download,
} from "lucide-react";
import { generateAppointmentPDF } from "@/components/appointments/AppointmentReceiptPDF";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

const AppointmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [appointment, setAppointment] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [hospital, setHospital] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [peopleAhead, setPeopleAhead] = useState<number>(0);
  const [currentlyServing, setCurrentlyServing] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !id) return;

    fetchAppointmentDetails();

    // Realtime postgres changes listener on appointments
    const channel = supabase
      .channel(`live-queue-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          fetchAppointmentDetails();
        }
      )
      .subscribe();

    // Polling fallback every 10s
    const pollInterval = setInterval(() => {
      fetchAppointmentDetails();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [id, user]);

  const fetchAppointmentDetails = async () => {
    try {
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      if (appointmentError) throw appointmentError;
      setAppointment(appointmentData);

      // Calculate queue positions
      if (appointmentData?.token_number && appointmentData?.doctor_id && appointmentData?.appointment_date) {
        // Count how many people are ahead in scheduled/confirmed status
        const { count } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("doctor_id", appointmentData.doctor_id)
          .eq("appointment_date", appointmentData.appointment_date)
          .lt("token_number", appointmentData.token_number)
          .in("status", ["scheduled", "confirmed"]);

        setPeopleAhead(count ?? 0);

        // Fetch currently lowest active token
        const { data: lowestActive } = await supabase
          .from("appointments")
          .select("token_number")
          .eq("doctor_id", appointmentData.doctor_id)
          .eq("appointment_date", appointmentData.appointment_date)
          .in("status", ["scheduled", "confirmed"])
          .order("token_number", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (lowestActive?.token_number) {
          setCurrentlyServing(lowestActive.token_number);
        } else {
          setCurrentlyServing(appointmentData.token_number);
        }
      }

      const { data: doctorData, error: doctorError } = await supabase
        .from("doctors")
        .select("*")
        .eq("id", appointmentData.doctor_id)
        .single();

      if (doctorError) throw doctorError;
      setDoctor(doctorData);

      const { data: hospitalData, error: hospitalError } = await supabase
        .from("hospitals")
        .select("*")
        .eq("id", appointmentData.hospital_id)
        .single();

      if (hospitalError) throw hospitalError;
      setHospital(hospitalData);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      toast({
        title: "Error",
        description: "Failed to load appointment details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment cancelled successfully",
      });
      navigate("/appointments");
    } catch (error: any) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to cancel appointment",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
      case "confirmed":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleDownloadPDF = () => {
    if (appointment && doctor && hospital) {
      generateAppointmentPDF(appointment, doctor, hospital);
      toast({
        title: "Downloaded",
        description: "Appointment confirmation saved as PDF",
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container py-6">
          <div className="text-center">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!appointment || !doctor || !hospital) {
    return (
      <MainLayout>
        <div className="container py-6">
          <div className="text-center">Appointment not found</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-6 px-4 max-w-4xl mx-auto min-h-screen text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100">Chair Pass & Reservation</h1>
            <p className="text-xs text-slate-400">Show this pass at the salon reception desk</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs font-bold px-3 py-1">
            {appointment.status.toUpperCase()}
          </Badge>
        </div>

        {/* VIP Token Card with Live Queue Status */}
        {appointment.token_number && (
          <Card className="mb-6 bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 shadow-2xl shadow-amber-500/10 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                    <Hash className="h-3.5 w-3.5" />
                    <span>{appointment.token_type === 'vip' ? 'VIP FAST-TRACK PASS' : 'CHAIR RESERVATION PASS'}</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                    <span>LIVE QUEUE</span>
                  </div>
                </div>

                <div className="text-6xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent mb-2 tracking-tight">
                  #{appointment.token_number}
                </div>

                {peopleAhead === 0 ? (
                  <div className="mb-4 inline-block px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm">
                    ✨ Your chair is ready! Please proceed to the stylist station.
                  </div>
                ) : (
                  <div className="mb-4 inline-block px-4 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium">
                    Stylist is currently attending Chair Token #{currentlyServing || 1}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-semibold">Clients Ahead</span>
                    </div>
                    <div className="text-xl font-bold text-slate-100">
                      {peopleAhead} {peopleAhead === 1 ? 'client' : 'clients'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-semibold">Est. Wait</span>
                    </div>
                    <div className="text-xl font-bold text-slate-100">
                      ~{peopleAhead === 0 ? 0 : Math.max(5, peopleAhead * 20)} mins
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reservation Information */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold">Reservation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Date</p>
                <p className="text-sm font-medium text-slate-100">
                  {format(new Date(appointment.appointment_date), "PPP")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Time</p>
                <p className="text-sm font-medium text-slate-100">
                  {appointment.appointment_time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Service Category</p>
                <p className="text-sm font-medium text-slate-100 capitalize">
                  {appointment.appointment_type || "Signature Styling"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stylist Information */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold">Master Stylist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              {doctor.photo ? (
                <img
                  src={doctor.photo}
                  alt={doctor.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl">
                  FC
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-base text-slate-100">{doctor.name}</h3>
                <p className="text-xs text-amber-400 font-semibold mt-0.5">
                  {doctor.specialization || "Fade Specialist"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {doctor.experience || 5}+ years master grooming experience
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Studio Information */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold">Studio Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{hospital.name}</h3>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-amber-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-300">{hospital.address}</p>
                <p className="text-xs text-slate-500">
                  {hospital.city}, {hospital.state} - {hospital.pincode}
                </p>
              </div>
            </div>
            {hospital.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-amber-400" />
                <p className="text-xs text-slate-300">{hospital.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <Button
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
            onClick={handleDownloadPDF}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Digital VIP Pass (PDF)
          </Button>
        </div>

        {(appointment.status === "scheduled" || appointment.status === "confirmed") && (
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => toast({ title: "Reschedule feature coming soon!" })}
            >
              <Edit className="h-4 w-4 mr-2" />
              Reschedule
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancel Appointment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this appointment? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelAppointment}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling..." : "Yes, Cancel"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AppointmentDetail;