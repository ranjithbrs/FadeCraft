import { Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export const QuickActions = () => {
  return (
    <div className="grid grid-cols-2 gap-4 px-4 py-3">
      {/* Book Appointment - Filled Blue */}
      <Link to="/search" className="group">
        <div className="w-full h-28 bg-primary rounded-2xl flex flex-col items-center justify-center gap-2 shadow-md active:scale-95 transition-transform duration-150 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Calendar className="h-7 w-7 text-white" />
          <span className="text-sm font-semibold text-white text-center leading-tight">
            Book Appointment
          </span>
        </div>
      </Link>

      {/* View Appointments - Outlined */}
      <Link to="/appointments" className="group">
        <div className="w-full h-28 bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform duration-150 relative overflow-hidden">
          <div className="absolute inset-0 bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Clock className="h-7 w-7 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 text-center leading-tight">
            View Appointments
          </span>
        </div>
      </Link>
    </div>
  );
};
