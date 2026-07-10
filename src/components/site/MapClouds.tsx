import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * MapClouds — soft cloud blobs anchored to real lat/lng coordinates via
 * google.maps.OverlayView, so they pan/zoom with the map like an actual
 * cloud layer drifting over the land, instead of sliding across the
 * screen independent of what's underneath. Each cloud's longitude
 * increases slowly over time and wraps around once it drifts past
 * Cambodia's eastern edge.
 */

interface CloudSpec {
  lat: number;
  startLng: number;
  size: number;
  speed: number; // degrees longitude per second
  opacity: number;
  blur: number;
}

const MIN_LNG = 101.8;
const MAX_LNG = 108.2;

const CLOUDS: CloudSpec[] = [
  { lat: 14.1, startLng: 102.5, size: 340, speed: 0.0055, opacity: 0.16, blur: 30 },
  { lat: 13.2, startLng: 104.8, size: 220, speed: 0.008,  opacity: 0.12, blur: 24 },
  { lat: 12.6, startLng: 103.6, size: 400, speed: 0.0035, opacity: 0.14, blur: 36 },
  { lat: 11.9, startLng: 106.2, size: 180, speed: 0.009,  opacity: 0.10, blur: 20 },
  { lat: 11.2, startLng: 102.9, size: 300, speed: 0.005,  opacity: 0.11, blur: 30 },
  { lat: 10.6, startLng: 105.4, size: 240, speed: 0.007,  opacity: 0.09, blur: 24 },
];

/**
 * Defined lazily inside the effect (not at module scope) because
 * `google.maps.OverlayView` only exists once the Maps JS API script has
 * loaded — evaluating `extends google.maps.OverlayView` at import time
 * throws before that script is ready.
 */
function makeCloudOverlayClass() {
  return class CloudOverlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    private position: google.maps.LatLng;

    constructor(private spec: CloudSpec) {
      super();
      this.position = new google.maps.LatLng(spec.lat, spec.startLng);
    }

    onAdd() {
      const div = document.createElement("div");
      div.className = "map-cloud-geo";
      div.style.width = `${this.spec.size}px`;
      div.style.height = `${this.spec.size * 0.5}px`;
      div.style.opacity = String(this.spec.opacity);
      div.style.filter = `blur(${this.spec.blur}px)`;
      this.div = div;
      this.getPanes()?.overlayLayer.appendChild(div);
    }

    draw() {
      const proj = this.getProjection();
      if (!proj || !this.div) return;
      const point = proj.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.div.style.left = `${point.x - this.spec.size / 2}px`;
      this.div.style.top = `${point.y - (this.spec.size * 0.5) / 2}px`;
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }

    setLng(lng: number) {
      this.position = new google.maps.LatLng(this.spec.lat, lng);
      this.draw();
    }
  };
}

export function MapClouds() {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const CloudOverlay = makeCloudOverlayClass();
    const overlays = CLOUDS.map((spec) => {
      const o = new CloudOverlay(spec);
      o.setMap(map);
      return o;
    });
    const lngs = CLOUDS.map((c) => c.startLng);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      CLOUDS.forEach((spec, i) => {
        lngs[i] += spec.speed * dt;
        if (lngs[i] > MAX_LNG) lngs[i] = MIN_LNG;
        overlays[i].setLng(lngs[i]);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      overlays.forEach((o) => o.setMap(null));
    };
  }, [map]);

  return null;
}
