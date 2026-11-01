-- Migration: Prevent double bookings and conflicting reservations
-- Ensures that no two active appointments (status 'scheduled' or 'confirmed') can exist
-- for the same stylist/doctor on the same date and time slot.

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment_slot
ON public.appointments (doctor_id, appointment_date, appointment_time)
WHERE status IN ('scheduled', 'confirmed');

-- Comment explaining purpose
COMMENT ON INDEX idx_unique_active_appointment_slot IS 'Guarantees that a chair/stylist cannot be double-booked for the same timeslot.';
