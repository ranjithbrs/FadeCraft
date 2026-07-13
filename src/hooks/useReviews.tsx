import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Public review interface (without user_id for privacy)
export interface PublicReview {
  id: string;
  doctor_id: string | null;
  hospital_id: string | null;
  rating: number;
  review: string | null;
  created_at: string;
}

// Full review interface for the user's own reviews
export interface Review extends PublicReview {
  user_id: string;
  updated_at: string;
}

export const useReviewsByDoctor = (doctorId: string | undefined) => {
  return useQuery({
    queryKey: ["reviews", "doctor", doctorId],
    queryFn: async () => {
      if (!doctorId) throw new Error("Doctor ID is required");

      // Use public_reviews view which excludes user_id for privacy
      const { data, error } = await supabase
        .from("public_reviews")
        .select("*")
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PublicReview[];
    },
    enabled: !!doctorId,
  });
};

export const useReviewsByHospital = (hospitalId: string | undefined) => {
  return useQuery({
    queryKey: ["reviews", "hospital", hospitalId],
    queryFn: async () => {
      if (!hospitalId) throw new Error("Hospital ID is required");

      // Use public_reviews view which excludes user_id for privacy
      const { data, error } = await supabase
        .from("public_reviews")
        .select("*")
        .eq("hospital_id", hospitalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PublicReview[];
    },
    enabled: !!hospitalId,
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewData: {
      doctor_id?: string;
      hospital_id?: string;
      rating: number;
      review?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Validate rating
      if (reviewData.rating < 1 || reviewData.rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }

      // Sanitize review text
      const sanitizedReview = reviewData.review
        ?.trim()
        .slice(0, 2000)
        .replace(/[<>]/g, "");

      const { data, error } = await supabase
        .from("reviews_ratings")
        .insert({
          doctor_id: reviewData.doctor_id,
          hospital_id: reviewData.hospital_id,
          rating: reviewData.rating,
          review: sanitizedReview || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["reviews", variables.doctor_id ? "doctor" : "hospital"] 
      });
      toast.success("Review submitted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to submit review: " + error.message);
    },
  });
};
