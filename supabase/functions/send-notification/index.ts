import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface NotificationRequest {
  user_id: string;
  appointment_id?: string;
  type: "appointment_reminder" | "appointment_confirmation" | "queue_update" | "appointment_cancelled" | "appointment_rescheduled" | "new_appointment";
  title: string;
  message: string;
  email_data?: {
    recipient_email: string;
    appointment_details?: any;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    
    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      user_id,
      appointment_id,
      type,
      title,
      message,
      email_data,
    }: NotificationRequest = await req.json();

    // Check if this is an internal service call using cryptographic secret
    // Internal calls must pass the secret in X-Internal-Secret header
    const internalSecret = Deno.env.get("INTERNAL_SERVICE_SECRET");
    const providedSecret = req.headers.get("X-Internal-Secret");
    const isServiceCall = internalSecret && providedSecret && providedSecret === internalSecret;
    
    if (!isServiceCall) {
      // For external calls, require authentication
      if (!authHeader) {
        console.error("Missing authorization header");
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Create client with user's auth token to validate it
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      // Verify the JWT token by getting the user
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      
      if (authError || !user) {
        console.error("Invalid auth token");
        return new Response(
          JSON.stringify({ error: "Invalid or expired authentication token" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("User authenticated successfully");

      // Security check: Ensure the authenticated user matches the user_id in the request
      if (user.id !== user_id) {
        console.error("User mismatch - access denied");
        return new Response(
          JSON.stringify({ error: "You can only send notifications for your own account" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      console.log("Authenticated internal service call");
    }

    console.log("Processing notification request");

    // Check user notification preferences (only for user notifications, not doctor notifications)
    let preferences = null;
    if (user_id) {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user_id)
        .single();
      preferences = data;

      // Create default preferences if none exist
      if (!preferences) {
        await supabase.from("notification_preferences").insert({
          user_id,
          email_enabled: true,
          push_enabled: true,
          appointment_reminders: true,
          queue_updates: true,
        });
      }
    }

    const shouldSendEmail = preferences?.email_enabled ?? true;
    const results: any[] = [];

    // Send email notification
    if (shouldSendEmail && email_data?.recipient_email) {
      try {
        // Use custom domain if configured, otherwise use Resend's sandbox
        // NOTE: onboarding@resend.dev only delivers to the account owner's verified email
        // For production, add RESEND_FROM_EMAIL secret with your verified domain email
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "MediQ <onboarding@resend.dev>";
        
        console.log("Sending email notification");
        
        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [email_data.recipient_email],
          subject: title,
          html: generateEmailTemplate(type, message, email_data.appointment_details),
        });

        console.log("Email sent successfully");

        // Check if there's an error in the response
        if ('error' in emailResponse && emailResponse.error) {
          throw new Error(JSON.stringify(emailResponse.error));
        }

        // Log notification in database
        await supabase.from("notifications").insert({
          user_id,
          appointment_id,
          type,
          channel: "email",
          status: "sent",
          title,
          message,
          sent_at: new Date().toISOString(),
        });

        results.push({ channel: "email", status: "sent" });
      } catch (error: any) {
        console.error("Email send failed");

        await supabase.from("notifications").insert({
          user_id,
          appointment_id,
          type,
          channel: "email",
          status: "failed",
          title,
          message,
          error_message: "Email delivery failed",
        });

        results.push({ channel: "email", status: "failed" });
      }
    }

    // Send push notification
    const shouldSendPush = preferences?.push_enabled ?? true;
    if (shouldSendPush) {
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user_id);

      if (subscriptions && subscriptions.length > 0) {
        for (const subscription of subscriptions) {
          try {
            // Push notification would be handled by the frontend service worker
            // Just log it for now
            await supabase.from("notifications").insert({
              user_id,
              appointment_id,
              type,
              channel: "push",
              status: "sent",
              title,
              message,
              sent_at: new Date().toISOString(),
            });

            results.push({ channel: "push", status: "sent" });
          } catch (error: any) {
            console.error("Push notification failed");
            results.push({ channel: "push", status: "failed" });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification function");
    return new Response(
      JSON.stringify({ error: "Notification processing failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateEmailTemplate(
  type: string,
  message: string,
  appointmentDetails?: any
): string {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #2563EB 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
      .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .detail-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
      .detail-row:last-child { border-bottom: none; }
      .label { font-weight: 600; color: #6b7280; }
      .value { color: #111827; }
      .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      .button { display: inline-block; background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    </style>
  `;

  let detailsHtml = "";
  if (appointmentDetails) {
    detailsHtml = `
      <div class="details">
        <h3 style="margin-top: 0; color: #111827;">Appointment Details</h3>
        ${appointmentDetails.patient_name ? `<div class="detail-row"><span class="label">Patient:</span> <span class="value">${escapeHtml(appointmentDetails.patient_name)}</span></div>` : ""}
        ${appointmentDetails.doctor_name ? `<div class="detail-row"><span class="label">Doctor:</span> <span class="value">${escapeHtml(appointmentDetails.doctor_name)}</span></div>` : ""}
        ${appointmentDetails.hospital_name ? `<div class="detail-row"><span class="label">Hospital:</span> <span class="value">${escapeHtml(appointmentDetails.hospital_name)}</span></div>` : ""}
        ${appointmentDetails.date ? `<div class="detail-row"><span class="label">Date:</span> <span class="value">${escapeHtml(new Date(appointmentDetails.date).toLocaleDateString())}</span></div>` : ""}
        ${appointmentDetails.time ? `<div class="detail-row"><span class="label">Time:</span> <span class="value">${escapeHtml(String(appointmentDetails.time))}</span></div>` : ""}
        ${appointmentDetails.appointment_type ? `<div class="detail-row"><span class="label">Type:</span> <span class="value">${escapeHtml(appointmentDetails.appointment_type)}</span></div>` : ""}
        ${appointmentDetails.token_number ? `<div class="detail-row"><span class="label">Token Number:</span> <span class="value">#${escapeHtml(String(appointmentDetails.token_number))}</span></div>` : ""}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">MediQ</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Healthcare Appointment System</p>
        </div>
        <div class="content">
          <h2 style="color: #111827; margin-top: 0;">${escapeHtml(type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))}</h2>
          <p style="font-size: 16px; color: #374151;">${escapeHtml(message)}</p>
          ${detailsHtml}
          <div class="footer">
            <p>This is an automated message from MediQ. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} MediQ. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to escape HTML and prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}

serve(handler);
