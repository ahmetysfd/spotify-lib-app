# Deploy your Spotify Library online (first time)

Follow this checklist and steps to put your app live. Recommended: **Vercel** (free) + **Neon** (free Postgres).

---

## Before you upload: checklist

Do these **before** you connect the app to a hosting site.

### 1. Don’t upload secrets
- [ ] **Never commit `.env` or `.env.local`** — they should be in `.gitignore` (Next.js usually does this).
- [ ] You will type all secrets (NEXTAUTH_SECRET, Spotify keys, database URL) into the **hosting dashboard** after you connect the project.

### 2. Spotify app (developer.spotify.com)
- [ ] You have **Client ID** and **Client Secret** from your Spotify app.
- [ ] You will add your **production redirect URI** after you know your live URL (see Step 5 below).  
  Example: `https://your-app-name.vercel.app/api/auth/spotify-callback`  
  (Or, if you use NextAuth’s default Spotify callback: `https://your-app-name.vercel.app/api/auth/callback/spotify`.)

### 3. Database (PostgreSQL)
- [ ] This project uses **PostgreSQL** (set in `prisma/schema.prisma`). You need a **hosted Postgres** for Vercel. Easiest free option: **Neon**. We’ll do this in the steps below.

### 4. Code / repo
- [ ] App runs locally: `npm run dev` and you can log in and use the dashboard.
- [ ] Build works: `npm run build` (fix any errors before deploying).
- [ ] Code is in **Git** (e.g. `git init`, add files, commit). You’ll push to **GitHub** so Vercel can import it.

---

## Step-by-step: deploy to Vercel + Neon

### Step 1: Create a free Postgres database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (free).
2. Create a new project (e.g. “spotify-library”).
3. Copy the **connection string**. It looks like:
   ```txt
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this for Step 4 — you’ll paste it into Vercel as `DATABASE_URL`.

### Step 2: (Optional) Test the database locally

The project is already configured for **PostgreSQL** in `prisma/schema.prisma`. If you want to test with Neon before deploying:

1. Create `.env.local` with your Neon connection string:
   ```env
   DATABASE_URL="postgresql://...your-neon-connection-string..."
   ```
2. Run:
   ```bash
   npx prisma db push
   ```
   Your tables will be created in Neon.

### Step 3: Push your code to GitHub

1. Create a new repository on [github.com](https://github.com) (e.g. `spotify-library`). Don’t add a README if your project already has one.
2. In your project folder (where `package.json` is), run:

   ```bash
   git init
   git add .
   git commit -m "Prepare for deploy"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your repo URL.

### Step 4: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New… → Project**.
3. **Import** your GitHub repo (e.g. `spotify-library`). Click **Import**.
4. **Environment variables** — add these (Vercel will show a form). Use **Production** (and optionally Preview):

   | Name | Value |
   |------|--------|
   | `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` (run in terminal), paste the result |
   | `NEXTAUTH_URL` | **Leave empty for now** — we’ll set it after first deploy (see below) |
   | `SPOTIFY_CLIENT_ID` | Your Spotify app Client ID |
   | `SPOTIFY_CLIENT_SECRET` | Your Spotify app Client Secret |
   | `DATABASE_URL` | Your **Neon** connection string from Step 1 |

   (Optional: add `CRON_SECRET` if you will use the “collect recently played” cron job.)

5. Click **Deploy**. Vercel will build and deploy. Wait until it finishes.

### Step 5: Set your live URL and Spotify redirect

1. After deploy, Vercel gives you a URL like `https://spotify-library-xxx.vercel.app`.
2. In Vercel: go to your project → **Settings** → **Environment Variables**.
   - Add or edit **`NEXTAUTH_URL`** = `https://your-actual-vercel-url.vercel.app` (no trailing slash).
3. In **Spotify Dashboard** ([developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)) → your app → **Settings**:
   - Under **Redirect URIs**, add:  
     `https://your-actual-vercel-url.vercel.app/api/auth/spotify-callback`  
     (If your app uses NextAuth’s default Spotify callback instead, use:  
     `https://your-actual-vercel-url.vercel.app/api/auth/callback/spotify`.)
   - Click **Save**.

### Step 6: Create tables in the production database

Your Neon database needs the tables. Run this **once** (from your PC with `DATABASE_URL` in `.env.local` set to your Neon URL):

```bash
npx prisma db push
```

After this, your production app will use the same schema (users, accounts, sessions, daily stats) in Neon.

### Step 7: Test the live app

1. Open `https://your-actual-vercel-url.vercel.app`.
2. Register or log in.
3. Click “Connect with Spotify” (or your connect button) and complete Spotify login.
4. You should be redirected back and see the dashboard with your data.

If you get “Invalid redirect URI” from Spotify, double-check Step 5 (exact URL and path).

---

## Quick reference after deploy

| What | Where |
|------|--------|
| Live URL | Vercel project → Domains |
| Env vars | Vercel → Project → Settings → Environment Variables |
| Logs | Vercel → Project → Deployments → click a deployment → Logs |
| DB (Neon) | neon.tech dashboard → connection string, tables |

---

## Optional: run “collect recently played” once per day at midnight

- In Vercel, set **`CRON_SECRET`** (e.g. `openssl rand -base64 32`).
- Your repo has a cron route and `vercel.json` (once per day at midnight). On **Vercel Pro** the cron may run automatically; otherwise use [cron-job.org](https://cron-job.org) or similar to call:
  `https://your-app.vercel.app/api/cron/collect-recently-played`
  with header: `Authorization: Bearer YOUR_CRON_SECRET`.

---

You’re done. Your app is live and will keep working when your PC is off, using Neon for the database and Vercel for the server.
