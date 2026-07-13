import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience: number;
  consultation_fee: number;
  rating: number | null;
  total_reviews: number | null;
  hospital_id: string;
  photo: string | null;
  availability_status: string | null;
  about?: string | null;
  education?: string | null;
  languages?: string[] | null;
}

// Fields to select from doctors table - excludes email for security
const DOCTOR_PUBLIC_FIELDS = `
  id, name, specialization, qualification, experience,
  consultation_fee, rating, total_reviews, hospital_id,
  photo, availability_status, about, education, languages,
  created_at, updated_at
`;

interface UseDoctorsOptions {
  searchText?: string;
  specialization?: string;
  hospitalId?: string;
}

export const useDoctors = (options: UseDoctorsOptions = {}) => {
  return useQuery({
    queryKey: ["doctors", options],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_doctors", {
        search_text: options.searchText || null,
        specialization_filter: options.specialization || null,
        hospital_id_filter: options.hospitalId || null,
        limit_count: 20,
        offset_count: 0,
      });

      if (error) throw error;
      return data as Doctor[];
    },
  });
};

export const useDoctorById = (id: string | undefined) => {
  return useQuery({
    queryKey: ["doctor", id],
    queryFn: async () => {
      if (!id) throw new Error("Doctor ID is required");

      // Query doctors table with explicit field selection (excludes email for security).
      // RLS + REVOKE on (email) ensures public can read only safe doctor fields.
      const { data: doctorData, error: doctorError } = await supabase
        .from("doctors")
        .select(DOCTOR_PUBLIC_FIELDS)
        .eq("id", id)
        .maybeSingle();

      if (doctorError) throw doctorError;
      if (!doctorData) return null;

      // Fetch hospital separately since views don't support joins
      let hospital = null;
      if (doctorData.hospital_id) {
        const { data: hospitalData } = await supabase
          .from("hospitals")
          .select("*")
          .eq("id", doctorData.hospital_id)
          .maybeSingle();
        hospital = hospitalData;
      }

      return { ...doctorData, hospitals: hospital } as Doctor & { hospitals: any };
    },
    enabled: !!id,
  });
};

export const useDoctorsByHospital = (hospitalId: string | undefined) => {
  return useQuery({
    queryKey: ["doctors", "hospital", hospitalId],
    queryFn: async () => {
      if (!hospitalId) throw new Error("Hospital ID is required");

      // Query doctors table with explicit field selection (excludes email for security)
      const { data, error } = await supabase
        .from("doctors")
        .select(DOCTOR_PUBLIC_FIELDS)
        .eq("hospital_id", hospitalId)
        .neq("availability_status", "inactive");

      if (error) throw error;
      return data as Doctor[];
    },
    enabled: !!hospitalId,
  });
};
