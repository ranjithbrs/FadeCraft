# FadeCraft — Android & Capacitor Build Guide

This guide covers building, running, and releasing **FadeCraft** as a native Android application using Capacitor and Razorpay checkout.

---

## 1. Prerequisites

Before building the Android app, ensure you have installed:
- **Node.js**: v18+ or v20+ (`node -v`)
- **Java Development Kit (JDK)**: OpenJDK 17 or 21 (`java -version`)
- **Android Studio**: Koala / Ladybug or newer
- **Android SDK**: API Level 34 (Android 14) + Build Tools 34.0.0
- **Android SDK Command-line Tools** & **Android Platform-Tools** (`adb` on PATH)

---

## 2. Project Configuration Overview

The native Android layer is configured with:
- **App ID**: `com.fadecraft.app` (defined in `capacitor.config.ts`)
- **App Name**: `FadeCraft` (in `android/app/src/main/res/values/strings.xml`)
- **Custom Deep Link Scheme**: `com.fadecraft.app://`
- **Allowed Razorpay Domains**: `checkout.razorpay.com`, `api.razorpay.com`, `*.razorpay.com`

---

## 3. Step-by-Step Build Instructions

### Step 3.1: Build the Web Assets
Ensure all TypeScript and React assets are compiled into the `dist/` bundle:
```bash
npm run build
```

### Step 3.2: Synchronize with Capacitor Android
Copy web assets and update native plugins:
```bash
npx cap sync android
```
*(If the `android` folder does not exist, run `npx cap add android` first).*

### Step 3.3: Open in Android Studio
Launch Android Studio with the project:
```bash
npx cap open android
```
Wait for Gradle to finish indexing and syncing dependencies.

---

## 4. Running on a Device or Emulator

### Option A: Via Command Line
```bash
npx cap run android
```
Select your connected Android physical device (with USB debugging enabled) or an Android Virtual Device (AVD).

### Option B: Via Android Studio
1. Select your target device in the device toolbar dropdown.
2. Click the green **Run** button (`Shift + F10`).
3. The app will launch with full access to camera, status bar, and native webview.

---

## 5. Razorpay & Deep Link Verification

### 5.1 Native Razorpay Flow
- When running natively inside Capacitor, `Payment.tsx` detects the native bridge (`window.RazorpayCheckout` or custom URI handler).
- Deep link return URI: `com.fadecraft.app://payment-success?payment_id=<id>&order_id=<id>`

### 5.2 Testing Deep Links with ADB
Verify that deep link redirection works properly from the terminal:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "com.fadecraft.app://payment-success?payment_id=pay_test123" com.fadecraft.app
```
FadeCraft will automatically navigate the user to their Chair Pass and live queue token.

---

## 6. Building Production Release (APK / AAB)

### Generate Release APK:
1. In Android Studio, go to **Build > Generate Signed Bundle / APK...**
2. Choose **APK** or **Android App Bundle** (AAB for Google Play Store).
3. Create or select your release keystore (`.jks`).
4. Select `release` build variant and check **V1 (Jar Signature)** and **V2 (Full APK Signature)**.
5. Click **Finish**. The output APK will be placed in:
   `android/app/release/app-release.apk`

---

## 7. Troubleshooting

| Issue | Resolution |
|---|---|
| **Gradle Sync Failed** | Verify JDK 17 is selected in Android Studio (`Settings > Build > Build Tools > Gradle > Gradle JDK`). |
| **Cleartext HTTP Error** | By default, Capacitor uses HTTPS (`https://localhost`). All API calls to Supabase and Razorpay use HTTPS. |
| **Deep Link Not Catching** | Confirm `<intent-filter>` in `android/app/src/main/AndroidManifest.xml` includes `com.fadecraft.app`. |
| **Razorpay Blank Screen** | Verify `capacitor.config.ts` has `allowNavigation: ['*.razorpay.com', 'checkout.razorpay.com']`. |
