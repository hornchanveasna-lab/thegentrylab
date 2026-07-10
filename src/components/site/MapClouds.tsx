/**
 * MapClouds — a soft, drifting cloud layer over the real interactive
 * map. Pure CSS (radial-gradient blobs + keyframe drift), no WebGL —
 * cheap enough to run continuously over a live Google Map without
 * competing with it for the GPU, and never intercepts pointer events
 * so panning/zooming/clicking the map underneath is unaffected.
 */

interface CloudLayer {
  top: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  blur: number;
}

const LAYERS: CloudLayer[] = [
  { top: "6%",  size: 340, duration: 90,  delay: 0,   opacity: 0.16, blur: 30 },
  { top: "14%", size: 220, duration: 70,  delay: -20, opacity: 0.12, blur: 24 },
  { top: "22%", size: 400, duration: 110, delay: -55, opacity: 0.14, blur: 36 },
  { top: "34%", size: 180, duration: 60,  delay: -10, opacity: 0.10, blur: 20 },
  { top: "48%", size: 300, duration: 95,  delay: -70, opacity: 0.11, blur: 30 },
  { top: "62%", size: 240, duration: 75,  delay: -35, opacity: 0.09, blur: 24 },
];

export function MapClouds() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: "none", zIndex: 60 }}>
      {LAYERS.map((l, i) => (
        <div
          key={i}
          className="map-cloud"
          style={{
            top: l.top,
            width: l.size,
            height: l.size * 0.5,
            opacity: l.opacity,
            filter: `blur(${l.blur}px)`,
            animationDuration: `${l.duration}s`,
            animationDelay: `${l.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
