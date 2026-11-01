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
  
  // Luxury Theme Colors (Obsidian & Champagne Gold)
  const darkBgColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const goldColor: [number, number, number] = [245, 158, 11]; // #f59e0b
  const textColor: [number, number, number] = [26, 26, 26];
  const mutedColor: [number, number, number] = [100, 116, 139];
  const successColor: [number, number, number] = [16, 185, 129];
  
  let yPos = 20;
  
  // Header
  doc.setFillColor(...darkBgColor);
  doc.rect(0, 0, pageWidth, 52, "F");
  
  doc.setTextColor(...goldColor);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text("FADECRAFT", pageWidth / 2, 24, { align: "center" });
  
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("VIP Chair Reservation & Digital Pass", pageWidth / 2, 38, { align: "center" });
  
  yPos = 65;
  
  // Status Badge
  const statusText = (appointment.status || "CONFIRMED").toUpperCase();
  const statusWidth = doc.getTextWidth(statusText) + 20;
  const statusX = (pageWidth - statusWidth) / 2;
  
  if (appointment.status === "confirmed" || appointment.status === "scheduled") {
    doc.setFillColor(...goldColor);
    doc.setTextColor(15, 23, 42);
  } else if (appointment.status === "cancelled") {
    doc.setFillColor(239, 68, 68);
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setFillColor(...mutedColor);
    doc.setTextColor(255, 255, 255);
  }
  
  doc.roundedRect(statusX, yPos - 6, statusWidth, 12, 6, 6, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pageWidth / 2, yPos + 2, { align: "center" });
  
  yPos += 20;
  
  // Token Number (if available)
  if (appointment.token_number) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...goldColor);
    doc.roundedRect(20, yPos, pageWidth - 40, 48, 5, 5, "FD");
    
    doc.setTextColor(...mutedColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("VIP CHAIR TOKEN NUMBER", pageWidth / 2, yPos + 12, { align: "center" });
    
    doc.setTextColor(...darkBgColor);
    doc.setFontSize(34);
    doc.setFont("helvetica", "bold");
    doc.text(`#${appointment.token_number}`, pageWidth / 2, yPos + 33, { align: "center" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedColor);
    doc.text("Present this pass at front desk for expedited seating", pageWidth / 2, yPos + 43, { align: "center" });
    
    yPos += 58;
  }
  
  // Appointment Details Section
  doc.setTextColor(...textColor);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Reservation Details", 20, yPos);
  yPos += 8;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  const appointmentDetails = [
    { label: "Date", value: format(new Date(appointment.appointment_date), "EEEE, MMMM d, yyyy") },
    { label: "Time Slot", value: appointment.appointment_time },
    { label: "Service Style", value: (appointment.appointment_type || "Signature Styling").toUpperCase() },
    { label: "Reservation ID", value: appointment.id.slice(0, 8).toUpperCase() },
  ];
  
  appointmentDetails.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text(item.label, 20, yPos);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(item.value, pageWidth - 20, yPos, { align: "right" });
    yPos += 9;
  });
  
  yPos += 8;
  
  // Master Stylist Details Section
  doc.setTextColor(...textColor);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Master Stylist Details", 20, yPos);
  yPos += 8;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  const doctorDetails = [
    { label: "Stylist", value: doctor.name },
    { label: "Specialty", value: doctor.specialization || "Fade & Beard Architecture" },
    { label: "Experience", value: doctor.qualification || "Master Barber" },
    { label: "Service Rate", value: `INR ${Number(doctor.consultation_fee || 0).toFixed(2)}` },
  ];
  
  doctorDetails.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text(item.label, 20, yPos);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(item.value, pageWidth - 20, yPos, { align: "right" });
    yPos += 9;
  });
  
  yPos += 8;
  
  // Hospital/Salon Details Section
  doc.setTextColor(...textColor);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Salon Studio Location", 20, yPos);
  yPos += 8;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Studio", 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text(hospital.name, pageWidth - 20, yPos, { align: "right" });
  yPos += 9;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Address", 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  const fullAddress = `${hospital.address}, ${hospital.city}`;
  doc.text(fullAddress, pageWidth - 20, yPos, { align: "right" });
  yPos += 9;
  
  if (hospital.phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text("Contact", 20, yPos);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textColor);
    doc.text(hospital.phone, pageWidth - 20, yPos, { align: "right" });
    yPos += 12;
  }
  
  // Special Instructions (if any)
  if (appointment.special_instructions) {
    doc.setTextColor(...textColor);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Notes / Customizations", 20, yPos);
    yPos += 8;
    
    doc.setDrawColor(226, 232, 240);
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
  doc.setDrawColor(226, 232, 240);
  doc.line(20, footerY, pageWidth - 20, footerY);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Thank you for choosing FadeCraft - Luxury Barber & Salon Experience", pageWidth / 2, footerY + 10, { align: "center" });
  doc.text(`Issued digitally on ${format(new Date(), "PPP 'at' p")}`, pageWidth / 2, footerY + 18, { align: "center" });
  
  // Save the PDF
  const fileName = `FadeCraft-VIP-Pass-${appointment.token_number || appointment.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};
