-- Migration: Atomic double-booking prevention, chair concurrency lock & security audit
-- 1. Deduplicate legacy active appointments before constraint creation
-- 2. Partial unique index to guarantee no two active reservations can occupy the same slot
-- 3. Hardened atomic booking stored procedure with role authorization, identity anti-spoofing,
--    and strict parameter validation. Anonymous execution is strictly revoked.

-- Step 1: Clean up any existing duplicate active records so the unique index creation succeeds safely
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Identify and safely resolve duplicates by keeping the most recently created record
  -- and marking older conflicting duplicates as 'cancelled' with an explanatory note.
  WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY doctor_id, appointment_date, appointment_time
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM public.appointments
    WHERE status IN ('scheduled', 'confirmed')
  )
  UPDATE public.appointments
  SET status = 'cancelled',
      special_instructions = COALESCE(special_instructions || ' | ', '') || 'Auto-resolved legacy duplicate booking'
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );

  GET DIAGNOSTICS dup_count = ROW_COUNT;
  IF dup_count > 0 THEN
    RAISE NOTICE 'Resolved % legacy duplicate active appointment(s)', dup_count;
  END IF;
END $$;

-- Step 2: Create partial unique index on active appointments
-- Note: Cancelled appointments ('cancelled') are explicitly excluded from this index,
-- allowing customers to re-book cancelled slots without restriction.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment_slot
ON public.appointments (doctor_id, appointment_date, appointment_time)
WHERE status IN ('scheduled', 'confirmed');

COMMENT ON INDEX idx_unique_active_appointment_slot IS 
  'Enforces database-level constraint: no two active (scheduled/confirmed) reservations can occupy the same stylist/chair at the same date and time. Cancelled bookings are excluded.';

-- Step 3: Hardened Atomic Stored Procedure for serialized booking & collision recovery
CREATE OR REPLACE FUNCTION public.book_chair_appointment_atomic(
  p_user_id UUID,
  p_doctor_id UUID,
  p_hospital_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_appointment_type TEXT DEFAULT 'consultation',
  p_token_type TEXT DEFAULT 'normal',
  p_special_instructions TEXT DEFAULT NULL,
  p_auto_reallocate BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  appointment_id UUID,
  final_time TIME,
  token_number INTEGER,
  reallocated BOOLEAN,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
  v_auth_uid UUID;
  v_lock_key BIGINT;
  v_slot_occupied BOOLEAN;
  v_target_time TIME := p_appointment_time;
  v_next_token INTEGER;
  v_reallocated BOOLEAN := FALSE;
  v_notes TEXT := p_special_instructions;
  v_new_id UUID;
  v_attempts INTEGER := 0;
  v_max_attempts CONSTANT INTEGER := 10;
BEGIN
  -- =========================================================================
  -- SECURITY & AUTHORIZATION AUDIT CHECKS
  -- =========================================================================

  -- 1. Identify caller role and session ID
  v_caller_role := COALESCE(auth.role(), 'none');
  v_auth_uid := auth.uid();

  -- 2. Reject anonymous callers immediately
  IF v_caller_role = 'anon' OR (v_caller_role = 'none' AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Anonymous callers are not permitted to create appointments'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Anti-impersonation guard for authenticated clients:
  -- Authenticated users may ONLY book appointments for their own authenticated user_id
  IF v_caller_role = 'authenticated' THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Valid authenticated user session required'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NULL OR p_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'FORBIDDEN: Identity mismatch. Authenticated callers can only book appointments for their own account'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- =========================================================================
  -- COMPREHENSIVE INPUT VALIDATION
  -- =========================================================================

  -- Validate User ID
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: p_user_id cannot be null' USING ERRCODE = '22023';
  END IF;

  -- Validate Doctor / Stylist ID
  IF p_doctor_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: p_doctor_id cannot be null' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctors WHERE id = p_doctor_id) THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Stylist % does not exist', p_doctor_id USING ERRCODE = '22023';
  END IF;

  -- Validate Hospital / Studio ID
  IF p_hospital_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: p_hospital_id cannot be null' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hospitals WHERE id = p_hospital_id) THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Studio % does not exist', p_hospital_id USING ERRCODE = '22023';
  END IF;

  -- Validate Appointment Date
  IF p_appointment_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: p_appointment_date cannot be null' USING ERRCODE = '22023';
  END IF;

  IF p_appointment_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Cannot book appointments in the past (date: %)', p_appointment_date
      USING ERRCODE = '22023';
  END IF;

  IF p_appointment_date > (CURRENT_DATE + INTERVAL '90 days') THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Appointments cannot be booked more than 90 days in advance'
      USING ERRCODE = '22023';
  END IF;

  -- Validate Appointment Time
  IF p_appointment_time IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: p_appointment_time cannot be null' USING ERRCODE = '22023';
  END IF;

  IF p_appointment_time < TIME '07:00:00' OR p_appointment_time > TIME '22:00:00' THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Appointment time % is outside salon operating hours (07:00 - 22:00)', p_appointment_time
      USING ERRCODE = '22023';
  END IF;

  IF p_appointment_date = CURRENT_DATE AND p_appointment_time < CURRENT_TIME THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Cannot book a time slot in the past for today (time: %)', p_appointment_time
      USING ERRCODE = '22023';
  END IF;

  -- Validate Token Type
  IF p_token_type IS NOT NULL AND p_token_type NOT IN ('normal', 'vip') THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Invalid token_type "%". Must be "normal" or "vip"', p_token_type
      USING ERRCODE = '22023';
  END IF;

  -- Sanitize string lengths
  IF p_appointment_type IS NOT NULL AND length(p_appointment_type) > 60 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: appointment_type exceeds maximum 60 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_special_instructions IS NOT NULL AND length(p_special_instructions) > 500 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: special_instructions exceeds maximum 500 characters'
      USING ERRCODE = '22023';
  END IF;

  -- =========================================================================
  -- ATOMIC CONCURRENCY LOCK & SERIALIZED RESERVATION
  -- =========================================================================

  -- Acquire an advisory transaction lock scoped to (doctor_id, date) to serialize concurrent bookings
  v_lock_key := ('x' || substr(md5(p_doctor_id::text || p_appointment_date::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Check if requested slot is already reserved by an active booking
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_appointment_date
      AND appointment_time = v_target_time
      AND status IN ('scheduled', 'confirmed')
  ) INTO v_slot_occupied;

  -- If occupied and auto-reallocation is allowed, find next free 30-min slot
  IF v_slot_occupied THEN
    IF NOT p_auto_reallocate THEN
      RAISE EXCEPTION 'SLOT_ALREADY_RESERVED: Requested chair slot is already reserved' USING ERRCODE = '23505';
    END IF;

    WHILE v_slot_occupied AND v_attempts < v_max_attempts LOOP
      v_attempts := v_attempts + 1;
      v_target_time := v_target_time + INTERVAL '30 minutes';

      -- Ensure target time doesn't exceed closing hours
      IF v_target_time > TIME '22:00:00' THEN
        RAISE EXCEPTION 'NO_AVAILABLE_SLOTS: No chair availability remaining before studio closing time'
          USING ERRCODE = '23505';
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE doctor_id = p_doctor_id
          AND appointment_date = p_appointment_date
          AND appointment_time = v_target_time
          AND status IN ('scheduled', 'confirmed')
      ) INTO v_slot_occupied;
    END LOOP;

    IF v_slot_occupied THEN
      RAISE EXCEPTION 'NO_AVAILABLE_SLOTS: No chair availability remaining for this date'
        USING ERRCODE = '23505';
    END IF;

    v_reallocated := TRUE;
    v_notes := COALESCE(v_notes || ' | ', '') || 'Slot adjusted automatically to prevent concurrent conflict.';
  END IF;

  -- Atomically calculate next token number
  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO v_next_token
  FROM public.appointments
  WHERE doctor_id = p_doctor_id
    AND appointment_date = p_appointment_date;

  -- Insert the confirmed appointment atomically
  INSERT INTO public.appointments (
    user_id,
    doctor_id,
    hospital_id,
    appointment_date,
    appointment_time,
    appointment_type,
    token_type,
    special_instructions,
    token_number,
    status
  ) VALUES (
    p_user_id,
    p_doctor_id,
    p_hospital_id,
    p_appointment_date,
    v_target_time,
    COALESCE(p_appointment_type, 'consultation'),
    COALESCE(p_token_type, 'normal'),
    v_notes,
    v_next_token,
    'confirmed'
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY
  SELECT v_new_id, v_target_time, v_next_token, v_reallocated, 'confirmed'::TEXT;

EXCEPTION
  WHEN unique_violation THEN
    -- Fallback safety net for physical constraint collision
    IF p_auto_reallocate AND v_attempts < v_max_attempts THEN
      v_target_time := v_target_time + INTERVAL '30 minutes';
      SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_next_token
      FROM public.appointments WHERE doctor_id = p_doctor_id AND appointment_date = p_appointment_date;

      INSERT INTO public.appointments (
        user_id, doctor_id, hospital_id, appointment_date, appointment_time,
        appointment_type, token_type, special_instructions, token_number, status
      ) VALUES (
        p_user_id, p_doctor_id, p_hospital_id, p_appointment_date, v_target_time,
        COALESCE(p_appointment_type, 'consultation'), COALESCE(p_token_type, 'normal'),
        COALESCE(p_special_instructions || ' | ', '') || 'Slot adjusted automatically via constraint fallback.',
        v_next_token, 'confirmed'
      )
      RETURNING id INTO v_new_id;

      RETURN QUERY SELECT v_new_id, v_target_time, v_next_token, TRUE, 'confirmed'::TEXT;
    ELSE
      RAISE EXCEPTION 'SLOT_ALREADY_RESERVED: Requested chair slot is already reserved' USING ERRCODE = '23505';
    END IF;
END;
$$;

-- =========================================================================
-- STRICT PRIVILEGE RESTRICTION
-- =========================================================================
-- Revoke all permissions from PUBLIC and anon (unauthenticated callers)
REVOKE ALL ON FUNCTION public.book_chair_appointment_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_chair_appointment_atomic FROM anon;

-- Grant execution ONLY to trusted service_role (Edge Functions) and authenticated users
GRANT EXECUTE ON FUNCTION public.book_chair_appointment_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.book_chair_appointment_atomic TO authenticated;
