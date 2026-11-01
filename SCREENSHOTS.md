# FadeCraft — Visual Architecture & UI Walkthrough

Welcome to the visual documentation for **FadeCraft** — the premier luxury barber & salon chair queue experience.

---

## 🎨 Theme & Design Philosophy

- **Background Canvas**: Obsidian Black (`#020617` / `#090d16`)
- **Accent & Primary**: Champagne Gold & Warm Amber (`#f59e0b` / `#fbbf24`)
- **Surface Elevation**: Deep Slate Card Surfaces (`#0f172a` with `#1e293b` borders)
- **Typography**: Clean, high-contrast modern sans-serif with high readability
- **Status Accents**: Emerald Green for Live Queue (`#10b981`), Crimson for Alert (`#ef4444`)

---

## 📱 Visual Screens Walkthrough

```
+-----------------------------------------------------------------------+
|  [FADECRAFT]          Search Stylist, Service, Studio...   [VIP Login]|
+-----------------------------------------------------------------------+
|                                                                       |
|   EXPERIENCE PRECISION GROOMING                                       |
|   Skip the wait. Book top master barbers and track your chair in      |
|   real time with digital queue tokens.                                |
|                                                                       |
|   [ Book Your Chair Now ]        [ Explore Master Stylists ]          |
|                                                                       |
|   +-------------------+  +-------------------+  +-------------------+ |
|   | Marcus Vance      |  | Elena Rostova     |  | Tariq Al-Mansoor  | |
|   | Fade Specialist   |  | Texture & Color   |  | Beard Architecture| |
|   | ★ 4.95 (142 reviews)| ★ 4.98 (210 reviews)| ★ 4.92 (98 reviews) | |
|   | ₹450 / session    |  | ₹600 / session    |  | ₹400 / session    | |
|   | [Reserve Chair]   |  | [Reserve Chair]   |  | [Reserve Chair]   | |
|   +-------------------+  +-------------------+  +-------------------+ |
+-----------------------------------------------------------------------+
```

---

### 1. Chair Availability & Booking Interface
*Path: `/booking/:stylistId`*

```
+-----------------------------------------------------------------------+
|  < Back to Stylists                                                   |
|  RESERVE YOUR CHAIR WITH MARCUS VANCE                                 |
+-----------------------------------------------------------------------+
|  1. Select Date                                                       |
|  [ Today, Nov 01 ]    [ Tomorrow, Nov 02 ]    [ Monday, Nov 03 ]      |
|                                                                       |
|  2. Select Chair Time Slot (30-min intervals)                          |
|  MORNING                                                              |
|  [ 09:30 AM ]  [ 10:00 AM ]  [ 10:30 AM (Reserved) ]  [ 11:00 AM ]    |
|                                                                       |
|  AFTERNOON                                                            |
|  [ 01:00 PM ]  [ 01:30 PM ]  [ 02:00 PM ]  [ 02:30 PM ]               |
|                                                                       |
|  EVENING                                                              |
|  [ 05:00 PM ]  [ 05:30 PM ]  [ 06:00 PM ]  [ 06:30 PM ]               |
|                                                                       |
|  3. Service Category & Priority Queue Tier                            |
|  (o) Classic Fade & Haircut (₹450)                                    |
|  ( ) Royal Shave & Beard Sculpt (₹350)                                |
|  ( ) Signature Full Grooming Package (₹750)                           |
|  [x] VIP Fast-Track Pass (+₹100 priority pass)                        |
|                                                                       |
|  Total Due: ₹550                       [ Proceed to Razorpay Pay ]    |
+-----------------------------------------------------------------------+
```

---

### 2. Live Queue & Digital VIP Pass
*Path: `/appointments/:id`*

```
+-----------------------------------------------------------------------+
|  Chair Pass & Reservation                           [ STATUS: CONFIRMED ]
+-----------------------------------------------------------------------+
|  +-----------------------------------------------------------------+  |
|  |     [# VIP FAST-TRACK PASS]            [● LIVE QUEUE ACTIVE]    |  |
|  |                                                                 |  |
|  |                             #04                                 |  |
|  |                                                                 |  |
|  |     Stylist Marcus is currently attending Chair Token #02       |  |
|  |                                                                 |  |
|  |     +-------------------------+     +-------------------------+ |  |
|  |     |  Clients Ahead: 2       |     |  Est. Wait: ~40 mins    | |  |
|  |     +-------------------------+     +-------------------------+ |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  RESERVATION DETAILS                                                  |
|  • Date: Saturday, November 01, 2026                                  |
|  • Slot: 02:30 PM                                                     |
|  • Stylist: Marcus Vance (Fade Specialist)                            |
|  • Studio: FadeCraft Flagship Studio, Indiranagar                     |
|                                                                       |
|  [ Download Digital VIP Pass (PDF) ]        [ Reschedule / Cancel ]   |
+-----------------------------------------------------------------------+
```

---

### 3. Generated Digital Pass (PDF Structure)

The downloadable pass features:
- **Obsidian Header**: Gold embossed `FADECRAFT` logo with VIP subtitle
- **Token Hexagon**: Large `#04` token identifier for barcode / reception scanner
- **Service Specs**: Date, exact timeslot, stylist name, and studio GPS address
- **Notes & Instructions**: Special grooming requirements and conflict-free chair confirmation

---

### 4. Mobile & PWA Experience

- **Responsive Viewport**: Viewport-fit cover with zero side scrolling
- **Bottom Navigation Dock**: Home, Stylists, Active Queue Pass, Profile
- **Offline / PWA Caching**: Service worker precaches assets with instant cold-start
- **Native Android Wrapper**: Capacitor bridge supporting native Razorpay checkout and deep links (`com.fadecraft.app://payment-success`)
