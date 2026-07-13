import { jsPDF } from "jspdf";
import { format } from "date-fns";

interface AppointmentData {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  token_number: number | null;
  queue_position: number | null;
  status: string;
  special_instructions: string | null;
}

interface DoctorData {
  name: string;
  qualification: string;
  specialization: string;
  consultation_fee: number;
}

interface HospitalData {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

export const generateAppointmentPDF = (
  appointment: AppointmentData,
  doctor: DoctorData,
  hospital: HospitalData
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // #2563eb
  const textColor: [number, number, number] = [26, 26, 26];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const successColor: [number, number, number] = [16, 185, 129];
  
  let yPos = 20;
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("MediQ", pageWidth / 2, 25, { align: "center" });
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Appointment Confirmation", pageWidth / 2, 38, { align: "center" });
  
  yPos = 65;
  
  // Status Badge
  const statusText = appointment.status.toUpperCase();
  const statusWidth = doc.getTextWidth(statusText) + 16;
  const statusX = (pageWidth - statusWidth) / 2;
  
  if (appointment.status === "confirmed" || appointment.status === "scheduled") {
    doc.setFillColor(...successColor);
  } else if (appointment.status === "cancelled") {
    doc.setFillColor(239, 68, 68);
  } else {
    doc.setFillColor(...mutedColor);
  }
  
  doc.roundedRect(statusX, yPos - 6, statusWidth, 12, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pageWidth / 2, yPos + 2, { align: "center" });
  
  yPos += 20;
  
  // Token Number (if available)
  if (appointment.token_number) {
    doc.setFillColor(247, 250, 252);
    doc.roundedRect(20, yPos, pageWidth - 40, 45, 5, 5, "F");
    
    doc.setTextColor(...mutedColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("TOKEN NUMBER", pageWidth / 2, yPos + 12, { align: "center" });
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.text(`#${appointment.token_number}`, pageWidth / 2, yPos + 35, { align: "center" });
    
    yPos += 55;
  }
  
  // Appointment Details Section
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Appointment Details", 20, yPos);
  yPos += 10;
  
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  const appointmentDetails = [
    { label: "Date", value: format(new Date(appointment.appointment_date), "EEEE, MMMM d, yyyy") },
    { label: "Time", value: appointment.appointment_time },
    { label: "Type", value: appointment.appointment_type.charAt(0).toUpperCase() + appointment.appointment_type.slice(1) },
    { label: "Booking ID", value: appointment.id.slice(0, 8).toUpperCase() },
  ];
  
  appointmentDetails.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text(item.label, 20, yPos);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text(item.value, pageWidth - 20, yPos, { align: "right" });
    yPos += 10;
  });
  
  yPos += 10;
  
  // Doctor Details Section
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Doctor Details", 20, yPos);
  yPos += 10;
  
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  const doctorDetails = [
    { label: "Doctor", value: doctor.name },
    { label: "Specialization", value: doctor.specialization },
    { label: "Qualification", value: doctor.qualification },
    { label: "Consultation Fee", value: `₹${doctor.consultation_fee.toFixed(2)}` },
  ];
  
  doctorDetails.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text(item.label, 20, yPos);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text(item.value, pageWidth - 20, yPos, { align: "right" });
    yPos += 10;
  });
  
  yPos += 10;
  
  // Hospital Details Section
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Hospital Details", 20, yPos);
  yPos += 10;
  
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Hospital", 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text(hospital.name, pageWidth - 20, yPos, { align: "right" });
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Address", 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  const fullAddress = `${hospital.address}, ${hospital.city}`;
  doc.text(fullAddress, pageWidth - 20, yPos, { align: "right" });
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Location", 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text(`${hospital.state} - ${hospital.pincode}`, pageWidth - 20, yPos, { align: "right" });
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Phone", 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text(hospital.phone, pageWidth - 20, yPos, { align: "right" });
  yPos += 15;
  
  // Special Instructions (if any)
  if (appointment.special_instructions) {
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Special Instructions", 20, yPos);
    yPos += 10;
    
    doc.setDrawColor(229, 231, 235);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    const lines = doc.splitTextToSize(appointment.special_instructions, pageWidth - 40);
    doc.text(lines, 20, yPos);
    yPos += lines.length * 5 + 10;
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setDrawColor(229, 231, 235);
  doc.line(20, footerY, pageWidth - 20, footerY);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Thank you for choosing MediQ", pageWidth / 2, footerY + 10, { align: "center" });
  doc.text(`Generated on ${format(new Date(), "PPP 'at' p")}`, pageWidth / 2, footerY + 18, { align: "center" });
  
  // Save the PDF
  const fileName = `MediQ-Appointment-${appointment.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};
