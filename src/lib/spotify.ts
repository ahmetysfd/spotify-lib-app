// ─── Spotify API Utilities ───────────────────────────────────────────

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * Make an authenticated request to Spotify API
 * Retries up to 3 times on 502/503/429 errors with increasing delay
 */
export async function spotifyFetch(endpoint: string, accessToken: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }

    // Retry on 502, 503, or 429 (rate limit)
    if ((res.status === 502 || res.status === 503 || res.status === 429) && attempt < retries) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
      console.log(`Spotify returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
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
