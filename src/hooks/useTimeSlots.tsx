import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlot {
  slot_time: string;
  is_booked: boolean;
}

export const useAvailableSlots = (doctorId: string | undefined, date: string | undefined) => {
  return useQuery({
    queryKey: ["timeSlots", doctorId, date],
    queryFn: async () => {
      if (!doctorId || !date) throw new Error("Doctor ID and date are required");

      const { data, error } = await supabase.rpc("get_available_slots", {
        p_doctor_id: doctorId,
        p_date: date,
      });

      if (error) throw error;
      return data as TimeSlot[];
    },
    enabled: !!doctorId && !!date,
  });
};
