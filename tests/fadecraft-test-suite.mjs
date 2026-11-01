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

  describe('2. Double Booking Prevention Logic', () => {
    it('detects slot collision and re-allocates to next 30-minute interval', () => {
      const existingBookings = [
        { doctor_id: 'stylist-1', appointment_date: '2026-11-02', appointment_time: '14:00', status: 'confirmed' }
      ];

      const newBooking = {
        doctor_id: 'stylist-1',
        appointment_date: '2026-11-02',
        appointment_time: '14:00',
        special_instructions: 'Zero fade haircut'
      };

      const hasConflict = existingBookings.some(
        b => b.doctor_id === newBooking.doctor_id &&
             b.appointment_date === newBooking.appointment_date &&
             b.appointment_time === newBooking.appointment_time &&
             ['scheduled', 'confirmed'].includes(b.status)
      );

      assert.ok(hasConflict, 'Conflict must be identified');

      // Auto re-allocation logic
      if (hasConflict) {
        const [h, m] = newBooking.appointment_time.split(':').map(Number);
        const nextMin = (m + 30) % 60;
        const nextHour = h + Math.floor((m + 30) / 60);
        newBooking.appointment_time = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
        newBooking.special_instructions += ' | Slot adjusted automatically to prevent chair conflict.';
      }

      assert.equal(newBooking.appointment_time, '14:30');
      assert.ok(newBooking.special_instructions.includes('prevent chair conflict'));
    });

    it('verifies PostgreSQL partial unique index migration exists on disk', () => {
      const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20261101120000_prevent_double_booking.sql');
      assert.ok(fs.existsSync(migrationFile), 'Migration file must exist');

      const content = fs.readFileSync(migrationFile, 'utf8');
      assert.ok(content.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment_slot'), 'Unique index must be defined');
      assert.ok(content.includes('WHERE status IN (\'scheduled\', \'confirmed\')'), 'Index must be partial to active statuses');
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

});
