-- Security + functionality fixes

-- 1) Payments: add defense-in-depth validation and prevent immutable-field tampering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_amount_positive'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_status_valid'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_status_valid
      CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_payment_immutable_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  -- Hard validation (defense in depth)
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount';
  END IF;

  IF NEW.status NOT IN ('pending', 'completed', 'failed', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  -- Prevent tampering with immutable fields after creation
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id THEN
    RAISE EXCEPTION 'Payment immutable fields cannot be modified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_prevent_immutable_updates ON public.payments;
CREATE TRIGGER payments_prevent_immutable_updates
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_payment_immutable_updates();


-- 2) Profiles: allow users to delete their own medical profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can delete their own profile'
  ) THEN
    CREATE POLICY "Users can delete their own profile"
      ON public.profiles
      FOR DELETE
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;


-- 3) Doctors: make directory usable + prevent public exposure of doctor emails
-- Ensure newly-created doctors are visible in the public directory by default.
ALTER TABLE public.doctors
  ALTER COLUMN is_public SET DEFAULT true;

-- Backfill existing doctors so search results are not empty.
UPDATE public.doctors
SET is_public = true
WHERE is_public IS DISTINCT FROM true;

-- Column-level protection: prevent anon/authenticated from selecting doctor emails.
REVOKE SELECT (email) ON TABLE public.doctors FROM anon, authenticated;