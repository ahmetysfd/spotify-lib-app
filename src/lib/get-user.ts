import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

/**
 * Token refresh lock to prevent multiple parallel refreshes
 * for the current-session helper `getSpotifyToken`.
 */
const refreshLocks = new Map<string, Promise<string>>();

/**
 * Separate lock map for the per-user helper `getSpotifyTokenForUserId`,
 * which can legitimately return null.
 */
const perUserRefreshLocks = new Map<string, Promise<string | null>>();

/**
 * Refresh an expired Spotify access token
 */
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh token");
  }

  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    refresh_token?: string;
  }>;
}

/**
 * Get a valid Spotify access token for the current user.
 * Reads from the NextAuth Account table, refreshes if expired.
 */
export async function getSpotifyToken() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const userId = (session.user as any).id;

  // Find the Spotify account linked to this user
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "spotify",
    },
  });

  if (!account?.access_token || !account?.refresh_token) {
    throw new Error("NO_SPOTIFY_CONNECTION");
  }

  // Check if token is expired (with 5 min buffer)
  const isExpired =
    !account.expires_at ||
    account.expires_at * 1000 < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return account.access_token;
  }

  // If a refresh is already in progress for this user, wait for it
  const existingLock = refreshLocks.get(userId);
  if (existingLock) {
    return existingLock;
  }

  // Start a new refresh
  const refreshPromise = (async () => {
    try {
      // Re-read from DB in case another request already refreshed
      const freshAccount = await prisma.account.findFirst({
        where: { userId, provider: "spotify" },
      });

      if (
        freshAccount?.expires_at &&
        freshAccount.expires_at * 1000 > Date.now() + 5 * 60 * 1000
      ) {
        return freshAccount.access_token!;
      }

      // Actually refresh
      const data = await refreshAccessToken(account.refresh_token!);

      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: data.access_token,
          expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
          ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
        },
      });

      return data.access_token;
    } finally {
      refreshLocks.delete(userId);
    }
  })();

  refreshLocks.set(userId, refreshPromise);
  return refreshPromise;
}

/**
 * Get a valid Spotify access token for a user by userId (no session required).
 * Used by cron jobs to fetch recently played for all users.
 */
export async function getSpotifyTokenForUserId(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "spotify" },
  });

  if (!account?.refresh_token) {
    return null;
  }

  const isExpired =
    !account.expires_at ||
    account.expires_at * 1000 < Date.now() + 5 * 60 * 1000;

  if (!isExpired && account.access_token) {
    return account.access_token;
  }

  const existingLock = perUserRefreshLocks.get(userId);
  if (existingLock) {
    return existingLock;
  }

  const refreshPromise = (async () => {
    try {
      const data = await refreshAccessToken(account.refresh_token!);
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: data.access_token,
          expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
          ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
        },
      });
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshLocks.delete(userId);
    }
  })();

  perUserRefreshLocks.set(userId, refreshPromise);
  return refreshPromise;
}
