import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  checking: boolean;
}

export const useProfileCompletion = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProfileCompletionStatus>({
    isComplete: true,
    missingFields: [],
    checking: true,
  });
  const [hasShownNotification, setHasShownNotification] = useState(false);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (authLoading || !user) {
        setStatus({ isComplete: true, missingFields: [], checking: false });
        return;
      }

      // Check if we've already shown notification this session
      const notificationShown = sessionStorage.getItem(`profile_notification_${user.id}`);
      if (notificationShown) {
        setStatus({ isComplete: true, missingFields: [], checking: false });
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
          setStatus({ isComplete: true, missingFields: [], checking: false });
          return;
        }

        const requiredFields = [
          { key: "full_name", label: "Full Name" },
          { key: "phone", label: "Phone Number" },
          { key: "date_of_birth", label: "Date of Birth" },
          { key: "blood_group", label: "Blood Group" },
          { key: "emergency_contact", label: "Emergency Contact" },
          { key: "emergency_phone", label: "Emergency Phone" },
        ];

        const missingFields: string[] = [];

        if (profile) {
          requiredFields.forEach(({ key, label }) => {
            const value = profile[key as keyof typeof profile];
            if (!value || (typeof value === "string" && value.trim() === "")) {
              missingFields.push(label);
            }
          });
        } else {
          // No profile exists, all fields are missing
          missingFields.push(...requiredFields.map((f) => f.label));
        }

        const isComplete = missingFields.length === 0;

        setStatus({
          isComplete,
          missingFields,
          checking: false,
        });

        // Show notification if profile is incomplete and we haven't shown it yet
        if (!isComplete && !hasShownNotification) {
          setHasShownNotification(true);
          sessionStorage.setItem(`profile_notification_${user.id}`, "true");

          toast({
            title: "Complete Your Profile",
            description: `Please update your profile with: ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? ` and ${missingFields.length - 3} more fields` : ""}.`,
            action: (
              <button
                onClick={() => navigate("/profile/edit")}
                className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm font-medium hover:bg-primary/90"
              >
                Update Now
              </button>
            ),
            duration: 10000,
          });
        }
      } catch (error) {
        console.error("Error checking profile completion:", error);
        setStatus({ isComplete: true, missingFields: [], checking: false });
      }
    };

    checkProfileCompletion();
  }, [user, authLoading, toast, navigate, hasShownNotification]);

  return status;
};
