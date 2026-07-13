import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePayments, Payment } from "@/hooks/usePayments";
import { format } from "date-fns";
import { 
  Receipt, 
  Download, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowLeft
} from "lucide-react";
import { ReceiptModal } from "@/components/payments/ReceiptModal";

const PaymentHistory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: payments, isLoading } = usePayments(user?.id);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    }
  };

  if (authLoading || isLoading) {
    return (
      <MainLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
            <p className="text-muted-foreground text-sm">
              View all your transactions and download receipts
            </p>
          </div>
        </div>

        {!payments || payments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Payments Yet</h3>
              <p className="text-muted-foreground text-center mt-2">
                Your payment history will appear here after you book an appointment.
              </p>
              <Button 
                className="mt-4"
                onClick={() => navigate("/search")}
              >
                Book an Appointment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <Card 
                key={payment.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPayment(payment)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(payment.status)}
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-foreground">
                        {payment.appointment?.doctor?.name || "Doctor"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {payment.appointment?.doctor?.specialization}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {payment.appointment?.appointment_date && 
                            format(new Date(payment.appointment.appointment_date), "MMM dd, yyyy")}
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4" />
                          {payment.payment_method || "Online"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        ₹{payment.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), "MMM dd, yyyy")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPayment(payment);
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Receipt
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ReceiptModal 
          payment={selectedPayment}
          open={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      </div>
    </MainLayout>
  );
};

export default PaymentHistory;
