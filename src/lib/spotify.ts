// ─── Spotify API Utilities ───────────────────────────────────────────

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

/**
 * Build the Spotify authorization URL used to start the OAuth flow.
 * This must match the redirect URI configured in your Spotify Dashboard.
 */
export function getSpotifyAuthUrl(state: string): string {
  const redirectBase = process.env.NEXTAUTH_URL!;
  const redirectUri = `${redirectBase}/api/auth/spotify-callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: [
      "user-top-read",
      "user-read-recently-played",
      "user-library-read",
      "user-read-private",
      "user-read-email",
      "playlist-read-private",
      "playlist-read-collaborative",
    ].join(" "),
    redirect_uri: redirectUri,
    state,
  });

  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for Spotify access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const redirectBase = process.env.NEXTAUTH_URL!;
  const redirectUri = `${redirectBase}/api/auth/spotify-callback`;

  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to exchange Spotify code: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return json;
}

/**
 * Make an authenticated request to Spotify API
 * Retries up to 3 times on 502/503/429 errors with increasing delay
 */
export async function spotifyFetch(
  endpoint: string,
  accessToken: string,
  retries = 3,
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }

    // Retry on 502, 503, or 429 (rate limit)
    if (
      (res.status === 502 || res.status === 503 || res.status === 429) &&
      attempt < retries
    ) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
      console.log(
        `Spotify returned ${res.status}, retrying in ${delay}ms (attempt ${
          attempt + 1
        }/${retries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Spotify API error ${res.status}: ${err}`);
    }

    return res.json();
  }
}
