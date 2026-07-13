import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  image_path: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const usePharmacy = () => {
  return useQuery({
    queryKey: ["pharmacy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Pharmacy[];
    },
  });
};

export const usePharmacyById = (id: string) => {
  return useQuery({
    queryKey: ["pharmacy", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Pharmacy;
    },
    enabled: !!id,
  });
};
