import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDoctorQueue, useUpdateConsultationStatus, useDoctorByEmail } from "@/hooks/useDoctorQueue";
import { useUserRole } from "@/hooks/useUserRole";
import { Users, Play, CheckCircle, Crown, Ticket } from "lucide-react";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  in_consultation: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const DoctorDashboard = () => {
  const { user } = useUserRole();
  const { data: doctorProfile } = useDoctorByEmail(user?.email || undefined);
  const [selectedDate] = useState(new Date().toISOString().split("T")[0]);
  const { data: queue = [], isLoading } = useDoctorQueue(doctorProfile?.id, selectedDate);
  const updateStatus = useUpdateConsultationStatus();

  const [completeDialog, setCompleteDialog] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [consultationNotes, setConsultationNotes] = useState("");

  const handleStartConsultation = (appointmentId: string) => {
    updateStatus.mutate({ appointmentId, status: "in_consultation" });
  };

  const handleCompleteConsultation = () => {
    if (!completeDialog) return;
    updateStatus.mutate(
      {
        appointmentId: completeDialog,
        status: "completed",
        followUpDate: followUpDate || undefined,
        consultationNotes: consultationNotes || undefined,
      },
      {
        onSuccess: () => {
          setCompleteDialog(null);
          setFollowUpDate("");
          setConsultationNotes("");
        },
      }
    );
  };

  if (!doctorProfile) {
    return (
      <MainLayout>
        <div className="container py-6">
          <p className="text-center text-muted-foreground">
            No doctor profile linked to your account. Contact admin.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-100">Stylist Chair Queue</h1>
            <p className="text-xs text-amber-400 font-semibold mt-0.5">
              Master Stylist {doctorProfile.name} &bull; {doctorProfile.specialization || "Fade Specialist"}
            </p>
          </div>
          <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-300 text-sm px-3 py-1 font-bold">
            <Users className="h-4 w-4 mr-1.5" />
            {queue.length} in Queue
          </Badge>
        </div>

        {/* Queue */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-100">Today's Chair Lineup</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-slate-400 text-sm">Loading queue...</p>
            ) : queue.length === 0 ? (
              <p className="text-slate-400 text-sm">No clients currently waiting in your chair queue.</p>
            ) : (
              <div className="space-y-3">
                {queue.map((item: any) => (
                  <div
                    key={item.appointment_id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/60"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center min-w-[50px] px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Pass</span>
                        <span className="text-xl font-black text-amber-300">#{item.token_number}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-100 text-sm">
                            {item.patient_name || "Guest Client"}
                          </p>
                          {item.token_type === "priority" ? (
                            <Badge className="bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                              <Crown className="h-3 w-3 mr-1" /> VIP Member
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                              <Ticket className="h-3 w-3 mr-1" /> Standard
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Scheduled: {item.appointment_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                        {item.status === "in_consultation" ? "In Chair" : item.status}
                      </Badge>
                      {item.status === "scheduled" || item.status === "confirmed" ? (
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                          onClick={() => handleStartConsultation(item.appointment_id)}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" /> Call to Chair
                        </Button>
                      ) : item.status === "in_consultation" ? (
                        <Button
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                          onClick={() => setCompleteDialog(item.appointment_id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Finish Cut
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Complete Cut Dialog */}
      <Dialog open={!!completeDialog} onOpenChange={() => setCompleteDialog(null)}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100 font-bold">Finish Grooming Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-semibold">Grooming & Styling Notes (Optional)</Label>
              <Textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                placeholder="E.g., Low skin fade, tapered beard, used matte sea salt spray..."
                rows={3}
                className="bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-semibold">Recommended Next Trim Date</Label>
              <Input
                type="date"
                className="bg-slate-900 border-slate-800 text-slate-100 text-xs"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteConsultation}>
              Complete Consultation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default DoctorDashboard;
