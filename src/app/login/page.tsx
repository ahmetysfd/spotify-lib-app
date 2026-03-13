"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      background: "#0a0a0a",
      fontFamily: "DM Sans, sans-serif",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(ellipse 600px 400px at 30% 20%, rgba(29,185,84,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 500px 500px at 70% 80%, rgba(29,185,84,0.04) 0%, transparent 60%),
          #0a0a0a
        `,
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
        {/* Logo */}
        <div style={{
          width: 64,
          height: 64,
          background: "#1DB954",
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 32px",
          boxShadow: "0 0 50px rgba(29,185,84,0.25)",
        }}>
          <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, fill: "#000" }}>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>

        <h1 style={{
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1.15,
          marginBottom: 12,
          color: "#fff",
        }}>
          Your Music<br /><span style={{ color: "#1DB954" }}>Stats</span>
        </h1>

        <p style={{
          color: "#888",
          fontSize: 15,
          lineHeight: 1.6,
          marginBottom: 36,
        }}>
          See your top artists, tracks, genres, listening time, and discover patterns in your music taste.
        </p>

        <button
          onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#1DB954",
            color: "#000",
            border: "none",
            padding: "15px 40px",
            borderRadius: 50,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "all 0.2s",
            letterSpacing: 0.3,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#1ed760";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 8px 30px rgba(29,185,84,0.3)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#1DB954";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "#000" }}>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Sign in with Spotify
        </button>

        <p style={{ marginTop: 20, color: "#444", fontSize: 11, lineHeight: 1.6 }}>
          We only read your listening data. We never modify your library or playlists.
        </p>
      </div>
    </div>
  );
}
