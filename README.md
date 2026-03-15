# Spotify Personal Music Library

A full-stack personal music dashboard that connects to your Spotify account and displays your top artists, tracks, listening history, genre breakdowns, and visual insights.

**Stack:** Next.js 14 · NextAuth.js · Prisma + SQLite · Tailwind CSS · Recharts

---

## File Structure

```
spotify-library/
├── .env.example              ← Copy to .env.local and fill in
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── prisma/
│   └── schema.prisma         ← Database schema (SQLite)
└── src/
    ├── app/
    │   ├── globals.css        ← Global styles + Tailwind
    │   ├── layout.tsx         ← Root layout with providers
    │   ├── page.tsx           ← Home redirect
    │   ├── login/
    │   │   └── page.tsx       ← Login page (username + password)
    │   ├── register/
    │   │   └── page.tsx       ← Registration page
    │   ├── dashboard/
    │   │   └── page.tsx       ← Main dashboard (all tabs + charts)
    │   └── api/
    │       ├── auth/
    │       │   ├── [...nextauth]/route.ts   ← NextAuth handler
    │       │   ├── register/route.ts        ← User registration API
    │       │   ├── spotify-connect/route.ts ← Start Spotify OAuth
    │       │   └── spotify-callback/route.ts← Spotify OAuth callback
    │       └── spotify/
    │           ├── profile/route.ts         ← Proxy: user profile
    │           ├── top-artists/route.ts     ← Proxy: top artists
    │           ├── top-tracks/route.ts      ← Proxy: top tracks
    │           ├── recently-played/route.ts ← Proxy: recently played
    │           └── genres/route.ts          ← Aggregated genre data
    ├── components/
    │   └── Providers.tsx      ← Session provider wrapper
    └── lib/
        ├── auth.ts            ← NextAuth config (credentials)
        ├── prisma.ts          ← Prisma client singleton
        ├── spotify.ts         ← Spotify API utilities
        └── get-user.ts        ← Auth + token refresh helpers
```

---

## Step-by-Step Setup

### Step 1: Create the project folder

Create a new folder on your computer and place all the files from this
download into it, matching the file structure above.

Or, if you use the terminal:

```bash
mkdir spotify-library
cd spotify-library
# Place all files in their correct locations
```

### Step 2: Install Node.js

You need Node.js version 18 or newer.

- Download from: https://nodejs.org (pick the LTS version)
- Verify installation:
  ```bash
  node --version    # Should show v18.x.x or higher
  npm --version     # Should show 9.x.x or higher
  ```

### Step 3: Create a Spotify Developer App

1. Go to **https://developer.spotify.com/dashboard**
2. Log in with your Spotify account
3. Click **"Create App"**
4. Fill in:
   - **App name:** `My Music Library` (or anything you want)
   - **App description:** `Personal music dashboard`
   - **Redirect URI:** `http://localhost:3000/api/auth/spotify-callback`
     _(click "Add" after typing it!)_
   - Check the **Web API** checkbox
5. Click **"Save"**
6. On your app page, click **"Settings"**
7. You will see:
   - **Client ID** → copy this
   - **Client Secret** → click "View client secret" and copy it

### Step 4: Create your .env.local file

In the root of your project folder (`spotify-library/`), create a file
called `.env.local` and paste this:

```env
NEXTAUTH_SECRET=paste-a-random-string-here
NEXTAUTH_URL=http://localhost:3000

SPOTIFY_CLIENT_ID=paste-your-client-id-here
SPOTIFY_CLIENT_SECRET=paste-your-client-secret-here

DATABASE_URL="file:./dev.db"
```

**How to fill each value:**

| Variable               | What to put                                                                                      |
|------------------------|--------------------------------------------------------------------------------------------------|
| `NEXTAUTH_SECRET`      | Any random string. Generate one by running `openssl rand -base64 32` in terminal, or just type a long random string like `mY-sUp3r-s3cReT-k3y-12345` |
| `NEXTAUTH_URL`         | `http://localhost:3000` (don't change this for local dev)                                        |
| `SPOTIFY_CLIENT_ID`    | The Client ID from Step 3                                                                        |
| `SPOTIFY_CLIENT_SECRET`| The Client Secret from Step 3                                                                    |
| `DATABASE_URL`         | `"file:./dev.db"` (keep exactly as shown — this creates a local SQLite file)                     |

### Step 5: Install dependencies

Open terminal in the project folder and run:

```bash
npm install
```

This will install Next.js, React, Prisma, NextAuth, Recharts, Tailwind,
and all other dependencies. It may take 1-2 minutes.

### Step 6: Set up the database

```bash
npx prisma db push
```

This creates the SQLite database file (`prisma/dev.db`) with the User
table. You should see "Your database is now in sync with your schema."

### Step 7: Run the app

```bash
npm run dev
```

The app will start at **http://localhost:3000**

### Step 8: Use the app

1. Open **http://localhost:3000** in your browser
2. You'll see the **login page** → click **"Create one"** to register
3. Enter a username, password, (optional display name & email) → click **Create Account**
4. You're now on the **dashboard** → click **"Connect with Spotify"**
5. Spotify will ask you to authorize → click **"Agree"**
6. You'll be redirected back to the dashboard with all your data loaded!

---

## What each page shows

| Page       | What you see                                                                 |
|------------|------------------------------------------------------------------------------|
| **Overview**   | Stats cards, top 6 artists, top 8 tracks, recent 8 plays                |
| **Artists**    | Full grid of your top 50 artists with images, genres, and rank          |
| **Tracks**     | Full list of top 50 tracks with album art, duration, and popularity     |
| **Recent**     | Last 50 played tracks with timestamps                                   |
| **Insights**   | 4 charts: Plays by Day, Genre Breakdown (pie), Listening by Hour (area), Artist Popularity (horizontal bar) |

Each page with artists/tracks has **time range tabs**: Last 4 Weeks, Last 6 Months, All Time.

---

## Troubleshooting

**"Invalid redirect URI" from Spotify**
→ Make sure `http://localhost:3000/api/auth/spotify-callback` is
  added exactly in your Spotify app settings under Redirect URIs.

**"NEXT_AUTH_SECRET" error**
→ Make sure your `.env.local` file exists in the project root and has
  `NEXTAUTH_SECRET` set.

**Database errors**
→ Run `npx prisma db push` again. If that fails, delete `prisma/dev.db`
  and run it again.

**Spotify shows "INVALID_CLIENT"**
→ Double check that `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in
  `.env.local` are correct (no extra spaces).

**Token expired errors**
→ The app automatically refreshes tokens. If issues persist, disconnect
  and reconnect Spotify (sign out, sign back in, click Connect).

---

## Saving recently played every 2 hours (cron)

Spotify only exposes the **last 50** recently played tracks. To avoid losing history when the app isn’t open, you can run a job every 2 hours that fetches recently played for all linked users and saves it to your database.

**What’s in the project**

- **When you open the dashboard:** Recently played is fetched and saved (existing behavior).
- **No built-in scheduler:** There is no process that runs every 2 hours by itself. You need either a host that supports cron (e.g. Vercel Cron) or an external cron service.

**How to run it every 2 hours**

1. **Set a secret** (so only your cron can call the API):
   - Generate one: `openssl rand -base64 32`
   - Add to `.env.local` (and to your host’s env in production):
     ```env
     CRON_SECRET=your-generated-secret-here
     ```

2. **Call the API every 2 hours** with that secret:
   - **URL:** `GET` or `POST` → `https://your-app-url.com/api/cron/collect-recently-played`
   - **Auth:** Send either  
     `Authorization: Bearer YOUR_CRON_SECRET`  
     or  
     `x-cron-secret: YOUR_CRON_SECRET`
   - If `CRON_SECRET` is not set in the app, the route does not require auth (useful for local testing only).

3. **Ways to trigger it every 2 hours:**
   - **Vercel (Pro):** Add `vercel.json` with a cron (already in the repo: every 2 hours). Set `CRON_SECRET` in Vercel env. Note: Vercel Cron may not send the secret automatically; use an external cron that calls your URL with the header if needed.
   - **External cron service:** Use [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com), or similar. Create a job that runs every 2 hours and calls the URL above with the `Authorization: Bearer YOUR_CRON_SECRET` header.
   - **Your own server:** Add a system cron entry, e.g. `0 */2 * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.com/api/cron/collect-recently-played`

The job finds all users with a linked Spotify account, fetches their last 50 recent plays, and saves any new ones into the database (duplicates are skipped).

---

## Deploying to Production (Optional)

To deploy on **Vercel**:

1. Push your code to GitHub
2. Go to https://vercel.com and import your repo
3. Add all 4 environment variables from `.env.local` in the Vercel
   dashboard (Project Settings → Environment Variables)
4. Change `NEXTAUTH_URL` to your Vercel URL (e.g. `https://my-app.vercel.app`)
5. Add that same URL + `/api/auth/spotify-callback` as a new Redirect URI
   in your Spotify app settings
6. Deploy!

For production, consider switching from SQLite to PostgreSQL:
- Update `prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`
- Set `DATABASE_URL` to your PostgreSQL connection string
- Run `npx prisma db push`
