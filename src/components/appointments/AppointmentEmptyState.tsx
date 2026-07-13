import { Calendar, Clock, XCircle } from "lucide-react";

interface AppointmentEmptyStateProps {
  type: "upcoming" | "past" | "cancelled";
}

export const AppointmentEmptyState = ({ type }: AppointmentEmptyStateProps) => {
  const config = {
    upcoming: {
      icon: Calendar,
      message: "No upcoming appointments",
      description: "Book an appointment to get started",
    },
    past: {
      icon: Clock,
      message: "No past appointments",
      description: "Your completed appointments will appear here",
    },
    cancelled: {
      icon: XCircle,
      message: "No cancelled appointments",
      description: "Cancelled appointments will appear here",
    },
  };

  const { icon: Icon, message, description } = config[type];

  return (
    <div className="text-center py-12">
      <Icon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
      <p className="text-muted-foreground font-medium">{message}</p>
      <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
    </div>
  );
};
