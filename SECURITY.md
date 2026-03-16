# Security checklist (before pushing to GitHub)

This file documents the security checks done on this project and what you must **never** commit.

---

## What was checked and fixed

### 1. No hardcoded secrets in code
- **Checked:** All source files under `src/` for API keys, tokens, passwords, connection strings.
- **Result:** All secrets are read from **environment variables** (`process.env.NEXTAUTH_SECRET`, `process.env.SPOTIFY_CLIENT_ID`, etc.). No real keys or tokens are written in the code.
- **Safe:** ✅

### 2. .gitignore protects env and secret files
- **Checked:** Which files could be committed that might contain secrets.
- **Updated:** `.gitignore` now explicitly ignores:
  - `.env`, `.env.local`, and all `.env.*.local` variants
  - `.env.development`, `.env.production`, etc.
  - `*.pem`, `*.key`, `secrets.json`, `credentials.json`, `.env.backup`, `.env.old`
  - Database files (`*.db`, `prisma/dev.db`)
- **Exception:** `.env.example` is **not** ignored (with `!.env.example`) so you can commit the template. It contains **placeholders only**, never real values.
- **Safe:** ✅

### 3. .env.example has no real values
- **Checked:** `.env.example` content.
- **Result:** Only placeholder values (`your-nextauth-secret-here`, `your-spotify-client-id`, etc.). No real keys.
- **Safe:** ✅

### 4. No sensitive data in console logs
- **Checked:** `console.log` / `console.info` in the app.
- **Result:** Only non-sensitive data (e.g. HTTP status codes, retry counts). No tokens, passwords, or API keys logged.
- **Safe:** ✅

### 5. Cron route is protected
- **Checked:** `/api/cron/collect-recently-played` (runs without a user session).
- **Result:** When `CRON_SECRET` is set, the route requires `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`. No secret is hardcoded.
- **Safe:** ✅

---

## What you must never do

| Don’t | Why |
|-------|-----|
| Commit `.env` or `.env.local` | They hold real secrets. GitHub may scan and warn or revoke keys. |
| Put real values in `.env.example` | It’s committed to the repo. Use placeholders only. |
| Hardcode API keys, passwords, or DB URLs in code | Anyone with repo access can see them. Use env vars. |
| Log tokens, passwords, or full request bodies | Logs can be stored or exposed. |
| Remove env entries from `.gitignore` | Risk of accidentally committing secret files. |

---

## Before every push to GitHub

1. Run: `git status`
2. Make sure **no** `.env` or `.env.local` (or other env/secret files) are listed. If they appear, they are **not** ignored — fix `.gitignore` and **do not** add them.
3. If you ever committed a secret in the past: rotate it (new key/secret in Spotify, new NEXTAUTH_SECRET, new DB password) and remove the secret from git history (e.g. `git filter-branch` or BFG) or create a new repo and push again without that commit.

---

## If GitHub says “potential secret detected”

- GitHub is warning that a **commit** (current or past) contains something that looks like a key/token.
- **Do not** push again until you:
  1. Find the file/commit (e.g. `.env` or a copy of it).
  2. Remove the file from the repo and ensure it’s in `.gitignore`.
  3. **Rotate** the exposed secret (generate a new one in Spotify / NextAuth / DB and update your local and production env). The old value is considered compromised.
  4. If the secret was in an old commit, consider rewriting history to remove it (or use a new repo and push only “clean” commits).

---

## Summary

- Secrets live only in **environment variables** and in **ignored** files (`.env`, `.env.local`).
- **.gitignore** is set up so env and common secret filenames are not committed.
- **.env.example** is safe to commit (placeholders only).
- Before pushing, always check `git status` and never add env or secret files.
