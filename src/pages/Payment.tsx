import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCreateReview } from "@/hooks/useReviews";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Calendar, Clock, User, Building2 } from "lucide-react";
import { RatingDialog } from "@/components/ratings/RatingDialog";
import { App } from '@capacitor/app';

interface BookingData {
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  hospitalId: string;
  hospitalName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  specialInstructions: string;
  consultationFee: number;
}

declare global {
  interface Window {
    Razorpay: any;
    RazorpayCheckout: any;
  }
}

// Dynamically load Razorpay SDK so it works on both web and Android Capacitor
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingData] = useState<BookingData | null>(location.state?.bookingData || null);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const createReview = useCreateReview();

  const handleDoctorRatingSubmit = async (rating: number, review: string) => {
    if (!bookingData) return;
    
    try {
      await createReview.mutateAsync({
        doctor_id: bookingData.doctorId,
        rating,
        review: review || undefined,
      });
    } catch (error) {
      console.error("Doctor rating submission error:", error);
    }
  };

  const handleHospitalRatingSubmit = async (rating: number, review: string) => {
    if (!bookingData) return;
    
    try {
      await createReview.mutateAsync({
        hospital_id: bookingData.hospitalId,
        rating,
        review: review || undefined,
      });
    } catch (error) {
      console.error("Hospital rating submission error:", error);
    }
  };

  const handleRatingDialogClose = (open: boolean) => {
    if (!open) {
      setShowRatingDialog(false);
      navigate("/appointments");
    }
  };

  useEffect(() => {
    const handler = async (event: any) => {
      // Guard: skip if there's no URL
      if (!event?.url) return;

      let url: URL;
      try {
        url = new URL(event.url);
      } catch {
        console.warn('appUrlOpen: could not parse URL', event.url);
        return;
      }

      // Expected format: com.mediq.app://payment?status=success&order_id=...&payment_id=...&signature=...
      const status = url.searchParams.get('status');

      if (status === 'success') {
        const orderId = url.searchParams.get('order_id');
        const paymentId = url.searchParams.get('payment_id');
        const signature = url.searchParams.get('signature');

        if (!orderId || !paymentId || !signature) {
          toast({
            title: "Payment Verification Failed",
            description: "Missing payment parameters. Please contact support.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
            'verify-razorpay-payment',
            {
              body: {
                razorpay_order_id: orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
                appointmentData: bookingData,
              },
            }
          );
          if (verifyError) throw verifyError;
          if (verifyData?.error) throw new Error(verifyData.error?.message || verifyData.error);
          toast({
            title: "Payment Successful",
            description: "Your appointment has been confirmed",
          });
          setShowRatingDialog(true);
        } catch (err: any) {
          console.error('Deep link payment verification error:', err);
          toast({
            title: "Payment Verification Failed",
            description: err?.message || err?.error_description || "Signature mismatch or server error. Please contact support.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      } else if (status === 'failed' || status === 'cancel') {
        toast({
          title: status === 'cancel' ? "Payment Cancelled" : "Payment Failed",
          description: "Payment was not completed. You can try again.",
          variant: "destructive",
        });
        setIsProcessing(false);
      }
    };

    App.addListener('appUrlOpen', handler);
    return () => {
      App.removeAllListeners();
    };
  }, [bookingData]);

  const handlePayment = async () => {
    if (!user || !bookingData) return;

    setIsProcessing(true);

    try {
      // Dynamically load Razorpay SDK (works on web + Android Capacitor)
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        throw new Error("Payment gateway could not be loaded. Please check your internet connection and try again.");
      }

      // Get JWT token for Supabase edge functions (if user is logged in)
      const { data: sessionData } = await supabase.auth.getSession();
      const authHeader = sessionData?.session?.access_token ? `Bearer ${sessionData.session.access_token}` : undefined;

      // Create Razorpay order with auth header if available
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            amount: bookingData.consultationFee,
            currency: 'INR',
            receipt: `apt_${Date.now()}`,
            notes: {
              appointmentData: JSON.stringify({
                doctor_id: bookingData.doctorId,
                hospital_id: bookingData.hospitalId,
                appointment_date: bookingData.appointmentDate,
                appointment_time: bookingData.appointmentTime,
                appointment_type: bookingData.appointmentType,
                special_instructions: bookingData.specialInstructions,
                consultation_fee: bookingData.consultationFee,
              })
            },
          },
          // Include JWT for authentication on the edge function
          ...(authHeader ? { headers: { Authorization: authHeader } } : {}),
        }
      );

      if (orderError) {
        const errMsg = orderError?.message || JSON.stringify(orderError);
        console.error('Order creation error:', errMsg);
        throw new Error(errMsg);
      }

      // Supabase functions can return HTTP 200 with an error object in the body
      if (orderData?.error) {
        const errMsg = orderData.error?.message || orderData.error || 'Order creation failed';
        console.error('Order function returned error:', errMsg);
        throw new Error(errMsg);
      }

      if (!orderData?.order) {
        throw new Error('Invalid response from payment server. Please try again.');
      }

      console.log('Order created successfully:', orderData);
      const order = orderData.order;

      // Initialize Razorpay checkout
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      console.log('Initializing Razorpay with key:', keyId);

      const isNative = Capacitor.isNativePlatform();
      
      const options: any = {
        key: keyId || 'rzp_test_Rl44hquefSgy3C', // fallback test key
        amount: order.amount,
        currency: order.currency,
        name: 'MediQ',
        description: `Appointment with ${bookingData.doctorName}`,
        order_id: order.id,
        prefill: {
          email: user.email,
        },
        theme: {
          color: "#2563EB",
        },
      };

      const handleSuccess = async (response: any) => {
        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
            'verify-razorpay-payment',
            {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                appointmentData: {
                  doctor_id: bookingData.doctorId,
                  hospital_id: bookingData.hospitalId,
                  appointment_date: bookingData.appointmentDate,
                  appointment_time: bookingData.appointmentTime,
                  appointment_type: bookingData.appointmentType,
                  special_instructions: bookingData.specialInstructions,
                  consultation_fee: bookingData.consultationFee,
                },
              },
            }
          );
          if (verifyError) throw verifyError;
          // Edge function may return HTTP 200 with an error body
          if (verifyData?.error) throw new Error(verifyData.error?.message || verifyData.error);
          toast({
            title: "Payment Successful! 🎉",
            description: "Your appointment has been confirmed.",
          });
          setShowRatingDialog(true);
        } catch (error: any) {
          console.error('Payment verification error:', error);
          toast({
            title: "Payment Verification Failed",
            description:
              error?.message ||
              error?.error_description ||
              "Signature mismatch or server error. Please contact support.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      };

      const handleFailure = (error: any) => {
        const errObj = error?.error || error;
        const description = errObj?.description || errObj?.reason || error?.description || error?.reason || "Payment was not completed.";
        const code = errObj?.code || error?.code;
        console.error('Payment failed:', JSON.stringify(error, null, 2));
        toast({
          title: "Payment Failed",
          description: code ? `[${code}] ${description}` : description,
          variant: "destructive",
        });
        setIsProcessing(false);
      };

      if (isNative) {
        // Native Capacitor flow (Android/iOS)
        if (window.RazorpayCheckout) {
          window.RazorpayCheckout.open(options, handleSuccess, handleFailure);
        } else {
          toast({ title: "Error", description: "Razorpay Native Plugin missing.", variant: "destructive" });
          setIsProcessing(false);
        }
      } else {
        // Web flow
        options.handler = handleSuccess;
        options.modal = {
          ondismiss: () => {
            setIsProcessing(false);
            toast({ title: "Payment Cancelled", description: "You cancelled the payment", variant: "destructive" });
          }
        };
        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', handleFailure);
        razorpay.open();
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Could not initiate payment. Please try again later.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (!bookingData) {
    return null;
  }

  return (
    <MainLayout>
      <div className="container py-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Payment</h1>

        {/* Booking Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{bookingData.doctorName}</p>
                <p className="text-sm text-muted-foreground">{bookingData.doctorSpecialization}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">{bookingData.hospitalName}</p>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">
                {new Date(bookingData.appointmentDate).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">{bookingData.appointmentTime}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Type:</span>
              <span className="text-sm font-medium capitalize">{bookingData.appointmentType}</span>
            </div>

            {bookingData.specialInstructions && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Special Instructions:</p>
                <p className="text-sm">{bookingData.specialInstructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Consultation Fee</span>
                <span className="font-medium">₹{bookingData.consultationFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-semibold">Total Amount</span>
                <span className="text-xl font-bold text-primary">₹{bookingData.consultationFee.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(-1)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handlePayment}
            disabled={isProcessing}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {isProcessing ? "Processing..." : "Pay Now"}
          </Button>
        </div>

        {/* Rating Dialog */}
        <RatingDialog
          open={showRatingDialog}
          onOpenChange={handleRatingDialogClose}
          doctorName={bookingData.doctorName}
          hospitalName={bookingData.hospitalName}
          onSubmitDoctor={handleDoctorRatingSubmit}
          onSubmitHospital={handleHospitalRatingSubmit}
          isSubmitting={createReview.isPending}
        />
      </div>
    </MainLayout>
  );
};

export default Payment;