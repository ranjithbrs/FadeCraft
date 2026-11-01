# 💈 FadeCraft — Luxury Barber & Salon Queue Experience

<p align="center">
  <img src="public/placeholder.svg" alt="FadeCraft Logo" width="100" height="100" />
</p>

<p align="center">
  <b>"Skip the waiting room. Arrive when your barber's chair is ready."</b>
</p>

<p align="center">
  <a href="https://github.com/ranjithbrs/FadeCraft/actions"><img src="https://img.shields.io/badge/tests-36%20passed%20%2F%200%20failed-brightgreen?style=flat-square" alt="Tests" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/supabase-postgresql%2016-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://razorpay.com/"><img src="https://img.shields.io/badge/payments-razorpay%20verified-02042B?style=flat-square&logo=razorpay&logoColor=white" alt="Razorpay" /></a>
  <a href="https://capacitorjs.com/"><img src="https://img.shields.io/badge/mobile-capacitor%20android-119EFF?style=flat-square&logo=capacitor&logoColor=white" alt="Capacitor" /></a>
</p>

---

## 📖 Overview

**FadeCraft** is a production-grade, progressive web application (PWA) and native Android application engineered to eliminate walk-in waiting times at premium barbershops and grooming studios.

Featuring an **Obsidian Black & Champagne Gold** aesthetic, FadeCraft combines real-time digital queue management, serialized chair allocation, cryptographic payment verification, and automated collision recovery into a single frictionless experience.

- 🌐 **Live Web Application**: [https://mediq-web-delta.vercel.app](https://mediq-web-delta.vercel.app)
- 📱 **Android Native App**: `com.fadecraft.app` (Capacitor Android wrapper)
- 📁 **Repository**: [https://github.com/ranjithbrs/FadeCraft](https://github.com/ranjithbrs/FadeCraft)

---

## 🌟 Key Highlights & Core Features

- ✂️ **Real-Time Chair Queue & Live Counter**: Dynamic WebSocket listener tracking currently active chair tokens, customer wait count, and estimated wait countdown (`Token #4 • 2 clients ahead • ~40 mins`).
- 🎟️ **Digital VIP Pass & PDF Generator**: Downloadable luxury passes generated via `jsPDF` styled in Obsidian & Champagne Gold with token stamp, stylist bio, studio location, and custom cut specifications.
- 💈 **Chair Time-Slot Picker**: 30-minute chair time slots partitioned into Morning, Afternoon, and Evening sessions with automatic past-slot filtering for today's reservations.
- 🛡️ **Atomic Concurrency & Collision Lock**: Prevents race conditions and double bookings through PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`) and partial unique constraints.
- 💳 **Cryptographic Razorpay Verification**: Secure HMAC-SHA256 signature verification enforced across test and production environments with idempotent webhook handling.
- 🔒 **Hardened Database Security**: `SECURITY DEFINER` stored procedures protected against identity impersonation (`auth.uid() = p_user_id`), anonymous execution revoking, and parameter validation.
- 📱 **Offline-First PWA & Android**: Notch-optimized (`viewport-fit=cover`), service worker precaching, and native deep linking (`com.fadecraft.app://payment-success`).

---

## 🏗️ Architecture & Security Engineering

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FadeCraft Client                              │
│         (React 18 + TypeScript + Vite + TailwindCSS + PWA)             │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
         1. Checkout Request               3. Client Callback / Deep Link
                   │                                 │
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        Razorpay Payment Gateway      │  │    Supabase Edge Functions   │
│  - Order Creation (amount + VIP fee) │  │  - verify-razorpay-payment    │
│  - HMAC-SHA256 Signature Generation  │  │  - Cryptographic Signature    │
└──────────────────┬───────────────────┘  │    Verification (No Bypass)   │
                   │                      │  - Idempotency Deduplication  │
         2. Webhook Event                 └──────────────┬───────────────┘
                   │                                     │
                   └─────────────────────────────────────┤
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │   PostgreSQL Database        │
                                          │  - book_chair_appointment_   │
                                          │    atomic (Advisory Lock)    │
                                          │  - Partial Unique Index      │
                                          │  - Row-Level Security (RLS)  │
                                          └──────────────────────────────┘
```

### 1. Database-Level Concurrency Protection
To eliminate race conditions when two clients attempt to reserve the same chair slot simultaneously:
- **Transaction-Scoped Advisory Lock**:
  `pg_advisory_xact_lock(hashtext(doctor_id || appointment_date))` ensures booking operations for the same stylist on the same date are executed sequentially at the database engine level.
- **Partial Unique Index**:
  ```sql
  CREATE UNIQUE INDEX idx_unique_active_appointment_slot
  ON public.appointments (doctor_id, appointment_date, appointment_time)
  WHERE status IN ('scheduled', 'confirmed');
  ```
  Cancelled appointments (`status = 'cancelled'`) are excluded, allowing slots to be safely and instantly re-booked.
- **Graceful Collision Recovery**: If a collision is detected, the slot is automatically advanced to the next available 30-minute interval with a customer notification note, ensuring customer payments are never orphaned.

### 2. Cryptographic Payment Verification (Zero Bypass)
- Validates authentic Razorpay signatures using HMAC-SHA256 over `${order_id}|${payment_id}`.
- Rejects missing signatures and mismatches with HTTP `400 Bad Request` in both test and production environments.
- Enforces payment idempotency against `public.payments (razorpay_payment_id)`.

### 3. Role Authorization & Anti-Impersonation
- `REVOKE ALL ON FUNCTION public.book_chair_appointment_atomic FROM PUBLIC, anon;`
- Restricts execution to `service_role` (Edge Functions) and `authenticated` users.
- Authenticated callers are verified against `auth.uid() = p_user_id` to prevent user impersonation.
- Enforces strict input validation: salon opening hours (`07:00` - `22:00`), maximum advance booking window (90 days), and foreign key existence.

---

## 🧪 Comprehensive Automated Test Suite (36/36 Passing)

FadeCraft includes three automated test suites executed via Node.js native test runner (`node --test`), including real in-memory PostgreSQL tests powered by `@electric-sql/pglite`.

```bash
# Run all 36 tests across all 11 suites
npm test

# Run real PostgreSQL authorization and concurrency tests
npm run test:db

# Run full customer lifecycle end-to-end integration test
npm run test:e2e
```

### Test Suite Summary

| Suite | Description | Tests | Status |
|---|---|---|---|
| **Core Logic & Security** | Slot generation, AM/PM split, past slot filtering, HMAC verification, route auth, PWA config | 23 | ✅ Passing |
| **Real PostgreSQL Engine** | Real `SET ROLE anon`, anti-impersonation, `service_role` booking, input bounds, advisory locking | 6 | ✅ Passing |
| **Customer Lifecycle E2E** | User signup → Stylist discovery → Razorpay payment → Queue pass → Cancellation & Re-booking | 7 | ✅ Passing |

```
▶ FadeCraft Full Customer Lifecycle & Mobile PWA Integration Validation (7 tests)
  ✔ Step 1: User Registration — signs up and creates customer profile in database
  ✔ Step 2: Chair Exploration — discovers stylist Marcus Vance and selects available timeslot
  ✔ Step 3: Payment Verification — creates Razorpay order and validates cryptographic signature
  ✔ Step 4: Appointment Creation — atomically reserves chair and records payment in database
  ✔ Step 5: Live Queue Status — confirms Token #1, 0 clients ahead, and digital VIP pass readiness
  ✔ Step 6: Appointment Cancellation — cancels booking and allows Customer 2 to re-book the slot
  ✔ Step 7: Mobile Responsiveness & PWA Audit — validates viewport meta, web manifest, and native configs

▶ FadeCraft Core Logic & Security Test Suite (23 tests)
  ✔ 1. Booking and Chair Availability Logic (3 tests)
  ✔ 2. Double Booking Prevention Logic & Database Constraints (4 tests)
  ✔ 3. Razorpay Payment Verification & Webhook Handling (3 tests)
  ✔ 4. Authentication & Authorization Route Access (2 tests)
  ✔ 5. Live Queue Tracking & VIP Pass Functionality (2 tests)
  ✔ 6. PWA & Mobile Responsiveness Configs (2 tests)
  ✔ 7. Android & Capacitor Build Setup (3 tests)
  ✔ 8. Security Audit: Database Authorization & Input Validation (4 tests)

▶ Real PostgreSQL Authorization & Security Enforcement (6 tests)
  ✔ 1. Anonymous caller cannot execute the booking function in PostgreSQL
  ✔ 2. Authenticated user A cannot book an appointment for user B (anti-impersonation)
  ✔ 3. Authenticated user A can book for themselves successfully
  ✔ 4. service_role can book on behalf of a verified customer
  ✔ 5. Database rejects non-existent doctor/hospital and past booking dates
  ✔ 6. Real PostgreSQL Concurrency: Simultaneous booking attempts serialize without collision

Total: 36 passed · 0 failed
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 5.4, TailwindCSS, shadcn/ui, Lucide Icons, date-fns |
| **Backend & Cloud** | Supabase (PostgreSQL 16, Realtime Subscriptions, Supabase Auth, Deno Edge Functions) |
| **Payments** | Razorpay Checkout SDK & Server-side Webhook Verifier |
| **Mobile** | Capacitor Android (`@capacitor/android`, `@capacitor/status-bar`, `@capacitor/app`) |
| **Document Engine** | jsPDF (custom digital pass rendering) |
| **Database Testing** | `@electric-sql/pglite` (real embedded PostgreSQL 16 WASM) |
| **Deployment** | Vercel (Frontend), Supabase Hosted Cloud (Edge Functions + DB) |

---

## 📁 Repository Structure

```
FadeCraft/
├── android/                         # Native Android Studio Capacitor project
│   └── app/src/main/res/values/     # App name (FadeCraft), URL schemes (com.fadecraft.app)
├── src/
│   ├── components/
│   │   ├── appointments/            # Appointment cards, status badges, PDF pass generator
│   │   ├── home/                    # Hero section, master stylist grid, quick actions
│   │   └── layout/                  # MainLayout, Header, BottomNavigation dock
│   ├── hooks/                       # useAppointments, useDoctorQueue, useAuth, usePayments
│   ├── pages/
│   │   ├── Index.tsx                # FadeCraft luxury home landing & stylist showcase
│   │   ├── Booking.tsx              # Chair slot selection, morning/evening chips, pre-flight check
│   │   ├── Payment.tsx              # Razorpay checkout modal & priority fee calculation
│   │   ├── AppointmentDetail.tsx    # Live Queue status (#Token, clients ahead, est. wait)
│   │   ├── Appointments.tsx         # Pass history (Upcoming, Past, Cancelled)
│   │   └── Auth.tsx                 # Customer login & signup
│   └── integrations/supabase/       # Typed Supabase client
├── supabase/
│   ├── functions/
│   │   ├── create-razorpay-order/   # Server-side order creation
│   │   └── verify-razorpay-payment/ # HMAC verification, atomic booking, webhook handling
│   └── migrations/                  # PostgreSQL schema, partial unique index, atomic RPC
├── tests/
│   ├── fadecraft-test-suite.mjs     # Core unit & security tests (23 tests)
│   ├── postgres-authorization.test.mjs # Real PostgreSQL engine authorization tests (6 tests)
│   └── fadecraft-lifecycle-e2e.test.mjs# Full customer lifecycle E2E test (7 tests)
├── ANDROID_BUILD_GUIDE.md           # Step-by-step Capacitor Android build instructions
├── SCREENSHOTS.md                   # Visual architecture & UI walkthrough
├── capacitor.config.ts              # Capacitor app ID (com.fadecraft.app), Razorpay whitelist
└── vite.config.ts                   # Vite PWA manifest, service worker runtime caching
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+ (`node -v`)
- **npm**: v9+ (`npm -v`)

### Installation & Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/ranjithbrs/FadeCraft.git
cd FadeCraft

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Create a .env file in the root directory:
VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
VITE_SUPABASE_URL="https://your_project.supabase.co"
VITE_RAZORPAY_KEY_ID="rzp_test_your_key_id"

# 4. Run automated test suite
npm test

# 5. Start development server
npm run dev
```

Visit `http://localhost:8080` in your browser.

---

## 📱 Mobile App & Android Build

FadeCraft is configured for native Android deployment via Capacitor:
- **App ID**: `com.fadecraft.app`
- **Deep Link**: `com.fadecraft.app://payment-success`

```bash
# Build production web bundle
npm run build

# Synchronize assets with Android project
npx cap sync android

# Open project in Android Studio
npx cap open android
```

For detailed build, signing, and device testing instructions, see the [Android Build Guide](ANDROID_BUILD_GUIDE.md).

---

## 📸 Visual Walkthrough

For detailed UI layout wireframes, color schemes, and screen states (Stylist Catalog, Chair Picker, VIP Fast-Track Pass, Live Queue Display), inspect [SCREENSHOTS.md](SCREENSHOTS.md).

---

## 👨‍💻 Author

Developed with engineering precision by **Ranjith B** ([@ranjithbrs](https://github.com/ranjithbrs)).

- GitHub: [https://github.com/ranjithbrs](https://github.com/ranjithbrs)
- Project: [FadeCraft on GitHub](https://github.com/ranjithbrs/FadeCraft)
