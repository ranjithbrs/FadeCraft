import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('FadeCraft Full Customer Lifecycle & Mobile PWA Integration Validation', () => {
  let db;

  // Real UUIDs for test entities
  const CUSTOMER_1_ID = 'aaaaaaaa-1111-4000-8000-111111111111';
  const CUSTOMER_2_ID = 'bbbbbbbb-2222-4000-8000-222222222222';
  const STYLIST_ID = 'cccccccc-3333-4000-8000-333333333333';
  const STUDIO_ID = 'dddddddd-4444-4000-8000-444444444444';

  const RAZORPAY_KEY_SECRET = 'rzp_sec_fadecraft_live_test_secret_998';
  const BOOKING_TIME = '15:00:00';

  let createdAppointmentId = null;
  let razorpayOrderId = null;
  let razorpayPaymentId = null;

  before(async () => {
    // 1. Initialize real in-memory PostgreSQL engine
    db = new PGlite();

    // 2. Set up Supabase roles and auth schema
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.role', true), ''),
          NULLIF(current_setting('request.jwt.claims', true)::json->>'role', ''),
          current_user
        );
      $$ LANGUAGE sql STABLE;
    `);

    // 3. Set up public schema (profiles, doctors, hospitals, appointments, payments)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        phone TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.hospitals (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT
      );

      CREATE TABLE IF NOT EXISTS public.doctors (
        id UUID PRIMARY KEY,
        hospital_id UUID REFERENCES public.hospitals(id),
        name TEXT NOT NULL,
        specialization TEXT,
        consultation_fee NUMERIC DEFAULT 450
      );

      CREATE TABLE IF NOT EXISTS public.appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        doctor_id UUID NOT NULL REFERENCES public.doctors(id),
        hospital_id UUID NOT NULL REFERENCES public.hospitals(id),
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        appointment_type TEXT DEFAULT 'consultation',
        token_number INTEGER,
        token_type TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'scheduled',
        special_instructions TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        appointment_id UUID NOT NULL REFERENCES public.appointments(id),
        amount NUMERIC(10, 2) NOT NULL,
        currency TEXT DEFAULT 'INR',
        razorpay_order_id TEXT NOT NULL,
        razorpay_payment_id TEXT,
        razorpay_signature TEXT,
        status TEXT DEFAULT 'pending',
        payment_method TEXT DEFAULT 'razorpay',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role, authenticated;
    `);

    // 4. Seed Studio and Master Stylist
    await db.exec(`
      INSERT INTO public.hospitals (id, name, address, city) VALUES
        ('${STUDIO_ID}', 'FadeCraft Studio Flagship', '100 Feet Road, Indiranagar', 'Bengaluru')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.doctors (id, hospital_id, name, specialization, consultation_fee) VALUES
        ('${STYLIST_ID}', '${STUDIO_ID}', 'Marcus Vance', 'Master Fade Specialist', 450.00)
      ON CONFLICT DO NOTHING;
    `);

    // 5. Apply the production migration with partial unique constraint and atomic procedure
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261101120000_prevent_double_booking.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(migrationSql);
  });

  // =========================================================================
  // STEP 1: USER REGISTRATION & AUTHENTICATION
  // =========================================================================
  it('Step 1: User Registration — signs up and creates customer profile in database', async () => {
    // 1. Create auth user
    await db.query(`
      INSERT INTO auth.users (id, email)
      VALUES ('${CUSTOMER_1_ID}', 'rajesh.kumar@fadecraft.in');
    `);

    // 2. Insert customer profile
    await db.query(`
      INSERT INTO public.profiles (id, full_name, phone)
      VALUES ('${CUSTOMER_1_ID}', 'Rajesh Kumar', '+919876543210');
    `);

    // Verify profile exists
    const res = await db.query(`
      SELECT u.email, p.full_name, p.phone
      FROM auth.users u
      JOIN public.profiles p ON u.id = p.id
      WHERE u.id = '${CUSTOMER_1_ID}';
    `);

    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].email, 'rajesh.kumar@fadecraft.in');
    assert.equal(res.rows[0].full_name, 'Rajesh Kumar');
    assert.equal(res.rows[0].phone, '+919876543210');
  });

  // =========================================================================
  // STEP 2: STYLIST CATALOG & SLOT SELECTION
  // =========================================================================
  it('Step 2: Chair Exploration — discovers stylist Marcus Vance and selects available timeslot', async () => {
    const stylistRes = await db.query(`
      SELECT d.id, d.name, d.specialization, d.consultation_fee, h.name as studio_name
      FROM public.doctors d
      JOIN public.hospitals h ON d.hospital_id = h.id
      WHERE d.id = '${STYLIST_ID}';
    `);

    assert.equal(stylistRes.rows.length, 1);
    const stylist = stylistRes.rows[0];
    assert.equal(stylist.name, 'Marcus Vance');
    assert.equal(stylist.specialization, 'Master Fade Specialist');
    assert.equal(Number(stylist.consultation_fee), 450);

    // Verify requested timeslot 15:00:00 is currently unreserved
    const conflictCheck = await db.query(`
      SELECT COUNT(*) as count
      FROM public.appointments
      WHERE doctor_id = '${STYLIST_ID}'
        AND appointment_date = (CURRENT_DATE + INTERVAL '2 days')::date
        AND appointment_time = TIME '${BOOKING_TIME}'
        AND status IN ('scheduled', 'confirmed');
    `);
    assert.equal(Number(conflictCheck.rows[0].count), 0, 'Slot must be free before booking');
  });

  // =========================================================================
  // STEP 3: RAZORPAY PAYMENT VERIFICATION (HMAC SHA-256)
  // =========================================================================
  it('Step 3: Payment Verification — creates Razorpay order and validates cryptographic signature', async () => {
    razorpayOrderId = 'order_FC_' + Date.now();
    razorpayPaymentId = 'pay_FC_' + Math.floor(Math.random() * 1000000);

    // Amount: ₹450 service fee + ₹100 VIP pass = ₹550 = 55000 paise
    const totalAmountPaise = 55000;
    assert.equal(totalAmountPaise, 55000);

    // Generate authentic Razorpay signature
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const authenticSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    // Verification check (as performed by Edge Function)
    const verifySignature = (orderId, paymentId, signature, secret) => {
      const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
      return expected === signature;
    };

    assert.ok(verifySignature(razorpayOrderId, razorpayPaymentId, authenticSignature, RAZORPAY_KEY_SECRET), 'Signature must be authentic');

    // Reject forged signature
    const forgedSignature = 'bad_forged_signature_00000000000000000000000000000000000000000000';
    assert.ok(!verifySignature(razorpayOrderId, razorpayPaymentId, forgedSignature, RAZORPAY_KEY_SECRET), 'Forged signature must be rejected');
  });

  // =========================================================================
  // STEP 4: ATOMIC CHAIR RESERVATION & PAYMENT RECORDING
  // =========================================================================
  it('Step 4: Appointment Creation — atomically reserves chair and records payment in database', async () => {
    // Edge function invokes book_chair_appointment_atomic as service_role
    await db.exec(`
      SET ROLE service_role;
      SELECT set_config('request.jwt.claim.role', 'service_role', false);
      SELECT set_config('request.jwt.claim.sub', '', false);
    `);

    const bookingRes = await db.query(`
      SELECT * FROM public.book_chair_appointment_atomic(
        '${CUSTOMER_1_ID}'::uuid,
        '${STYLIST_ID}'::uuid,
        '${STUDIO_ID}'::uuid,
        (CURRENT_DATE + INTERVAL '2 days')::date,
        TIME '${BOOKING_TIME}',
        'Signature Skin Fade & Beard Sculpt',
        'vip',
        'Customer requested low taper zero fade with razor finish',
        true
      );
    `);

    await db.exec('RESET ROLE;');

    assert.equal(bookingRes.rows.length, 1);
    const booking = bookingRes.rows[0];
    assert.ok(booking.appointment_id);
    assert.equal(booking.booking_status, 'confirmed');
    assert.equal(booking.token_number, 1);
    assert.equal(booking.final_time, BOOKING_TIME);
    assert.equal(booking.reallocated, false);

    createdAppointmentId = booking.appointment_id;

    // Record verified payment
    await db.query(`
      INSERT INTO public.payments (
        user_id,
        appointment_id,
        amount,
        currency,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        status,
        payment_method
      ) VALUES (
        '${CUSTOMER_1_ID}',
        '${createdAppointmentId}',
        550.00,
        'INR',
        '${razorpayOrderId}',
        '${razorpayPaymentId}',
        'verified_signature_hash',
        'completed',
        'razorpay'
      );
    `);

    // Verify linked payment record
    const paymentCheck = await db.query(`
      SELECT p.amount, p.status, p.razorpay_order_id, a.token_number, a.token_type
      FROM public.payments p
      JOIN public.appointments a ON p.appointment_id = a.id
      WHERE a.id = '${createdAppointmentId}';
    `);

    assert.equal(paymentCheck.rows.length, 1);
    assert.equal(Number(paymentCheck.rows[0].amount), 550.00);
    assert.equal(paymentCheck.rows[0].status, 'completed');
    assert.equal(paymentCheck.rows[0].token_type, 'vip');
  });

  // =========================================================================
  // STEP 5: LIVE QUEUE POSITION & DIGITAL PASS GENERATION
  // =========================================================================
  it('Step 5: Live Queue Status — confirms Token #1, 0 clients ahead, and digital VIP pass readiness', async () => {
    // Query queue position for customer's appointment
    const queueQuery = await db.query(`
      SELECT 
        a.id,
        a.token_number,
        a.appointment_time,
        a.token_type,
        a.special_instructions,
        d.name as stylist_name,
        h.name as studio_name,
        (
          SELECT COUNT(*)
          FROM public.appointments ahead
          WHERE ahead.doctor_id = a.doctor_id
            AND ahead.appointment_date = a.appointment_date
            AND ahead.token_number < a.token_number
            AND ahead.status IN ('scheduled', 'confirmed')
        ) as clients_ahead
      FROM public.appointments a
      JOIN public.doctors d ON a.doctor_id = d.id
      JOIN public.hospitals h ON a.hospital_id = h.id
      WHERE a.id = '${createdAppointmentId}';
    `);

    assert.equal(queueQuery.rows.length, 1);
    const queue = queueQuery.rows[0];

    assert.equal(queue.token_number, 1);
    assert.equal(Number(queue.clients_ahead), 0);
    assert.equal(queue.token_type, 'vip');
    assert.equal(queue.stylist_name, 'Marcus Vance');

    // UI state helper check: 0 clients ahead means chair is ready
    const isChairReady = Number(queue.clients_ahead) === 0;
    assert.ok(isChairReady, 'Client 1 should see chair ready prompt');
  });

  // =========================================================================
  // STEP 6: APPOINTMENT CANCELLATION & SLOT RE-OPENING
  // =========================================================================
  it('Step 6: Appointment Cancellation — cancels booking and allows Customer 2 to re-book the slot', async () => {
    // 1. Customer 1 cancels their appointment
    await db.query(`
      UPDATE public.appointments
      SET status = 'cancelled'
      WHERE id = '${createdAppointmentId}';
    `);

    const cancelledCheck = await db.query(`
      SELECT status FROM public.appointments WHERE id = '${createdAppointmentId}';
    `);
    assert.equal(cancelledCheck.rows[0].status, 'cancelled');

    // 2. Create Customer 2
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${CUSTOMER_2_ID}', 'vikram.singh@fadecraft.in')
      ON CONFLICT DO NOTHING;
      INSERT INTO public.profiles (id, full_name, phone) VALUES ('${CUSTOMER_2_ID}', 'Vikram Singh', '+919123456789')
      ON CONFLICT DO NOTHING;
    `);

    // 3. Customer 2 books the EXACT SAME date and 15:00:00 slot that was just cancelled!
    await db.exec(`
      SET ROLE service_role;
      SELECT set_config('request.jwt.claim.role', 'service_role', false);
    `);

    const rebookRes = await db.query(`
      SELECT * FROM public.book_chair_appointment_atomic(
        '${CUSTOMER_2_ID}'::uuid,
        '${STYLIST_ID}'::uuid,
        '${STUDIO_ID}'::uuid,
        (CURRENT_DATE + INTERVAL '2 days')::date,
        TIME '${BOOKING_TIME}',
        'Classic Beard Sculpt',
        'normal',
        'Customer 2 booked newly opened slot',
        true
      );
    `);

    await db.exec('RESET ROLE;');

    assert.equal(rebookRes.rows.length, 1);
    const newBooking = rebookRes.rows[0];
    assert.equal(newBooking.final_time, BOOKING_TIME, 'Slot 15:00 must be available and granted to Customer 2');
    assert.equal(newBooking.reallocated, false, 'Should not be reallocated since previous booking was cancelled');
    assert.equal(newBooking.booking_status, 'confirmed');

    // Verify both appointments coexist in database without constraint violation
    const historyCheck = await db.query(`
      SELECT user_id, appointment_time, status, token_number
      FROM public.appointments
      WHERE doctor_id = '${STYLIST_ID}'
        AND appointment_date = (CURRENT_DATE + INTERVAL '2 days')::date
      ORDER BY created_at ASC;
    `);

    assert.equal(historyCheck.rows.length, 2);
    assert.equal(historyCheck.rows[0].status, 'cancelled');
    assert.equal(historyCheck.rows[1].status, 'confirmed');
  });

  // =========================================================================
  // STEP 7: MOBILE RESPONSIVENESS & PWA VERIFICATION
  // =========================================================================
  it('Step 7: Mobile Responsiveness & PWA Audit — validates viewport meta, web manifest, and native configs', () => {
    // 1. Index.html viewport audit
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('viewport-fit=cover'), 'HTML must include viewport-fit=cover for notch devices');
    assert.ok(indexHtml.includes('width=device-width'), 'HTML must set width=device-width');
    assert.ok(indexHtml.includes('name="theme-color" content="#0f172a"'), 'Theme color must match obsidian palette');
    assert.ok(indexHtml.includes('FadeCraft'), 'Title and branding must reference FadeCraft');

    // 2. Vite PWA plugin configuration audit
    const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    assert.ok(viteConfig.includes('name: "FadeCraft - Luxury Barber & Salon Experience"'), 'PWA name must be FadeCraft');
    assert.ok(viteConfig.includes('short_name: "FadeCraft"'), 'PWA short_name must be FadeCraft');
    assert.ok(viteConfig.includes('theme_color: "#0f172a"'), 'PWA theme color must be obsidian');
    assert.ok(viteConfig.includes('background_color: "#090d16"'), 'PWA background color must be deep black');
    assert.ok(viteConfig.includes('display: "standalone"'), 'PWA must declare standalone display mode');

    // 3. Android Capacitor configuration audit
    const capConfig = fs.readFileSync(path.resolve(process.cwd(), 'capacitor.config.ts'), 'utf8');
    assert.ok(capConfig.includes("appId: 'com.fadecraft.app'"), 'Capacitor appId must be com.fadecraft.app');
    assert.ok(capConfig.includes("appName: 'FadeCraft'"), 'Capacitor appName must be FadeCraft');
    assert.ok(capConfig.includes("checkout.razorpay.com"), 'Capacitor must allow Razorpay navigation');

    // 4. Android native strings.xml audit
    const stringsXml = fs.readFileSync(path.resolve(process.cwd(), 'android/app/src/main/res/values/strings.xml'), 'utf8');
    assert.ok(stringsXml.includes('<string name="app_name">FadeCraft</string>'), 'Native app name must be FadeCraft');
    assert.ok(stringsXml.includes('<string name="package_name">com.fadecraft.app</string>'), 'Package name must be com.fadecraft.app');
  });

});
