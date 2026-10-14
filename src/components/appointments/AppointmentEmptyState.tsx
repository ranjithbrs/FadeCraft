import { Scissors, Clock, XCircle } from "lucide-react";

interface AppointmentEmptyStateProps {
  type: "upcoming" | "past" | "cancelled";
}

export const AppointmentEmptyState = ({ type }: AppointmentEmptyStateProps) => {
  const config = {
    upcoming: {
      icon: Scissors,
      message: "No active chair passes",
      description: "Book a chair with a master stylist to skip the salon queue",
    },
    past: {
      icon: Clock,
      message: "No past grooming sessions",
      description: "Your completed cuts and styles will appear here",
    },
    cancelled: {
      icon: XCircle,
      message: "No cancelled passes",
      description: "Cancelled passes will appear here",
    },
  };

  const { icon: Icon, message, description } = config[type];

  return (
    <div className="text-center py-16 px-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-amber-400" />
      </div>
      <p className="text-slate-200 font-bold text-base">{message}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  );
};
