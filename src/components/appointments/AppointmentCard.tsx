import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface AppointmentCardProps {
  appointment: {
    id: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    token_number: number | null;
    doctors?: {
      name: string;
      specialization: string;
      photo: string | null;
    };
    hospitals?: {
      name: string;
    };
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "scheduled":
      return "bg-blue-500";
    case "confirmed":
      return "bg-emerald-500";
    case "completed":
      return "bg-green-500";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
};

export const AppointmentCard = ({ appointment }: AppointmentCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer bg-slate-900 border border-slate-800/90 hover:border-amber-500/50 transition-all duration-300 rounded-2xl shadow-lg shadow-black/40 text-slate-100 group"
      onClick={() => navigate(`/appointment/${appointment.id}`)}
    >
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3.5 flex-1">
            {appointment.doctors?.photo ? (
              <img
                src={appointment.doctors.photo}
                alt={appointment.doctors.name}
                className="w-14 h-14 rounded-xl object-cover border border-slate-700/60"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                FC
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                {appointment.doctors?.name || "Master Stylist"}
              </h3>
              <p className="text-xs text-amber-400/90 font-medium">
                {appointment.doctors?.specialization || "Precision Cuts & Grooming"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {appointment.hospitals?.name || "The Royal Fade Studio"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[11px] font-semibold">
              {getStatusLabel(appointment.status)}
            </Badge>
            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            <span>{format(new Date(appointment.appointment_date), "PP")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>{appointment.appointment_time}</span>
          </div>
        </div>

        {appointment.token_number && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400">Chair Queue Position:</span>
            <span className="text-xs font-black px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300">
              Pass #{appointment.token_number}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
