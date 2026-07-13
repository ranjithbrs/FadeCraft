import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const LAST_SEEN_KEY = (userId: string) => `mediq_notifications_seen_${userId}`;

export const useUnreadNotifications = () => {
  const { user } = useAuth();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const getLastSeen = useCallback((): Date | null => {
    if (!user?.id) return null;
    const raw = localStorage.getItem(LAST_SEEN_KEY(user.id));
    return raw ? new Date(raw) : null;
  }, [user?.id]);

  const markAllAsRead = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(LAST_SEEN_KEY(user.id), new Date().toISOString());
  }, [user?.id]);

  const lastSeen = getLastSeen();
  const unreadCount = notifications.filter((n) => {
    if (!lastSeen) return true;
    return new Date(n.created_at) > lastSeen;
  }).length;

  return { unreadCount, markAllAsRead };
};
