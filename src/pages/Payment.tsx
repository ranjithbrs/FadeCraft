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
  tokenType?: string;
  specialInstructions: string;
  consultationFee: number;
  priorityFee?: number;
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
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      // Dynamically load Razorpay SDK (works on web + Android Capacitor)
      const sdkLoaded = await loadRazorpayScript();
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!sdkLoaded || !window.Razorpay) {
        throw new Error("Payment gateway could not be loaded. Please check your internet connection and try again.");
      }

      // Get JWT token for Supabase edge functions (if user is logged in)
      const { data: sessionData } = await supabase.auth.getSession();
      const authHeader = sessionData?.session?.access_token ? `Bearer ${sessionData.session.access_token}` : undefined;

      const totalFee = bookingData.consultationFee + (bookingData.priorityFee || 0);

      // Create Razorpay order with auth header if available
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            amount: totalFee,
            currency: 'INR',
            receipt: `pass_${Date.now()}`,
            notes: {
              appointmentData: JSON.stringify({
                doctor_id: bookingData.doctorId,
                hospital_id: bookingData.hospitalId,
                appointment_date: bookingData.appointmentDate,
                appointment_time: bookingData.appointmentTime,
                appointment_type: bookingData.appointmentType,
                token_type: bookingData.tokenType || 'normal',
                special_instructions: bookingData.specialInstructions,
                consultation_fee: totalFee,
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

      // Initialize Razorpay checkout with environment key
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TDjfmTJ4PqFq2Z';
      console.log('Initializing Razorpay with key:', keyId);

      const isNative = Capacitor.isNativePlatform();

      const options: any = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'FadeCraft',
        description: `VIP Chair Pass — ${bookingData.doctorName}`,
        order_id: order.id,
        prefill: {
          email: user.email,
        },
        theme: {
          color: "#f59e0b",
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
                  token_type: bookingData.tokenType || 'normal',
                  special_instructions: bookingData.specialInstructions,
                  consultation_fee: totalFee,
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
            if (isProcessing) {
              setIsProcessing(false);
            }

            toast({
              title: "Payment Cancelled",
              description: "You cancelled the payment.",
              variant: "destructive",
            });
          },
          escape: false,
          backdropclose: false,
          confirm_close: true,
          animation: true,
        };
        if (!window.Razorpay) {
          throw new Error("Razorpay SDK not initialized");
        }
        console.log("Opening Razorpay Checkout...");
        console.log(options);
        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', handleFailure);
        setTimeout(() => {
          razorpay.open();
        }, 100);
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
      <div className="container py-6 px-4 max-w-4xl mx-auto text-slate-100 min-h-screen">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-100">VIP Chair Checkout</h1>
          <p className="text-xs text-slate-400 mt-0.5">Confirm your grooming reservation and secure your chair</p>
        </div>

        {/* Booking Summary */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/40">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold">Reservation Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-100">{bookingData.doctorName}</p>
                <p className="text-xs text-amber-400/90 font-medium">{bookingData.doctorSpecialization}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-xs text-slate-300">{bookingData.hospitalName}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-xs text-slate-300">
                {new Date(bookingData.appointmentDate).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-xs text-slate-300 font-semibold">{bookingData.appointmentTime}</p>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">Service:</span>
              <span className="text-xs font-semibold text-amber-300 capitalize">{bookingData.appointmentType?.replace('_', ' ')}</span>
              {bookingData.tokenType && (
                <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  {bookingData.tokenType} Pass
                </span>
              )}
            </div>

            {bookingData.specialInstructions && (
              <div className="pt-3 border-t border-slate-800/80">
                <p className="text-xs text-slate-400 mb-1">Styling Notes:</p>
                <p className="text-xs text-slate-300 italic">{bookingData.specialInstructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold">Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Standard Cut Fee</span>
                <span className="font-semibold text-slate-200">₹{bookingData.consultationFee.toFixed(2)}</span>
              </div>
              {bookingData.priorityFee && bookingData.priorityFee > 0 ? (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-400">Priority Pass Premium</span>
                  <span className="font-semibold text-amber-400">+₹{bookingData.priorityFee.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="font-bold text-sm text-slate-100">Total Amount</span>
                <span className="text-xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                  ₹{(bookingData.consultationFee + (bookingData.priorityFee || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 pb-8">
          <Button
            variant="outline"
            className="flex-1 bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => navigate(-1)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
            onClick={handlePayment}
            disabled={isProcessing}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {isProcessing ? "Connecting Gateway..." : "Pay via Razorpay"}
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