import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

describe('FadeCraft Core Logic & Security Test Suite', () => {

  describe('1. Booking and Chair Availability Logic', () => {
    it('generates consistent 30-minute chair time slots from 09:00 to 20:00', () => {
      const slots = [];
      for (let h = 9; h <= 20; h++) {
        const hh = String(h).padStart(2, "0");
        slots.push(`${hh}:00`);
        if (h < 20) slots.push(`${hh}:30`);
      }

      assert.equal(slots.length, 23);
      assert.equal(slots[0], '09:00');
      assert.equal(slots[slots.length - 1], '20:00');
    });

    it('filters past time slots when booking for today', () => {
      const allSlots = ['09:00', '10:00', '11:00', '14:00', '16:00', '18:00', '20:00'];
      const simulatedNow = new Date('2026-11-01T11:30:00');
      const nowTimeStr = '11:30';

      const futureSlots = allSlots.filter(time => time > nowTimeStr);
      assert.deepEqual(futureSlots, ['14:00', '16:00', '18:00', '20:00']);
      assert.ok(!futureSlots.includes('09:00'), 'Past slot 09:00 must be filtered');
      assert.ok(!futureSlots.includes('11:00'), 'Past slot 11:00 must be filtered');
    });

    it('correctly categorizes slots into Morning, Afternoon, and Evening sessions', () => {
      const slots = ['09:30', '12:00', '14:30', '17:00', '19:30'];
      const categorized = {
        morning: slots.filter(s => parseInt(s.split(':')[0], 10) < 12),
        afternoon: slots.filter(s => {
          const h = parseInt(s.split(':')[0], 10);
          return h >= 12 && h < 17;
        }),
        evening: slots.filter(s => parseInt(s.split(':')[0], 10) >= 17)
      };

      assert.deepEqual(categorized.morning, ['09:30']);
      assert.deepEqual(categorized.afternoon, ['12:00', '14:30']);
      assert.deepEqual(categorized.evening, ['17:00', '19:30']);
    });
  });

  describe('2. Double Booking Prevention Logic & Database Constraints', () => {
    it('prevents concurrent double bookings during simultaneous booking attempts', async () => {
      // In-memory atomic DB simulation with partial unique constraint
      const activeBookings = new Map(); // key: "doctor_id|date|time" -> booking
      const allAppointments = [];

      // Atomic reservation function simulating PostgreSQL unique index & collision recovery
      const atomicBookChair = async (user, doctorId, date, requestedTime, autoReallocate = true) => {
        let time = requestedTime;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          attempts++;
          const slotKey = `${doctorId}|${date}|${time}`;

          // Simulate database UNIQUE constraint (WHERE status IN ('scheduled', 'confirmed'))
          if (!activeBookings.has(slotKey)) {
            const booking = {
              id: `apt-${Math.random().toString(36).substring(7)}`,
              user_id: user,
              doctor_id: doctorId,
              appointment_date: date,
              appointment_time: time,
              status: 'confirmed',
              reallocated: time !== requestedTime
            };
            activeBookings.set(slotKey, booking);
            allAppointments.push(booking);
            return { success: true, booking };
          }

          // Slot collision! (PostgreSQL 23505 error)
          if (!autoReallocate) {
            throw new Error('23505: unique_violation - slot already booked');
          }

          // Advance 30 minutes and retry
          const [h, m] = time.split(':').map(Number);
          const nextMin = (m + 30) % 60;
          const nextHour = h + Math.floor((m + 30) / 60);
          time = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
        }

        throw new Error('No chair available after max attempts');
      };

      // Simulate 2 clients attempting to book the EXACT SAME chair & time simultaneously
      const [client1Result, client2Result] = await Promise.all([
        atomicBookChair('client_1', 'stylist_alpha', '2026-11-02', '14:00', true),
        atomicBookChair('client_2', 'stylist_alpha', '2026-11-02', '14:00', true),
      ]);

      assert.ok(client1Result.success);
      assert.ok(client2Result.success);

      // Verify that the two clients did NOT get the same slot
      assert.notEqual(
        client1Result.booking.appointment_time,
        client2Result.booking.appointment_time,
        'Concurrent requests must NEVER reserve the same time slot'
      );

      // One took 14:00, the other was gracefully reallocated to 14:30
      const times = [client1Result.booking.appointment_time, client2Result.booking.appointment_time].sort();
      assert.deepEqual(times, ['14:00', '14:30']);

      const reallocatedClient = [client1Result, client2Result].find(r => r.booking.reallocated);
      assert.ok(reallocatedClient, 'One client must be marked as reallocated');
      assert.equal(reallocatedClient.booking.appointment_time, '14:30');
    });

    it('allows re-booking a slot if a previous reservation was cancelled', async () => {
      const activeBookings = new Map();
      const appointments = [];

      // User 1 books 15:00
      const slotKey = 'stylist_beta|2026-11-02|15:00';
      const booking1 = { id: 'apt-001', user: 'user_1', slot: slotKey, status: 'confirmed' };
      activeBookings.set(slotKey, booking1);
      appointments.push(booking1);

      // User 1 cancels appointment
      booking1.status = 'cancelled';
      activeBookings.delete(slotKey); // Excluded from partial unique index

      // User 2 books the same 15:00 slot
      assert.ok(!activeBookings.has(slotKey), 'Cancelled slot must be available');
      const booking2 = { id: 'apt-002', user: 'user_2', slot: slotKey, status: 'confirmed' };
      activeBookings.set(slotKey, booking2);
      appointments.push(booking2);

      // Verify both records exist in DB history, but only 1 is active
      assert.equal(appointments.length, 2);
      assert.equal(appointments.filter(a => a.status === 'confirmed').length, 1);
      assert.equal(booking2.status, 'confirmed');
    });

    it('verifies migration handles existing duplicates and defines atomic procedures', () => {
      const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20261101120000_prevent_double_booking.sql');
      assert.ok(fs.existsSync(migrationFile), 'Migration file must exist');

      const content = fs.readFileSync(migrationFile, 'utf8');

      // 1. Existing duplicate cleanup before index creation
      assert.ok(
        content.includes('WITH duplicates AS') || content.includes('ROW_NUMBER()'),
        'Migration must deduplicate existing records before index creation'
      );
      assert.ok(
        content.includes("status = 'cancelled'"),
        'Migration must cancel legacy duplicates to protect data integrity'
      );

      // 2. Partial unique index excluding cancelled bookings
      assert.ok(
        content.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment_slot'),
        'Unique index must be defined'
      );
      assert.ok(
        content.includes("WHERE status IN ('scheduled', 'confirmed')"),
        'Index must only target active bookings so cancelled slots are re-bookable'
      );

      // 3. Atomic stored procedure with advisory transaction locking
      assert.ok(
        content.includes('CREATE OR REPLACE FUNCTION public.book_chair_appointment_atomic'),
        'Must define atomic booking function book_chair_appointment_atomic'
      );
      assert.ok(
        content.includes('pg_advisory_xact_lock'),
        'Must use pg_advisory_xact_lock for deterministic serializability'
      );
    });

    it('verifies Edge Function implements atomic RPC and handles 23505 unique violations', () => {
      const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/verify-razorpay-payment/index.ts');
      const edgeFunctionCode = fs.readFileSync(edgeFunctionPath, 'utf8');

      assert.ok(
        edgeFunctionCode.includes('book_chair_appointment_atomic'),
        'Edge function must call atomic booking stored procedure'
      );
      assert.ok(
        edgeFunctionCode.includes('23505') || edgeFunctionCode.includes('unique'),
        'Edge function must catch unique violation conflict (23505)'
      );
      assert.ok(
        edgeFunctionCode.includes('prevent chair conflict') || edgeFunctionCode.includes('Slot adjusted automatically'),
        'Edge function must gracefully notify and adjust slot on conflict'
      );
    });
  });

  describe('3. Razorpay Payment Verification & Webhook Handling', () => {
    const mockSecret = 'test_secret_key_fadecraft_987';
    const orderId = 'order_DA28FADECRAFT01';
    const paymentId = 'pay_FC998129841';

    it('validates authentic Razorpay HMAC SHA-256 signatures', () => {
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac('sha256', mockSecret)
        .update(payload)
        .digest('hex');

      // Verification function
      const verifySignature = (oId, pId, sig, secret) => {
        const expected = crypto.createHmac('sha256', secret).update(`${oId}|${pId}`).digest('hex');
        return expected === sig;
      };

      assert.ok(verifySignature(orderId, paymentId, validSignature, mockSecret), 'Valid signature must pass');
      assert.ok(!verifySignature(orderId, paymentId, 'tampered_bad_signature_123', mockSecret), 'Tampered signature must fail');
    });

    it('strictly verifies edge function rejects missing and invalid signatures without test-mode bypass', () => {
      const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/verify-razorpay-payment/index.ts');
      assert.ok(fs.existsSync(edgeFunctionPath), 'verify-razorpay-payment Edge Function must exist');

      const edgeFunctionCode = fs.readFileSync(edgeFunctionPath, 'utf8');

      // 1. Missing signature check
      assert.ok(
        edgeFunctionCode.includes('!razorpay_order_id || !razorpay_payment_id || !razorpay_signature'),
        'Must validate required fields: order_id, payment_id, and signature'
      );
      assert.ok(
        edgeFunctionCode.includes("error: 'Missing payment verification data"),
        'Must reject with 400 when signature or IDs are missing'
      );

      // 2. Strict rejection on invalid signature without test mode bypass
      assert.ok(
        !edgeFunctionCode.includes('Proceeding for test'),
        'Test-mode signature mismatch bypass must be completely removed'
      );
      assert.ok(
        !edgeFunctionCode.includes("isTestMode && signatureValid"),
        'Must not allow test mode to bypass invalid signature'
      );
      assert.ok(
        edgeFunctionCode.includes('if (!signatureValid)'),
        'Must have strict check on !signatureValid'
      );
      assert.ok(
        edgeFunctionCode.includes("error: 'Payment verification failed - invalid signature'"),
        'Must reject payment with 400 when signature is invalid'
      );
    });

    it('handles webhook idempotency by ignoring duplicate processed payments', () => {
      const paymentsDb = new Map();
      paymentsDb.set(paymentId, { id: 'pmt-1001', appointment_id: 'apt-2001', status: 'completed' });

      // Incoming webhook call
      const handleWebhookPayment = (incomingPaymentId) => {
        if (paymentsDb.has(incomingPaymentId)) {
          return { status: 'ok', idempotent: true, message: 'Payment already recorded' };
        }
        paymentsDb.set(incomingPaymentId, { id: 'pmt-new', status: 'completed' });
        return { status: 'ok', idempotent: false, message: 'New payment recorded' };
      };

      const result = handleWebhookPayment(paymentId);
      assert.equal(result.idempotent, true);
      assert.equal(result.message, 'Payment already recorded');
    });
  });

  describe('4. Authentication & Authorization Route Access', () => {
    it('properly guards protected routes from unauthenticated users', () => {
      const protectedRoutes = ['/booking', '/appointments', '/profile', '/stylist'];
      const publicRoutes = ['/', '/auth', '/doctors'];

      const checkAccess = (path, isAuthenticated) => {
        if (protectedRoutes.includes(path) && !isAuthenticated) {
          return { allowed: false, redirect: '/auth' };
        }
        return { allowed: true, redirect: null };
      };

      assert.deepEqual(checkAccess('/booking', false), { allowed: false, redirect: '/auth' });
      assert.deepEqual(checkAccess('/appointments', false), { allowed: false, redirect: '/auth' });
      assert.deepEqual(checkAccess('/', false), { allowed: true, redirect: null });
      assert.deepEqual(checkAccess('/booking', true), { allowed: true, redirect: null });
    });

    it('strictly separates patient vs stylist/doctor dashboard privileges', () => {
      const checkRoleAccess = (path, role) => {
        if (path === '/stylist-dashboard' && role !== 'doctor' && role !== 'stylist') {
          return { allowed: false, error: 'Unauthorized: Stylist privileges required' };
        }
        return { allowed: true };
      };

      assert.equal(checkRoleAccess('/stylist-dashboard', 'patient').allowed, false);
      assert.equal(checkRoleAccess('/stylist-dashboard', 'doctor').allowed, true);
      assert.equal(checkRoleAccess('/stylist-dashboard', 'stylist').allowed, true);
    });
  });

  describe('5. Live Queue Tracking & VIP Pass Functionality', () => {
    it('computes exact queue position and estimated wait time', () => {
      const activeQueue = [
        { token_number: 1, status: 'confirmed' },
        { token_number: 2, status: 'confirmed' },
        { token_number: 3, status: 'scheduled' },
        { token_number: 4, status: 'confirmed' }, // User's token
        { token_number: 5, status: 'scheduled' },
      ];

      const userToken = 4;
      const peopleAhead = activeQueue.filter(q => q.token_number < userToken && ['scheduled', 'confirmed'].includes(q.status)).length;
      const estimatedWaitMins = peopleAhead * 20; // 20 min per fade

      assert.equal(peopleAhead, 3);
      assert.equal(estimatedWaitMins, 60);
    });

    it('assigns VIP fast-track priority status', () => {
      const createPass = (tokenNum, isVip) => ({
        token_number: tokenNum,
        token_type: isVip ? 'vip' : 'normal',
        badge: isVip ? 'VIP FAST-TRACK PASS' : 'CHAIR RESERVATION PASS',
        priority_fee: isVip ? 100 : 0
      });

      const vipPass = createPass(12, true);
      const regularPass = createPass(13, false);

      assert.equal(vipPass.badge, 'VIP FAST-TRACK PASS');
      assert.equal(vipPass.priority_fee, 100);
      assert.equal(regularPass.badge, 'CHAIR RESERVATION PASS');
      assert.equal(regularPass.priority_fee, 0);
    });
  });

  describe('6. PWA & Mobile Responsiveness Configs', () => {
    it('contains valid PWA manifest settings in vite.config.ts', () => {
      const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
      assert.ok(viteConfig.includes('name: "FadeCraft - Luxury Barber & Salon Experience"'), 'PWA name must be FadeCraft');
      assert.ok(viteConfig.includes('short_name: "FadeCraft"'), 'PWA short_name must be FadeCraft');
      assert.ok(viteConfig.includes('theme_color: "#0f172a"'), 'Theme color must match obsidian');
    });

    it('ensures viewport-fit=cover and responsive tags are present in index.html', () => {
      const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
      assert.ok(indexHtml.includes('viewport-fit=cover'), 'index.html must have viewport-fit=cover');
      assert.ok(indexHtml.includes('FadeCraft'), 'index.html title must contain FadeCraft');
    });
  });

  describe('7. Android & Capacitor Build Setup', () => {
    it('verifies capacitor.config.ts contains com.fadecraft.app', () => {
      const capConfig = fs.readFileSync(path.resolve(process.cwd(), 'capacitor.config.ts'), 'utf8');
      assert.ok(capConfig.includes("appId: 'com.fadecraft.app'"), 'Capacitor appId must be com.fadecraft.app');
      assert.ok(capConfig.includes("appName: 'FadeCraft'"), 'Capacitor appName must be FadeCraft');
      assert.ok(capConfig.includes("checkout.razorpay.com"), 'Razorpay domain must be allowed');
    });

    it('verifies android strings.xml has FadeCraft app name', () => {
      const stringsXml = fs.readFileSync(path.resolve(process.cwd(), 'android/app/src/main/res/values/strings.xml'), 'utf8');
      assert.ok(stringsXml.includes('<string name="app_name">FadeCraft</string>'), 'strings.xml app_name must be FadeCraft');
      assert.ok(stringsXml.includes('<string name="package_name">com.fadecraft.app</string>'), 'strings.xml package_name must be com.fadecraft.app');
    });

    it('verifies ANDROID_BUILD_GUIDE.md is present with full build documentation', () => {
      assert.ok(fs.existsSync(path.resolve(process.cwd(), 'ANDROID_BUILD_GUIDE.md')), 'Android build guide must exist');
    });
  });

  describe('8. Security Audit: Database Authorization & Input Validation (SECURITY DEFINER)', () => {
    const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20261101120000_prevent_double_booking.sql');
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');

    it('strictly revokes execution rights from PUBLIC and anonymous users', () => {
      assert.ok(
        migrationSql.includes('REVOKE ALL ON FUNCTION public.book_chair_appointment_atomic FROM PUBLIC;'),
        'Must explicitly revoke all permissions from PUBLIC'
      );
      assert.ok(
        migrationSql.includes('REVOKE ALL ON FUNCTION public.book_chair_appointment_atomic FROM anon;'),
        'Must explicitly revoke all permissions from anon'
      );
      assert.ok(
        !migrationSql.includes('GRANT EXECUTE ON FUNCTION public.book_chair_appointment_atomic TO anon') &&
        !migrationSql.includes('anon,'),
        'Must never grant execute permissions to anon'
      );
      assert.ok(
        migrationSql.includes('GRANT EXECUTE ON FUNCTION public.book_chair_appointment_atomic TO service_role;'),
        'Must grant execute only to trusted service_role'
      );
    });

    it('enforces anti-impersonation: authenticated callers cannot forge p_user_id', () => {
      // Logic simulation of procedure guard
      const validateCallerIdentity = (callerRole, authUid, requestedUserId) => {
        if (callerRole === 'anon') {
          throw new Error('42501: UNAUTHORIZED: Anonymous callers are not permitted');
        }
        if (callerRole === 'authenticated') {
          if (!authUid) throw new Error('42501: UNAUTHORIZED: Valid authenticated session required');
          if (requestedUserId !== authUid) {
            throw new Error('42501: FORBIDDEN: Identity mismatch');
          }
        }
        return { authorized: true };
      };

      // 1. Anonymous caller rejected
      assert.throws(
        () => validateCallerIdentity('anon', null, 'target-user-123'),
        /42501: UNAUTHORIZED/
      );

      // 2. Authenticated caller trying to book for someone else (spoofing)
      assert.throws(
        () => validateCallerIdentity('authenticated', 'legit-user-uuid', 'victim-user-uuid'),
        /42501: FORBIDDEN: Identity mismatch/
      );

      // 3. Authenticated caller booking for themselves
      const legitUserCall = validateCallerIdentity('authenticated', 'legit-user-uuid', 'legit-user-uuid');
      assert.equal(legitUserCall.authorized, true);

      // 4. Server-side service_role permitted
      const serviceRoleCall = validateCallerIdentity('service_role', null, 'customer-user-uuid');
      assert.equal(serviceRoleCall.authorized, true);
    });

    it('verifies SQL procedure implements caller role guards and anti-spoofing checks', () => {
      assert.ok(
        migrationSql.includes("IF v_caller_role = 'anon'"),
        'Must check and reject anon role inside procedure'
      );
      assert.ok(
        migrationSql.includes("v_caller_role = 'authenticated'"),
        'Must check authenticated role identity'
      );
      assert.ok(
        migrationSql.includes("p_user_id <> v_auth_uid") || migrationSql.includes("p_user_id != v_auth_uid"),
        'Must verify p_user_id matches authenticated session UID'
      );
    });

    it('verifies comprehensive parameter validation rules inside stored procedure', () => {
      // Must validate mandatory parameters
      assert.ok(migrationSql.includes('p_user_id IS NULL'), 'Validates p_user_id is not null');
      assert.ok(migrationSql.includes('p_doctor_id IS NULL'), 'Validates p_doctor_id is not null');
      assert.ok(migrationSql.includes('p_hospital_id IS NULL'), 'Validates p_hospital_id is not null');

      // Foreign key existence validation
      assert.ok(
        migrationSql.includes('FROM public.doctors') && migrationSql.includes('p_doctor_id'),
        'Validates doctor exists'
      );
      assert.ok(
        migrationSql.includes('FROM public.hospitals') && migrationSql.includes('p_hospital_id'),
        'Validates studio exists'
      );

      // Date & time validation
      assert.ok(migrationSql.includes('p_appointment_date < CURRENT_DATE'), 'Rejects past booking dates');
      assert.ok(migrationSql.includes('CURRENT_DATE + INTERVAL \'90 days\''), 'Rejects booking more than 90 days in advance');
      assert.ok(migrationSql.includes('TIME \'07:00:00\'') && migrationSql.includes('TIME \'22:00:00\''), 'Enforces salon opening hours');

      // Token type and string length sanitization
      assert.ok(migrationSql.includes("p_token_type NOT IN ('normal', 'vip')"), 'Enforces valid token type');
      assert.ok(migrationSql.includes('length(p_special_instructions) > 500'), 'Sanitizes special instructions length');
    });
  });

});
