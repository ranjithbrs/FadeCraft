import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  appointment_reminders: boolean;
  queue_updates: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  appointment_id: string | null;
  type: string;
  channel: string;
  status: string;
  title: string;
  message: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export const useNotificationPreferences = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["notificationPreferences", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      // Create default preferences if none exist
      if (!data) {
        const { data: newPrefs, error: insertError } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: userId,
            email_enabled: true,
            push_enabled: true,
            appointment_reminders: true,
            queue_updates: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newPrefs;
      }

      return data;
    },
    enabled: !!userId,
  });
};

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("notification_preferences")
        .update(preferences)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
      toast.success("Notification preferences updated!");
    },
    onError: (error) => {
      toast.error("Failed to update preferences: " + error.message);
    },
  });
};

export const useNotifications = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useSendNotification = () => {
  return useMutation({
    mutationFn: async ({
      user_id,
      appointment_id,
      type,
      title,
      message,
      email_data,
    }: {
      user_id: string;
      appointment_id?: string;
      type: string;
      title: string;
      message: string;
      email_data?: any;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "send-notification",
        {
          body: {
            user_id,
            appointment_id,
            type,
            title,
            message,
            email_data,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error("Failed to send notification:", error);
    },
  });
};

export const useRegisterPushSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscription: PushSubscription) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const subscriptionJson = subscription.toJSON();

      const { data, error } = await supabase
        .from("push_subscriptions")
        .insert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || "",
          auth: subscriptionJson.keys?.auth || "",
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pushSubscriptions"] });
      toast.success("Push notifications enabled!");
    },
    onError: (error) => {
      toast.error("Failed to enable push notifications: " + error.message);
    },
  });
};
