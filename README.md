# 🏸 Badminton Community RSVP & Split-Bill Platform

A premium, mobile-first web application designed for the **Infinite Learning Batam** badminton community. Built with focus on elegant design, high performance, and seamless payment verification.

## 🚀 Technology Stack
- **Framework:** SvelteKit (Runes Mode)
- **Styling:** Tailwind CSS v4
- **Database / Backend:** Supabase (PostgreSQL + Storage)
- **Icons:** Lucide Svelte
- **Animations:** Custom CSS Animations + Canvas Confetti
- **Deployment:** Cloudflare Pages

## ✨ Key Features
- **Apple-Inspired Design:** Minimalist, sleek UI with glassmorphism and smooth micro-animations.
- **Dynamic Split-Bill:** Automatically calculates individual costs based on court shared fees and personal racket rentals.
- **Smart RSVP System:** Prevents duplicates, handles deadlines (H-1), and supports "Ticket Recovery" via 6-digit ID.
- **Optimized Assets:** Automatic WebP conversion and browser-side image compression for gallery and payment proofs.
- **Admin Dashboard:** Professional dashboard for session management, payment verification, and community statistics.
- **Dark Mode Support:** Manual toggle with persistent storage.
- **Progressive Loading:** Prioritizes session data for instant schedule visibility.

---

## 🧪 Testing Guide & User Flow

Follow this flow to test the full capability of the application:

### 1. Admin: Create a Session
1.  Navigate to `/admin`.
2.  Enter the PIN (Default: `1234`).
3.  Click **"New Session"**.
4.  Fill in the details (Title, Date, Courts, etc.).
5.  Click **"Create Session"**. You will see the sessions list update.

### 2. User: RSVP for Session
1.  Navigate to the Home page `/`.
2.  Scroll to **"Upcoming Schedule"**.
3.  Click **"Book Spot"** on a session card.
4.  In the session details, enter your name and toggle **"Need a racket?"** if desired.
5.  Click **"Join Session"**. You will receive a 6-digit **Ticket ID**.
6.  *Your status will show as "Joined" (Blue).*

### 3. Admin: Manage & Lock Session
1.  Go back to `/admin`.
2.  Find the session you just joined.
3.  Click the **"Unlock/Lock"** icon. Once locked, the total cost is fixed and payment becomes mandatory.
4.  The User view will now show **"Pay Fees"**.

### 4. User: Payment & Verification
1.  On the session page, click **"Pay Fees"**.
2.  Scan the QRIS code and upload a screenshot of your transfer proof.
3.  Click **"Done"**. Your status updates to **"In Review"** (Yellow).
4.  Click **"WhatsApp Confirmation"** to notify the admin (Optional).

### 5. Admin: Verify Payment
1.  In `/admin`, expand the session to see the participants.
2.  Click on the participant marked **"Unpaid"** (Red).
3.  Review the uploaded proof in the modal.
4.  Click **"Verify Payment"**. Confetti will trigger!
5.  *The User's status now updates to "Paid" (Green).*

### 6. User: Access Digital Pass
1.  Once verified, the User can click **"View Membership Pass"**.
2.  A premium digital ticket (Apple Wallet style) will be generated.
3.  Support for **"Add to Calendar"** and **"Save PDF"** is available on this page.

---

## 🛠️ Local Development

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:** Create a `.env` file with:
    ```env
    PUBLIC_SUPABASE_URL=your_supabase_url
    PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Run Dev Server:**
    ```bash
    npm run dev
    ```

## 📂 Supabase Schema
The database uses 4 main tables: `sessions`, `participants`, `gallery`, and `settings`. Ensure **Row Level Security (RLS)** is configured to allow public reads and restricted writes.
