import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRegisterPushSubscription } from "@/hooks/useNotifications";
import { toast } from "sonner";

interface NotificationContextType {
  requestPushPermission: () => Promise<void>;
  pushEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const registerPushSubscription = useRegisterPushSubscription();

  useEffect(() => {
    checkPushPermission();
    setupRealtimeNotifications();
  }, []);

  const checkPushPermission = () => {
    if ("Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  };

  const setupRealtimeNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Subscribe to real-time notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as any;
          toast.info(notification.title, {
            description: notification.message,
          });

          // Show browser notification if permission granted
          if (Notification.permission === "granted") {
            new Notification(notification.title, {
              body: notification.message,
              icon: "/favicon.ico",
              tag: notification.id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const requestPushPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      toast.error("Service workers are not supported in this browser");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        setPushEnabled(true);

        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Subscribe to push notifications
        const subscription = await (registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            import.meta.env.VITE_VAPID_PUBLIC_KEY || ""
          ),
        });

        // Save subscription to database
        await registerPushSubscription.mutateAsync(subscription);
        
        toast.success("Push notifications enabled!");
      } else {
        toast.error("Push notification permission denied");
      }
    } catch (error) {
      console.error("Error requesting push permission:", error);
      toast.error("Failed to enable push notifications");
    }
  };

  return (
    <NotificationContext.Provider
      value={{ requestPushPermission, pushEnabled }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  }
  return context;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
