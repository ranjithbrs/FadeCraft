import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Payment {
  id: string;
  user_id: string;
  appointment_id: string;
  amount: number;
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: string;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  appointment?: {
    id: string;
    appointment_date: string;
    appointment_time: string;
    token_number: number | null;
    doctor?: {
      id: string;
      name: string;
      specialization: string;
      photo: string | null;
    } | null;
    hospital?: {
      id: string;
      name: string;
      address: string;
    } | null;
  };
}

export const usePayments = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["payments", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Fetch payments
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;
      if (!payments || payments.length === 0) return [];

      // Get unique appointment IDs
      const appointmentIds = [...new Set(payments.map(p => p.appointment_id))];

      // Fetch appointments
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, token_number, doctor_id, hospital_id")
        .in("id", appointmentIds);

      if (appointmentsError) throw appointmentsError;

      // Get unique doctor and hospital IDs
      const doctorIds = [...new Set(appointments?.map(a => a.doctor_id) || [])];
      const hospitalIds = [...new Set(appointments?.map(a => a.hospital_id) || [])];

      // Fetch doctors and hospitals in parallel
      const [doctorsResult, hospitalsResult] = await Promise.all([
        supabase.from("doctors").select("id, name, specialization, photo").in("id", doctorIds),
        supabase.from("hospitals").select("id, name, address").in("id", hospitalIds),
      ]);

      const doctors = doctorsResult.data || [];
      const hospitals = hospitalsResult.data || [];

      // Map data together
      const enrichedPayments: Payment[] = payments.map(payment => {
        const appointment = appointments?.find(a => a.id === payment.appointment_id);
        const doctor = appointment ? doctors.find(d => d.id === appointment.doctor_id) : null;
        const hospital = appointment ? hospitals.find(h => h.id === appointment.hospital_id) : null;

        return {
          ...payment,
          appointment: appointment ? {
            id: appointment.id,
            appointment_date: appointment.appointment_date,
            appointment_time: appointment.appointment_time,
            token_number: appointment.token_number,
            doctor: doctor || undefined,
            hospital: hospital || undefined,
          } : undefined,
        };
      });

      return enrichedPayments;
    },
    enabled: !!userId,
  });
};

export const usePaymentById = (paymentId: string | undefined) => {
  return useQuery({
    queryKey: ["payment", paymentId],
    queryFn: async () => {
      if (!paymentId) return null;

      // Fetch payment
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!payment) return null;

      // Fetch appointment
      const { data: appointment } = await supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, token_number, doctor_id, hospital_id")
        .eq("id", payment.appointment_id)
        .maybeSingle();

      if (!appointment) {
        return { ...payment, appointment: undefined } as Payment;
      }

      // Fetch doctor and hospital
      const [doctorResult, hospitalResult] = await Promise.all([
        supabase.from("doctors").select("id, name, specialization, photo").eq("id", appointment.doctor_id).maybeSingle(),
        supabase.from("hospitals").select("id, name, address").eq("id", appointment.hospital_id).maybeSingle(),
      ]);

      return {
        ...payment,
        appointment: {
          id: appointment.id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          token_number: appointment.token_number,
          doctor: doctorResult.data || undefined,
          hospital: hospitalResult.data || undefined,
        },
      } as Payment;
    },
    enabled: !!paymentId,
  });
};
