// ─── Spotify API Utilities ───────────────────────────────────────────

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-top-read",
  "user-read-recently-played",
  "user-library-read",
  "user-read-private",
  "user-read-email",
].join(" ");

/**
 * Build the Spotify OAuth authorization URL
 */
export function getSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/spotify-callback`,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/spotify-callback`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }>;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string) {
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
 * Make an authenticated request to Spotify API
 */
export async function spotifyFetch(endpoint: string, accessToken: string) {
  const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new Error("EXPIRED_TOKEN");
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Get a valid access token for a user, refreshing if needed
 */
export async function getValidToken(user: {
  spotifyAccessToken: string | null;
  spotifyRefreshToken: string | null;
  spotifyTokenExpiry: Date | null;
}): Promise<{ accessToken: string; refreshed: boolean; newToken?: string; newExpiry?: Date }> {
  if (!user.spotifyAccessToken || !user.spotifyRefreshToken) {
    throw new Error("NO_SPOTIFY_CONNECTION");
  }

  // Check if token is expired (with 5 min buffer)
  const isExpired =
    !user.spotifyTokenExpiry ||
    new Date(user.spotifyTokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return { accessToken: user.spotifyAccessToken, refreshed: false };
  }

  // Refresh the token
  const data = await refreshAccessToken(user.spotifyRefreshToken);
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshed: true,
    newToken: data.access_token,
    newExpiry,
  };
}
