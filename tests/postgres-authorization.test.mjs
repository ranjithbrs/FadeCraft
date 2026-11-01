import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('Real PostgreSQL Authorization & Security Enforcement', () => {
  let db;

  // Test UUID constants
  const USER_A_ID = '11111111-1111-1111-1111-111111111111';
  const USER_B_ID = '22222222-2222-2222-2222-222222222222';
  const CUSTOMER_ID = '33333333-3333-3333-3333-333333333333';
  const DOCTOR_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const HOSPITAL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const INVALID_ID = '00000000-0000-0000-0000-000000000000';

  before(async () => {
    // 1. Boot up real PostgreSQL database instance
    db = new PGlite();

    // 2. Set up Supabase roles
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
    `);

    // 3. Set up auth schema and JWT helper functions
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT
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

    // 4. Set up public domain tables (doctors, hospitals, appointments)
    await db.exec(`
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

      -- Grant base schema usage to roles
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role, authenticated;
    `);

    // 5. Seed test data
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A_ID}', 'usera@example.com'),
        ('${USER_B_ID}', 'userb@example.com'),
        ('${CUSTOMER_ID}', 'customer@example.com')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.hospitals (id, name, address, city) VALUES
        ('${HOSPITAL_ID}', 'FadeCraft Flagship Studio', '12th Main Indiranagar', 'Bengaluru')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.doctors (id, hospital_id, name, specialization, consultation_fee) VALUES
        ('${DOCTOR_ID}', '${HOSPITAL_ID}', 'Marcus Vance', 'Fade Specialist', 450)
      ON CONFLICT DO NOTHING;
    `);

    // 6. Apply migration SQL containing the hardened book_chair_appointment_atomic procedure
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261101120000_prevent_double_booking.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(migrationSql);
  });

  it('1. Anonymous caller cannot execute the booking function in PostgreSQL', async () => {
    let errorCaught = null;
    try {
      await db.exec(`
        SET ROLE anon;
        SELECT set_config('request.jwt.claim.role', 'anon', true);
        SELECT set_config('request.jwt.claim.sub', '', true);
      `);

      // Attempt to execute procedure as anon
      await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${USER_A_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '1 day')::date,
          TIME '10:00:00'
        );
      `);
    } catch (err) {
      errorCaught = err;
    } finally {
      await db.exec('RESET ROLE;');
    }

    assert.ok(errorCaught, 'PostgreSQL must reject anonymous execution');
    const message = errorCaught.message || '';
    assert.ok(
      message.includes('permission denied') || message.includes('UNAUTHORIZED') || message.includes('42501'),
      `Expected authorization rejection, got: ${message}`
    );
  });

  it('2. Authenticated user A cannot book an appointment for user B (anti-impersonation)', async () => {
    let errorCaught = null;
    try {
      await db.exec(`
        SET ROLE authenticated;
        SELECT set_config('request.jwt.claim.role', 'authenticated', false);
        SELECT set_config('request.jwt.claim.sub', '${USER_A_ID}', false);
      `);

      // User A (auth.uid() = USER_A_ID) attempts to book with p_user_id = USER_B_ID
      await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${USER_B_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '2 days')::date,
          TIME '11:00:00'
        );
      `);
    } catch (err) {
      errorCaught = err;
    } finally {
      await db.exec(`
        RESET ROLE;
        SELECT set_config('request.jwt.claim.role', '', false);
        SELECT set_config('request.jwt.claim.sub', '', false);
      `);
    }

    assert.ok(errorCaught, 'PostgreSQL must reject identity mismatch / spoofing');
    const message = errorCaught.message || '';
    assert.ok(
      message.includes('Identity mismatch') || message.includes('FORBIDDEN') || message.includes('42501'),
      `Expected anti-impersonation rejection, got: ${message}`
    );
  });

  it('3. Authenticated user A can book for themselves successfully', async () => {
    let result = null;
    try {
      await db.exec(`
        SET ROLE authenticated;
        SELECT set_config('request.jwt.claim.role', 'authenticated', false);
        SELECT set_config('request.jwt.claim.sub', '${USER_A_ID}', false);
      `);

      const queryRes = await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${USER_A_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '3 days')::date,
          TIME '14:00:00',
          'signature_fade',
          'vip',
          'Skin fade with beard trim'
        );
      `);
      result = queryRes.rows[0];
    } finally {
      await db.exec(`
        RESET ROLE;
        SELECT set_config('request.jwt.claim.role', '', false);
        SELECT set_config('request.jwt.claim.sub', '', false);
      `);
    }

    assert.ok(result, 'PostgreSQL must return the created appointment');
    assert.ok(result.appointment_id, 'Must generate a valid appointment UUID');
    assert.equal(result.booking_status, 'confirmed');
    assert.equal(result.token_number, 1);
    assert.equal(result.final_time, '14:00:00');

    // Verify record exists in actual public.appointments table
    const tableRes = await db.query(`
      SELECT * FROM public.appointments WHERE id = '${result.appointment_id}'::uuid
    `);
    assert.equal(tableRes.rows.length, 1);
    assert.equal(tableRes.rows[0].user_id, USER_A_ID);
    assert.equal(tableRes.rows[0].token_type, 'vip');
  });

  it('4. service_role can book on behalf of a verified customer', async () => {
    let result = null;
    try {
      await db.exec(`
        SET ROLE service_role;
        SELECT set_config('request.jwt.claim.role', 'service_role', false);
        SELECT set_config('request.jwt.claim.sub', '', false);
      `);

      const queryRes = await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${CUSTOMER_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '3 days')::date,
          TIME '14:30:00',
          'beard_sculpting',
          'normal',
          'Booked via verified Razorpay checkout'
        );
      `);
      result = queryRes.rows[0];
    } finally {
      await db.exec(`
        RESET ROLE;
        SELECT set_config('request.jwt.claim.role', '', false);
        SELECT set_config('request.jwt.claim.sub', '', false);
      `);
    }

    assert.ok(result, 'service_role must be authorized to book');
    assert.ok(result.appointment_id);
    assert.equal(result.booking_status, 'confirmed');
    assert.equal(result.token_number, 2);
    assert.equal(result.final_time, '14:30:00');

    const tableRes = await db.query(`
      SELECT * FROM public.appointments WHERE id = '${result.appointment_id}'::uuid
    `);
    assert.equal(tableRes.rows[0].user_id, CUSTOMER_ID);
  });

  it('5. Database rejects non-existent doctor/hospital and past booking dates', async () => {
    // 5A. Non-existent stylist
    let errDoctor = null;
    try {
      await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${CUSTOMER_ID}'::uuid,
          '${INVALID_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '1 day')::date,
          TIME '12:00:00'
        );
      `);
    } catch (e) {
      errDoctor = e;
    }
    assert.ok(errDoctor, 'Must reject invalid stylist ID');
    assert.ok(errDoctor.message.includes('Stylist') && errDoctor.message.includes('does not exist'));

    // 5B. Non-existent studio
    let errHospital = null;
    try {
      await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${CUSTOMER_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${INVALID_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '1 day')::date,
          TIME '12:00:00'
        );
      `);
    } catch (e) {
      errHospital = e;
    }
    assert.ok(errHospital, 'Must reject invalid studio ID');
    assert.ok(errHospital.message.includes('Studio') && errHospital.message.includes('does not exist'));

    // 5C. Past date rejection
    let errPastDate = null;
    try {
      await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${CUSTOMER_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE - INTERVAL '1 day')::date,
          TIME '12:00:00'
        );
      `);
    } catch (e) {
      errPastDate = e;
    }
    assert.ok(errPastDate, 'Must reject past dates');
    assert.ok(errPastDate.message.includes('Cannot book appointments in the past'));

    // 5D. Hours outside salon schedule (e.g. 05:00:00 AM)
    let errEarlyTime = null;
    try {
      await db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${CUSTOMER_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          (CURRENT_DATE + INTERVAL '1 day')::date,
          TIME '05:00:00'
        );
      `);
    } catch (e) {
      errEarlyTime = e;
    }
    assert.ok(errEarlyTime, 'Must reject time outside operating hours');
    assert.ok(errEarlyTime.message.includes('outside salon operating hours'));
  });

  it('6. Real PostgreSQL Concurrency: Simultaneous booking attempts serialize and auto-reallocate without collision', async () => {
    // Two simultaneous requests attempt to reserve the exact same chair, date, and time (16:00:00)
    const bookingDate = `(CURRENT_DATE + INTERVAL '5 days')::date`;
    const requestedTime = `TIME '16:00:00'`;

    const [req1, req2] = await Promise.all([
      db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${USER_A_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          ${bookingDate},
          ${requestedTime},
          'fade_classic',
          'vip',
          'Concurrent Request 1',
          true
        );
      `),
      db.query(`
        SELECT * FROM public.book_chair_appointment_atomic(
          '${USER_B_ID}'::uuid,
          '${DOCTOR_ID}'::uuid,
          '${HOSPITAL_ID}'::uuid,
          ${bookingDate},
          ${requestedTime},
          'fade_classic',
          'normal',
          'Concurrent Request 2',
          true
        );
      `)
    ]);

    const res1 = req1.rows[0];
    const res2 = req2.rows[0];

    assert.ok(res1.appointment_id);
    assert.ok(res2.appointment_id);
    assert.notEqual(res1.appointment_id, res2.appointment_id, 'Must produce distinct appointment records');

    // Exactly one must get 16:00:00, and the second must be reallocated to 16:30:00
    const times = [res1.final_time, res2.final_time].sort();
    assert.deepEqual(times, ['16:00:00', '16:30:00'], 'Concurrent reservations must occupy separate 30-min windows');

    const reallocatedRecord = [res1, res2].find(r => r.reallocated === true);
    assert.ok(reallocatedRecord, 'One concurrent request must be marked reallocated in PostgreSQL');
    assert.equal(reallocatedRecord.final_time, '16:30:00');

    // Verify database row count in PostgreSQL: exactly two distinct appointments
    const verifyDb = await db.query(`
      SELECT appointment_time, token_number, status, special_instructions
      FROM public.appointments
      WHERE id IN ('${res1.appointment_id}'::uuid, '${res2.appointment_id}'::uuid)
      ORDER BY appointment_time ASC;
    `);

    assert.equal(verifyDb.rows.length, 2);
    assert.equal(verifyDb.rows[0].appointment_time, '16:00:00');
    assert.equal(verifyDb.rows[1].appointment_time, '16:30:00');
    assert.ok(verifyDb.rows[1].special_instructions.includes('prevent concurrent conflict'));
  });
});
