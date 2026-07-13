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
            <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
            <p className="text-muted-foreground">
              Dr. {doctorProfile.name} — {doctorProfile.specialization}
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            <Users className="h-4 w-4 mr-1" />
            {queue.length} in queue
          </Badge>
        </div>

        {/* Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading queue...</p>
            ) : queue.length === 0 ? (
              <p className="text-muted-foreground">No patients in queue today</p>
            ) : (
              <div className="space-y-3">
                {queue.map((item: any) => (
                  <div
                    key={item.appointment_id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center min-w-[50px]">
                        <span className="text-xs text-muted-foreground">Token</span>
                        <span className="text-xl font-bold">{item.token_number}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {item.patient_name || "Unknown"}
                          </p>
                          {item.token_type === "priority" ? (
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              <Crown className="h-3 w-3 mr-1" /> Priority
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Ticket className="h-3 w-3 mr-1" /> Normal
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Time: {item.appointment_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[item.status] || ""}>
                        {item.status}
                      </Badge>
                      {item.status === "scheduled" || item.status === "confirmed" ? (
                        <Button
                          size="sm"
                          onClick={() => handleStartConsultation(item.appointment_id)}
                        >
                          <Play className="h-4 w-4 mr-1" /> Start
                        </Button>
                      ) : item.status === "in_consultation" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setCompleteDialog(item.appointment_id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Complete
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

      {/* Complete Consultation Dialog */}
      <Dialog open={!!completeDialog} onOpenChange={() => setCompleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Consultation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Consultation Notes</Label>
              <Textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                placeholder="Brief notes about the consultation..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date (Optional)</Label>
              <Input
                type="date"
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
