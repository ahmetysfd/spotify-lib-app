import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";
import { getValidToken } from "./spotify";

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
 * Get a valid Spotify access token for the current user.
 * Automatically refreshes if expired and updates DB.
 */
export async function getSpotifyToken() {
  const user = await getCurrentUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");
  if (!user.spotifyAccessToken) throw new Error("NO_SPOTIFY_CONNECTION");

  const result = await getValidToken(user);

  // If token was refreshed, update DB
  if (result.refreshed && result.newToken) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        spotifyAccessToken: result.newToken,
        spotifyTokenExpiry: result.newExpiry,
      },
    });
  }

  return result.accessToken;
}
