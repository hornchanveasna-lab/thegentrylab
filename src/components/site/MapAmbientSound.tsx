import { useEffect, useRef, useState } from "react";

/**
 * MapAmbientSound — a looping ambient track that only ever plays while
 * this component is mounted (i.e. only while the user is on /map —
 * it unmounts automatically on navigation, which stops the audio).
 *
 * Browsers block autoplay-with-sound without a user gesture, so this
 * starts muted (which autoplay IS allowed to do) and only turns sound
 * on once the visitor explicitly clicks the toggle.
 *
 * Drop a licensed ambient track (nature + calm + a faint industrial
 * hum) at public/audio/map-ambient.mp3 — the player is fully wired
 * and will just start working once that file exists.
 */
export function MapAmbientSound() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = 0.35;
    el.play().catch(() => { /* autoplay may still be blocked even muted on some browsers — fine, toggle will start it */ });
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    const next = !muted;
    setMuted(next);
    el.muted = next;
    if (!next) el.play().catch(() => {});
  };

  return (
    <>
      <audio
        ref={audioRef}
        src="/audio/map-ambient.mp3"
        loop
        muted={muted}
        preload="auto"
        onCanPlay={() => setReady(true)}
        onError={() => setReady(false)}
        style={{ display: "none" }}
      />
      <button
        onClick={toggle}
        title={muted ? "Turn on ambient sound" : "Mute ambient sound"}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors"
        style={{
          color: !muted && ready ? "#ff5100" : "rgba(255,255,255,0.35)",
          borderColor: !muted && ready ? "rgba(255,81,0,0.4)" : "rgba(255,255,255,0.12)",
          backgroundColor: !muted && ready ? "rgba(255,81,0,0.08)" : "transparent",
        }}
      >
        {muted ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        )}
        {muted ? "Sound off" : "Ambient sound"}
      </button>
    </>
  );
}
