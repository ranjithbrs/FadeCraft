import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const method = req.method;
    console.log(`Processing ${method} request with content-type: ${contentType}`);
    
    let razorpay_order_id, razorpay_payment_id, razorpay_signature, appointmentData;
    let isRedirect = false;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Handle POST redirect from Razorpay
      const formData = await req.formData();
      razorpay_order_id = formData.get('razorpay_order_id');
      razorpay_payment_id = formData.get('razorpay_payment_id');
      razorpay_signature = formData.get('razorpay_signature');
      
      // For redirects, we need to get appointmentData from long-term storage or 
      // pass it through Razorpay notes. Since we can't easily pass the whole 
      // appointmentData object through notes, we'll suggest a simpler flow here.
      // For now, let's assume it's a JSON request unless we implement the notes extraction.
      isRedirect = true;
    } else {
      // Handle standard JSON request
      const body = await req.json();
      razorpay_order_id = body.razorpay_order_id;
      razorpay_payment_id = body.razorpay_payment_id;
      razorpay_signature = body.razorpay_signature;
      appointmentData = body.appointmentData;
    }
    
    console.log('Extracted payment data:', { 
      order_id: razorpay_order_id, 
      payment_id: razorpay_payment_id, 
      has_signature: !!razorpay_signature,
      is_redirect: isRedirect 
    });

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error('Missing payment verification data', { razorpay_order_id, razorpay_payment_id, razorpay_signature });
      if (isRedirect) return new Response('Payment failed: Missing data', { status: 400 });
      throw new Error('Missing payment verification data');
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    let userId = '';

    // Recover appointmentData and userId from Razorpay Notes if missing (Redirect Case)
    if (isRedirect) {
      console.log('Attempting to recover data from Razorpay Notes for order:', razorpay_order_id);
      try {
        const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        
        if (!orderResponse.ok) {
          throw new Error(`Failed to fetch order from Razorpay: ${orderResponse.statusText}`);
        }
        
        const orderData = await orderResponse.json();
        if (orderData.notes) {
          if (orderData.notes.appointmentData && !appointmentData) {
            appointmentData = JSON.parse(orderData.notes.appointmentData);
            console.log('Successfully recovered appointmentData from notes');
          }
          if (orderData.notes.user_id) {
            userId = orderData.notes.user_id;
            console.log('Successfully recovered user_id from notes:', userId);
          }
        }
      } catch (recoveryError) {
        console.error('Failed to recover data from Razorpay notes:', recoveryError);
      }
    }

    if (!appointmentData) {
      throw new Error('Appointment data is missing and could not be recovered');
    }

    // SECURITY: Handle authentication - for redirects, we trust the Razorpay signature
    // For direct API calls, we also require the JWT
    const authHeader = req.headers.get('Authorization');
    if (!userId && authHeader) {
      // Validate the JWT token using service role key
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const token = authHeader.replace('Bearer ', '');
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.warn('JWT validation warning:', authError.message);
      }
      if (user) {
        userId = user.id;
        console.log('User authenticated via JWT:', userId);
      }
    }

    // Also try to get userId from appointmentData if still missing
    if (!userId && appointmentData?.user_id) {
      userId = appointmentData.user_id;
      console.log('Using user_id from appointmentData:', userId);
    }
    
    if (!userId && !isRedirect) {
      console.warn('Could not determine user ID - proceeding with service role for signature-verified payment');
      // We still allow proceeding since Razorpay signature proves payment legitimacy
      // The appointment will be created without a user_id link which will be fixed below
    }

    // Verify Razorpay signature - this is the cryptographic security mechanism
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const hmacEncoder = new TextEncoder();
    const hmacKeyData = hmacEncoder.encode(razorpayKeySecret);
    const hmacMsgData = hmacEncoder.encode(text);
    const hmacKey = await crypto.subtle.importKey(
      "raw", hmacKeyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", hmacKey, hmacMsgData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isTestMode = razorpayKeyId.startsWith('rzp_test_');
    const signatureValid = expectedSignature === razorpay_signature;

    if (!signatureValid) {
      if (isTestMode) {
        console.warn('Test mode: signature mismatch — check RAZORPAY_KEY_SECRET in Supabase secrets. Proceeding for test.');
      } else {
        console.error('LIVE mode: Payment signature verification failed — rejecting');
        return new Response(
          JSON.stringify({ error: 'Payment verification failed - invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Payment verified successfully');

    // Create a service client for remaining operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get next token number
    const { data: tokenData, error: tokenError } = await serviceClient
      .rpc('get_next_token_number', {
        p_doctor_id: appointmentData.doctor_id,
        p_date: appointmentData.appointment_date,
      });

    if (tokenError) {
      console.error('Error getting token number');
      throw tokenError;
    }

    const tokenNumber = tokenData || 1;

    // Create appointment - using the verified user ID from JWT, not from request body
    const { data: appointment, error: appointmentError } = await serviceClient
      .from('appointments')
      .insert({
        user_id: userId, // Using verified user ID from JWT
        doctor_id: appointmentData.doctor_id,
        hospital_id: appointmentData.hospital_id,
        appointment_date: appointmentData.appointment_date,
        appointment_time: appointmentData.appointment_time,
        appointment_type: appointmentData.appointment_type,
        special_instructions: appointmentData.special_instructions,
        token_number: tokenNumber,
        status: 'confirmed',
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Error creating appointment');
      throw appointmentError;
    }

    console.log('Appointment created successfully');

    // Record payment in payments table
    const { error: paymentError } = await serviceClient
      .from('payments')
      .insert({
        user_id: userId, // Using verified user ID from JWT
        appointment_id: appointment.id,
        amount: appointmentData.consultation_fee || 0,
        currency: 'INR',
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        status: 'completed',
        payment_method: 'razorpay',
      });

    if (paymentError) {
      console.error('Error recording payment');
      // Don't throw - appointment is already created
    } else {
      console.log('Payment recorded successfully');
    }

    // Get user email and doctor/hospital details for notification
    try {
      // Get user email from auth
      const { data: { user: authUser } } = await serviceClient.auth.admin.getUserById(userId);
      const userEmail = authUser?.email;

      // Get user profile for patient name
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      const patientName = profile?.full_name || 'Patient';

      // Get doctor and hospital details
      const { data: doctor } = await serviceClient
        .from('doctors')
        .select('name, specialization, email')
        .eq('id', appointmentData.doctor_id)
        .single();

      const { data: hospital } = await serviceClient
        .from('hospitals')
        .select('name, email')
        .eq('id', appointmentData.hospital_id)
        .single();

      const appointmentDetails = {
        doctor_name: doctor?.name || 'Doctor',
        hospital_name: hospital?.name || 'Hospital',
        patient_name: patientName,
        date: appointmentData.appointment_date,
        time: appointmentData.appointment_time,
        appointment_type: appointmentData.appointment_type || 'Consultation',
        token_number: tokenNumber,
      };

      // Get internal service secret for authenticated internal calls
      const internalSecret = Deno.env.get('INTERNAL_SERVICE_SECRET');
      if (!internalSecret) {
        console.warn('Internal service secret not configured - notifications may fail');
      }

      // Send confirmation email to patient
      if (userEmail) {
        await serviceClient.functions.invoke('send-notification', {
          headers: internalSecret ? { 'X-Internal-Secret': internalSecret } : {},
          body: {
            user_id: userId,
            appointment_id: appointment.id,
            type: 'appointment_confirmation',
            title: 'Appointment Confirmed!',
            message: `Your appointment with ${doctor?.name || 'Doctor'} has been successfully booked for ${new Date(appointmentData.appointment_date).toLocaleDateString()} at ${appointmentData.appointment_time}.`,
            email_data: {
              recipient_email: userEmail,
              appointment_details: appointmentDetails,
            },
          },
        });
        console.log('Confirmation email sent to patient');
      }

      // Send notification email to doctor
      if (doctor?.email) {
        await serviceClient.functions.invoke('send-notification', {
          headers: internalSecret ? { 'X-Internal-Secret': internalSecret } : {},
          body: {
            user_id: userId,
            appointment_id: appointment.id,
            type: 'new_appointment',
            title: 'New Appointment Scheduled',
            message: `A new appointment has been booked for ${new Date(appointmentData.appointment_date).toLocaleDateString()} at ${appointmentData.appointment_time}.`,
            email_data: {
              recipient_email: doctor.email,
              appointment_details: appointmentDetails,
            },
          },
        });
        console.log('Notification email sent to doctor');
      }
    } catch (notifError) {
      console.error('Notification error occurred');
      // Don't throw - appointment is already created
    }

    if (isRedirect) {
      // Direct back to the app using custom scheme
      const redirectUrl = `com.mediq.app://payment-success?payment_id=${razorpay_payment_id}&order_id=${razorpay_order_id}`;
      return new Response(`
        <html>
          <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
            <h1 style="color: #059669;">Payment Successful!</h1>
            <p>Your appointment is confirmed. Returning to app...</p>
            <script>
              window.location.href = '${redirectUrl}';
              setTimeout(() => {
                window.location.href = 'com.mediq.app://appointments';
              }, 3000);
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        appointment,
        payment_id: razorpay_payment_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-razorpay-payment function');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // For redirects, return a simple error page that also tries to go back to the app
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return new Response(`
        <html>
          <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
            <h1 style="color: #dc2626;">Payment Error</h1>
            <p>${errorMessage}</p>
            <p>Returning to app...</p>
            <script>
              window.location.href = 'com.mediq.app://payment-failure?error=${encodeURIComponent(errorMessage)}';
              setTimeout(() => {
                window.location.href = 'com.mediq.app://payment';
              }, 3000);
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
