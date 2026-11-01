-- Migration: Atomic double-booking prevention & chair concurrency lock
-- 1. Deduplicate legacy active appointments before constraint creation
-- 2. Partial unique index to guarantee no two active reservations can occupy the same slot
-- 3. Atomic booking stored procedure with advisory transaction locking (book_chair_appointment_atomic)

-- Step 1: Clean up any existing duplicate active records so the unique index creation succeeds safely
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Identify and safely resolve duplicates by keeping the most recently updated/created record
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

-- Step 3: Atomic Stored Procedure for serialized booking & collision recovery
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
SET search_path = public
AS $$
DECLARE
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
      RAISE EXCEPTION 'SLOT_ALREADY_RESERVED' USING ERRCODE = '23505';
    END IF;

    WHILE v_slot_occupied AND v_attempts < v_max_attempts LOOP
      v_attempts := v_attempts + 1;
      v_target_time := v_target_time + INTERVAL '30 minutes';

      SELECT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE doctor_id = p_doctor_id
          AND appointment_date = p_appointment_date
          AND appointment_time = v_target_time
          AND status IN ('scheduled', 'confirmed')
      ) INTO v_slot_occupied;
    END LOOP;

    IF v_slot_occupied THEN
      RAISE EXCEPTION 'NO_AVAILABLE_SLOTS: No chair availability remaining for this date';
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

  -- Insert the appointment
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
    p_appointment_type,
    p_token_type,
    v_notes,
    v_next_token,
    'confirmed'
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY
  SELECT v_new_id, v_target_time, v_next_token, v_reallocated, 'confirmed'::TEXT;
EXCEPTION
  WHEN unique_violation THEN
    -- In the event of a constraint collision, fallback cleanly
    IF p_auto_reallocate THEN
      -- Re-invoke with next slot
      RETURN QUERY
      SELECT * FROM public.book_chair_appointment_atomic(
        p_user_id,
        p_doctor_id,
        p_hospital_id,
        p_appointment_date,
        p_appointment_time + INTERVAL '30 minutes',
        p_appointment_type,
        p_token_type,
        p_special_instructions,
        TRUE
      );
    ELSE
      RAISE EXCEPTION 'SLOT_ALREADY_RESERVED' USING ERRCODE = '23505';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_chair_appointment_atomic TO authenticated, service_role, anon;
