# ZEV Admin Portal | Official App Management Console

Production-grade, high-security admin portal for the **ZEV** mobile application, targeting **`adminportal.zevapp.com`**.

Engineered for inspecting users, granting official verified blue badges, confirming user emails, suspending/banning accounts, managing roles, and performing hard account deletions.

---

## 🚀 Key Admin Features

1. **Comprehensive User Inspection (Dossier View):**
   - Full identity view: First & Last name, Father's name, `@username`, bio, and avatar.
   - Live activity metrics: Online/offline indicator and exact `last_seen` timestamp.
   - User engagement metrics: Total posts count (`discussion_posts`) and reels count (`reels`).
   - Financials & gamification: Wallet balance (`wallet_balance`) and total score (`total_score`).
   - One-click UUID copy for developer troubleshooting.

2. **Official Blue Badge Accreditation (Blue Tick):**
   - 1-click toggle to grant or revoke the official ZEV Blue Badge.
   - Supports custom Badge Labels (*Verified Official*, *ZEV VIP Creator*, *Official Instructor*, etc.) and audit reason logged to `user_verifications`.
   - Automatically dispatches an official in-app congratulatory notification to the user via `user_notifications`.
   - Instant revocation capability at any time.

3. **Instant Email Confirmation:**
   - 1-click action to confirm user email addresses directly in Supabase Auth (`auth.users`) without leaving the portal.

4. **Account Suspension & Moderation (Ban / Unban):**
   - Flexible suspension durations: **24 Hours**, **3 Days**, **7 Days**, **30 Days**, or **Permanent**.
   - Mandatory audit reason logged and dispatched as a security alert to the user.
   - Instant unban button to restore full account privileges.

5. **Permanent Account Deletion (High-Security Wipe):**
   - Full purge of user identity from Supabase Auth (`auth.users`) and public schema tables (`profiles`, `user_verifications`, `notifications`).
   - Guarded by explicit confirmation typing (`DELETE`) to prevent accidental deletions.

6. **Profile Editing & Role Switching:**
   - Direct inline editing of first name, last name, username, wallet balance, and score.
   - Instant role changes: `student`, `teacher`, `admin`, or `super_admin`.

7. **Real-time KPI Dashboard & Advanced Filtering:**
   - Live counters: Total Users, Verified Blue Badges, Unconfirmed Emails, Banned Accounts, Online Users, and Posts/Reels.
   - Instant search across names, usernames, emails, phone numbers, and UUIDs.
   - Role dropdown and quick filter tabs.
   - **One-click CSV Export** of all filtered users.

8. **Admin Gate & Multi-factor Security:**
   - Fast login via Master Passkey: `zev2026admin` (configurable in `.env` via `ADMIN_SECRET_KEY`).
   - Or authenticate using Supabase credentials with verified `admin` role.
   - Protected with secure HTTP-only session cookies.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4, Cyber Dark Theme, Glassmorphism & Plus Jakarta Sans typography
- **Database & Backend:** Direct Supabase Postgres pooler connection + `@supabase/supabase-js` Service Role client
- **Icons:** Lucide React

---

## ⚙️ Development & Deployment

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build production bundle
npm run build

# Start production server
npm start
```

Runs locally on `http://localhost:3000`.

---

## 🌐 Production Domain Setup

- Target Domain: **`adminportal.zevapp.com`**
- Set up on Vercel, VPS, or Cloudflare by configuring the environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_DIRECT_URL`
  - `ADMIN_SECRET_KEY`
