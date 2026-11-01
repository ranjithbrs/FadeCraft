import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Clock, Calendar as CalendarIcon, DollarSign, Scissors, Sparkles, Crown, ShieldAlert } from "lucide-react";
import { useDoctorById } from "@/hooks/useDoctors";
import { useAvailableSlots } from "@/hooks/useTimeSlots";
import { supabase } from "@/integrations/supabase/client";

// Standard salon operating hours (fallback when stylist hasn't defined custom slots)
const DEFAULT_SALON_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00"
];

const Booking = () => {
  const [searchParams] = useSearchParams();
  const doctorId = searchParams.get("doctor");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("signature_fade");
  const [tokenType, setTokenType] = useState<"normal" | "priority" | "premium">("normal");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  const { data: doctorData, isLoading: doctorLoading } = useDoctorById(doctorId || undefined);
  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : undefined;
  
  const { data: rawAvailableSlots = [], isLoading: slotsLoading } = useAvailableSlots(
    doctorId || undefined,
    selectedDateStr
  );

  const doctor = doctorData;
  const hospital = doctorData?.hospitals;
  const loading = doctorLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Combine DB slots or fallback salon slots, and filter out past times if date is today
  const computedSlots = useMemo(() => {
    if (!selectedDate) return [];

    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    let baseSlots: { slot_time: string; is_booked: boolean }[] = [];

    if (rawAvailableSlots.length > 0) {
      baseSlots = rawAvailableSlots;
    } else {
      // Use standard salon hours as fallback
      baseSlots = DEFAULT_SALON_SLOTS.map((time) => ({
        slot_time: time,
        is_booked: false,
      }));
    }

    return baseSlots.map((slot) => {
      const [slotH, slotM] = slot.slot_time.split(":").map(Number);
      const isPast = isToday && (slotH < currentHour || (slotH === currentHour && slotM <= currentMinute));
      return {
        ...slot,
        is_booked: slot.is_booked || isPast,
        is_past: isPast,
      };
    });
  }, [selectedDate, rawAvailableSlots]);

  const handleBooking = async () => {
    if (!user || !doctor || !hospital) {
      navigate("/auth");
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast({
        title: "Incomplete Selection",
        description: "Please choose both a date and chair time slot.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingConflict(true);

    try {
      // Double booking check: Ensure slot is not already booked in Supabase
      const { data: existingBooking, error: checkError } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", selectedDateStr)
        .eq("appointment_time", selectedTime)
        .in("status", ["scheduled", "confirmed"])
        .maybeSingle();

      if (checkError) {
        console.warn("Could not check conflicts online, proceeding with caution:", checkError);
      }

      if (existingBooking) {
        toast({
          title: "Chair Unavailable",
          description: "This slot was just reserved by another client. Please select another time.",
          variant: "destructive",
        });
        setSelectedTime("");
        return;
      }

      const feeMultiplier = tokenType === "premium" ? 0.75 : tokenType === "priority" ? 0.5 : 0;
      const priorityFee = Math.round(doctor.consultation_fee * feeMultiplier);
      
      navigate("/payment", {
        state: {
          bookingData: {
            doctorId: doctorId!,
            doctorName: doctor.name,
            doctorSpecialization: doctor.specialization,
            hospitalId: hospital.id,
            hospitalName: hospital.name,
            appointmentDate: selectedDateStr,
            appointmentTime: selectedTime,
            appointmentType: appointmentType,
            tokenType: tokenType,
            specialInstructions: specialInstructions,
            consultationFee: doctor.consultation_fee,
            priorityFee: priorityFee,
          },
        },
      });
    } catch (err: any) {
      console.error("Conflict check error:", err);
      toast({
        title: "Booking Error",
        description: err.message || "Unable to verify chair availability. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingConflict(false);
    }
  };

  if (loading || authLoading || !user) {
    return (
      <MainLayout>
        <div className="container py-12 text-center text-slate-400">
          Loading stylist & chair availability...
        </div>
      </MainLayout>
    );
  }

  if (!doctor || !hospital) {
    return (
      <MainLayout>
        <div className="container py-12 text-center text-slate-400">
          Stylist not found. Please explore our studio list.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-6 px-4 max-w-4xl mx-auto text-slate-100 min-h-screen">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-100">Reserve a Chair</h1>
          <p className="text-xs text-slate-400 mt-0.5">Select your preferred date, time slot, and grooming package</p>
        </div>

        {/* Stylist Summary */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/40">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              {doctor.photo ? (
                <img
                  src={doctor.photo}
                  alt={doctor.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700/80 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl">
                  FC
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-base text-slate-100">{doctor.name}</h3>
                <p className="text-xs text-amber-400 font-medium">{doctor.specialization || "Master Stylist & Barber"}</p>
                <p className="text-xs text-slate-400 mt-0.5">{hospital.name}</p>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-300">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Standard Cut: ₹{doctor.consultation_fee}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Selection */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100 text-base font-bold">
              <CalendarIcon className="h-4 w-4 text-amber-400" />
              Choose Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-xl border border-slate-800 bg-slate-950/60 w-full text-slate-100"
            />
          </CardContent>
        </Card>

        {/* Time Selection */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100 text-base font-bold">
              <Clock className="h-4 w-4 text-amber-400" />
              Select Chair Slot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Checking available chairs...</div>
            ) : computedSlots.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                {selectedDate ? "No chair slots available for this date" : "Please select a date first"}
              </div>
            ) : (
              <div className="space-y-4">
                {/* AM Slots */}
                {computedSlots.filter(s => parseInt(s.slot_time.split(':')[0]) < 12).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Morning (AM)</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {computedSlots
                        .filter(s => parseInt(s.slot_time.split(':')[0]) < 12)
                        .map((slot) => (
                          <Button
                            key={slot.slot_time}
                            variant={selectedTime === slot.slot_time ? "default" : "outline"}
                            className={`w-full text-xs font-semibold ${
                              selectedTime === slot.slot_time 
                                ? "bg-amber-500 text-slate-950 hover:bg-amber-400" 
                                : slot.is_booked 
                                  ? "bg-slate-950/40 text-slate-600 border-slate-800/50 cursor-not-allowed" 
                                  : "bg-slate-950 border-slate-800 text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
                            }`}
                            onClick={() => setSelectedTime(slot.slot_time)}
                            disabled={slot.is_booked}
                          >
                            {slot.slot_time}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                {/* PM Slots */}
                {computedSlots.filter(s => parseInt(s.slot_time.split(':')[0]) >= 12).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Afternoon / Evening (PM)</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {computedSlots
                        .filter(s => parseInt(s.slot_time.split(':')[0]) >= 12)
                        .map((slot) => (
                          <Button
                            key={slot.slot_time}
                            variant={selectedTime === slot.slot_time ? "default" : "outline"}
                            className={`w-full text-xs font-semibold ${
                              selectedTime === slot.slot_time 
                                ? "bg-amber-500 text-slate-950 hover:bg-amber-400" 
                                : slot.is_booked 
                                  ? "bg-slate-950/40 text-slate-600 border-slate-800/50 cursor-not-allowed" 
                                  : "bg-slate-950 border-slate-800 text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
                            }`}
                            onClick={() => setSelectedTime(slot.slot_time)}
                            disabled={slot.is_booked}
                          >
                            {slot.slot_time}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grooming Service Type */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold flex items-center gap-2">
              <Scissors className="h-4 w-4 text-amber-400" />
              Grooming Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup name="service-type" value={appointmentType} onValueChange={setAppointmentType} className="space-y-2">
              <div className={`flex items-center justify-between p-3 rounded-xl border ${appointmentType === 'signature_fade' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="signature_fade" id="signature_fade" />
                  <Label htmlFor="signature_fade" className="cursor-pointer">
                    <span className="font-semibold text-sm text-slate-100">Signature Haircut & Fade</span>
                    <p className="text-xs text-slate-400">Skin fade, taper, crop, or textured styling (35 min)</p>
                  </Label>
                </div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-xl border ${appointmentType === 'beard_sculpt' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="beard_sculpt" id="beard_sculpt" />
                  <Label htmlFor="beard_sculpt" className="cursor-pointer">
                    <span className="font-semibold text-sm text-slate-100">Royal Beard Sculpt & Hot Towel</span>
                    <p className="text-xs text-slate-400">Razor sharp lines, beard oil & steam treatment (20 min)</p>
                  </Label>
                </div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-xl border ${appointmentType === 'vip_combo' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="vip_combo" id="vip_combo" />
                  <Label htmlFor="vip_combo" className="cursor-pointer">
                    <span className="font-semibold text-sm text-slate-100">Full Head & Beard Experience</span>
                    <p className="text-xs text-slate-400">Precision cut + beard sculpt + head massage (50 min)</p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Chair Pass Priority */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Queue Pass Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup name="token-type" value={tokenType} onValueChange={(v) => setTokenType(v as typeof tokenType)} className="space-y-2">
              {/* Normal */}
              <div className={`flex items-center justify-between p-3 rounded-xl border ${tokenType === 'normal' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal" className="cursor-pointer">
                    <span className="font-semibold text-sm text-slate-100">Standard Chair Pass</span>
                    <p className="text-xs text-slate-400">Regular sequential chair turn</p>
                  </Label>
                </div>
                <span className="font-bold text-amber-400 text-sm">₹{doctor.consultation_fee}</span>
              </div>

              {/* Priority */}
              <div className={`flex items-center justify-between p-3 rounded-xl border ${tokenType === 'priority' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="priority" id="priority" />
                  <Label htmlFor="priority" className="cursor-pointer">
                    <span className="font-semibold text-sm text-amber-300">⚡ Express VIP Pass</span>
                    <p className="text-xs text-slate-400">Next chair priority call (+50%)</p>
                  </Label>
                </div>
                <span className="font-bold text-amber-400 text-sm">
                  ₹{doctor.consultation_fee + Math.round(doctor.consultation_fee * 0.5)}
                </span>
              </div>

              {/* Premium */}
              <div className={`flex items-center justify-between p-3 rounded-xl border ${tokenType === 'premium' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="premium" id="premium" />
                  <Label htmlFor="premium" className="cursor-pointer">
                    <span className="font-semibold text-sm text-amber-300">👑 Royal Member Pass</span>
                    <p className="text-xs text-slate-400">Guaranteed immediate seat & lounge access (+75%)</p>
                  </Label>
                </div>
                <span className="font-bold text-amber-400 text-sm">
                  ₹{doctor.consultation_fee + Math.round(doctor.consultation_fee * 0.75)}
                </span>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Grooming Instructions */}
        <Card className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base font-bold">Styling Preferences (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="E.g., Low drop fade, 1.5 on top, square beard trim, sensitive skin..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl text-xs"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 pb-8">
          <Button
            variant="outline"
            className="flex-1 bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
            onClick={handleBooking}
            disabled={!selectedDate || !selectedTime || isCheckingConflict}
          >
            {isCheckingConflict ? "Checking Chair Availability..." : "Proceed to VIP Checkout"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Booking;