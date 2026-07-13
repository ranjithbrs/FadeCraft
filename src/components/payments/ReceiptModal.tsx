import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Payment } from "@/hooks/usePayments";
import { format } from "date-fns";
import { Download, Printer, CheckCircle2 } from "lucide-react";

interface ReceiptModalProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
}

// Helper function to escape HTML entities and prevent XSS
const escapeHtml = (text: string): string => {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
};

// Helper function to safely get and escape a string value
const safeString = (value: string | null | undefined, fallback: string = "N/A"): string => {
  return escapeHtml(value || fallback);
};

export const ReceiptModal = ({ payment, open, onClose }: ReceiptModalProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!payment) return null;

  // Pre-escape all dynamic values for use in print/download
  const safeValues = {
    transactionId: safeString(payment.razorpay_payment_id || payment.id.slice(0, 8)),
    date: escapeHtml(format(new Date(payment.created_at), "MMM dd, yyyy 'at' hh:mm a")),
    paymentMethod: safeString(payment.payment_method, "Online"),
    doctorName: safeString(payment.appointment?.doctor?.name),
    specialization: safeString(payment.appointment?.doctor?.specialization),
    hospitalName: safeString(payment.appointment?.hospital?.name),
    appointmentDate: payment.appointment?.appointment_date
      ? escapeHtml(format(new Date(payment.appointment.appointment_date), "MMM dd, yyyy"))
      : "N/A",
    tokenNumber: payment.appointment?.token_number 
      ? `#${escapeHtml(String(payment.appointment.token_number))}`
      : "#N/A",
    amount: escapeHtml(payment.amount.toFixed(2)),
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Generate safe HTML content directly instead of using innerHTML
    const safeHtmlContent = generateSafeReceiptHtml(safeValues, payment.status === "completed");

    printWindow.document.write(safeHtmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    // Generate safe HTML content directly instead of using innerHTML
    const safeHtmlContent = generateSafeReceiptHtml(safeValues, payment.status === "completed");

    const blob = new Blob([safeHtmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MediQ-Receipt-${safeValues.transactionId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>

        <div ref={receiptRef}>
          <div className="header text-center">
            <div className="logo text-2xl font-bold text-primary">MediQ</div>
            <div className="receipt-title text-muted-foreground">Payment Receipt</div>
            {payment.status === "completed" && (
              <div className="success-badge inline-flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm mt-3">
                <CheckCircle2 className="h-4 w-4" />
                Payment Successful
              </div>
            )}
          </div>

          <div className="section bg-muted/50 rounded-lg p-4 my-4">
            <div className="section-title text-xs uppercase text-muted-foreground font-semibold mb-3">
              Transaction Details
            </div>
            <div className="space-y-2 text-sm">
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Transaction ID</span>
                <span className="info-value font-medium text-foreground">
                  {payment.razorpay_payment_id || payment.id.slice(0, 8)}
                </span>
              </div>
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Date</span>
                <span className="info-value font-medium text-foreground">
                  {format(new Date(payment.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                </span>
              </div>
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Payment Method</span>
                <span className="info-value font-medium text-foreground capitalize">
                  {payment.payment_method || "Online"}
                </span>
              </div>
            </div>
          </div>

          <div className="section bg-muted/50 rounded-lg p-4 my-4">
            <div className="section-title text-xs uppercase text-muted-foreground font-semibold mb-3">
              Appointment Details
            </div>
            <div className="space-y-2 text-sm">
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Doctor</span>
                <span className="info-value font-medium text-foreground">
                  {payment.appointment?.doctor?.name || "N/A"}
                </span>
              </div>
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Specialization</span>
                <span className="info-value font-medium text-foreground">
                  {payment.appointment?.doctor?.specialization || "N/A"}
                </span>
              </div>
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Hospital</span>
                <span className="info-value font-medium text-foreground">
                  {payment.appointment?.hospital?.name || "N/A"}
                </span>
              </div>
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Appointment Date</span>
                <span className="info-value font-medium text-foreground">
                  {payment.appointment?.appointment_date
                    ? format(new Date(payment.appointment.appointment_date), "MMM dd, yyyy")
                    : "N/A"}
                </span>
              </div>
              <div className="info-row flex justify-between">
                <span className="info-label text-muted-foreground">Token Number</span>
                <span className="info-value font-medium text-foreground">
                  #{payment.appointment?.token_number || "N/A"}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="total-section bg-primary text-primary-foreground rounded-lg p-4 mt-4">
            <div className="total-row flex justify-between items-center">
              <span className="total-label opacity-90">Total Amount Paid</span>
              <span className="total-amount text-2xl font-bold">
                ₹{payment.amount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="footer text-center mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
            <p>Thank you for choosing MediQ</p>
            <p className="mt-1">For support, contact support@mediq.com</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handlePrint} variant="outline" className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleDownload} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Generate safe HTML for print/download with all values pre-escaped
function generateSafeReceiptHtml(
  values: {
    transactionId: string;
    date: string;
    paymentMethod: string;
    doctorName: string;
    specialization: string;
    hospitalName: string;
    appointmentDate: string;
    tokenNumber: string;
    amount: string;
  },
  isCompleted: boolean
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Receipt - MediQ</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            color: #1a1a1a;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
          }
          .receipt-title {
            font-size: 20px;
            margin-top: 10px;
            color: #4a5568;
          }
          .success-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #d1fae5;
            color: #065f46;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            margin-top: 15px;
          }
          .section {
            margin: 25px 0;
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
          }
          .section-title {
            font-size: 12px;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 14px;
          }
          .info-label {
            color: #6b7280;
          }
          .info-value {
            font-weight: 500;
          }
          .total-section {
            background: #2563eb;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .total-label {
            font-size: 14px;
            opacity: 0.9;
          }
          .total-amount {
            font-size: 28px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MediQ</div>
          <div class="receipt-title">Payment Receipt</div>
          ${isCompleted ? '<div class="success-badge">✓ Payment Successful</div>' : ''}
        </div>

        <div class="section">
          <div class="section-title">Transaction Details</div>
          <div class="info-row">
            <span class="info-label">Transaction ID</span>
            <span class="info-value">${values.transactionId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${values.date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Method</span>
            <span class="info-value" style="text-transform: capitalize;">${values.paymentMethod}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Appointment Details</div>
          <div class="info-row">
            <span class="info-label">Doctor</span>
            <span class="info-value">${values.doctorName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Specialization</span>
            <span class="info-value">${values.specialization}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Hospital</span>
            <span class="info-value">${values.hospitalName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Appointment Date</span>
            <span class="info-value">${values.appointmentDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Token Number</span>
            <span class="info-value">${values.tokenNumber}</span>
          </div>
        </div>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Total Amount Paid</span>
            <span class="total-amount">₹${values.amount}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for choosing MediQ</p>
          <p style="margin-top: 8px;">For support, contact support@mediq.com</p>
        </div>
      </body>
    </html>
  `;
}
