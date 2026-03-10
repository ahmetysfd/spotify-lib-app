import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";
import { refreshAccessToken } from "./spotify";

/**
 * Get the current logged-in user from the session
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) return null;

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
  });

  return user;
}

/**
 * Token refresh lock to prevent multiple parallel refreshes.
 * When many API routes fire at once, only the first one refreshes;
 * the rest wait and reuse the new token.
 */
const refreshLocks = new Map<string, Promise<string>>();

/**
 * Get a valid Spotify access token for the current user.
 * Automatically refreshes if expired and updates DB.
 * Uses a lock so parallel requests don't all try to refresh at once.
 */
export async function getSpotifyToken() {
  const user = await getCurrentUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");
  if (!user.spotifyAccessToken || !user.spotifyRefreshToken) {
    throw new Error("NO_SPOTIFY_CONNECTION");
  }

  // Check if token is expired (with 5 min buffer)
  const isExpired =
    !user.spotifyTokenExpiry ||
    new Date(user.spotifyTokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return user.spotifyAccessToken;
  }

  // If a refresh is already in progress for this user, wait for it
  const existingLock = refreshLocks.get(user.id);
  if (existingLock) {
    return existingLock;
  }

  // Start a new refresh and store the promise so other requests can wait
  const refreshPromise = (async () => {
    try {
      // Re-read user from DB in case another request already refreshed
      const freshUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (
        freshUser?.spotifyTokenExpiry &&
        new Date(freshUser.spotifyTokenExpiry).getTime() > Date.now() + 5 * 60 * 1000
      ) {
        // Another request already refreshed the token
        return freshUser.spotifyAccessToken!;
      }

      // Actually refresh
      const data = await refreshAccessToken(user.spotifyRefreshToken!);
      const newExpiry = new Date(Date.now() + data.expires_in * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          spotifyAccessToken: data.access_token,
          spotifyTokenExpiry: newExpiry,
          ...(data.refresh_token
            ? { spotifyRefreshToken: data.refresh_token }
            : {}),
        },
      });

      return data.access_token;
    } finally {
      refreshLocks.delete(user.id);
    }
  })();

  refreshLocks.set(user.id, refreshPromise);
  return refreshPromise;
}
