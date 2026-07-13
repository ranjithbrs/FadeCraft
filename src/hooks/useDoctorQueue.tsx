import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDoctorQueue = (doctorId: string | undefined, date?: string) => {
  return useQuery({
    queryKey: ["doctor-queue", doctorId, date],
    queryFn: async () => {
      if (!doctorId) throw new Error("Doctor ID required");
      const { data, error } = await supabase.rpc("get_doctor_queue", {
        p_doctor_id: doctorId,
        p_date: date || new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!doctorId,
    refetchInterval: 10000, // Live refresh every 10s
  });
};

export const useUpdateConsultationStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      status,
      followUpDate,
      consultationNotes,
    }: {
      appointmentId: string;
      status: string;
      followUpDate?: string;
      consultationNotes?: string;
    }) => {
      const updateData: any = { status };
      if (followUpDate) updateData.follow_up_date = followUpDate;
      if (consultationNotes) updateData.consultation_notes = consultationNotes;

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-queue"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });
};

export const useDoctorByEmail = (email: string | undefined) => {
  return useQuery({
    queryKey: ["doctor-by-email", email],
    queryFn: async () => {
      if (!email) throw new Error("Email required");
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!email,
  });
};
