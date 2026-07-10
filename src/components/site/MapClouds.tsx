import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * MapClouds — cumulus-style cloud clusters anchored to real lat/lng
 * coordinates via google.maps.OverlayView, so they pan/zoom with the
 * map like an actual cloud layer drifting over the land.
 *
 * Three things make these read as real clouds rather than CSS blobs:
 *  1. Size is defined in real-world km, not pixels — projected through
 *     the map each frame, so a cloud is the same physical size at any
 *     zoom level (grows on-screen as you zoom in, like a real object).
 *  2. Each cloud is a cluster of several overlapping soft puffs at
 *     slightly different offsets/sizes (irregular, not a single
 *     ellipse), plus a faint offset shadow blob to suggest the cloud
 *     is floating above the terrain, not painted on it.
 *  3. Clouds are small (a few km wide) and only fade in once zoomed
 *     in close to max zoom — at wide/regional zoom they'd just be
 *     illegible specks, so they stay hidden until useful.
 */

interface Puff {
  dx: number; // fraction of cluster width, -0.5..0.5
  dy: number; // fraction of cluster height
  scale: number; // relative to base puff size
  opacity: number;
}

interface CloudSpec {
  lat: number;
  startLng: number;
  widthKm: number;
  aspect: number; // height / width
  speed: number; // degrees longitude per second
  baseOpacity: number;
  puffs: Puff[];
}

const MIN_LNG = 101.8;
const MAX_LNG = 108.2;

function puffCluster(seed: number): Puff[] {
  // Deterministic pseudo-random-looking puff layout per cloud, so
  // clusters look organic without needing Math.random() at module load.
  const rand = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const count = 5 + Math.floor(rand(1) * 3); // 5-7 puffs
  const puffs: Puff[] = [];
  for (let i = 0; i < count; i++) {
    puffs.push({
      dx: (rand(i * 2 + 1) - 0.5) * 0.85,
      dy: (rand(i * 2 + 2) - 0.5) * 0.5,
      scale: 0.45 + rand(i * 3 + 3) * 0.55,
      opacity: 0.7 + rand(i * 4 + 4) * 0.3,
    });
  }
  return puffs;
}

const CLOUDS: CloudSpec[] = [
  { lat: 14.1, startLng: 102.5, widthKm: 6.5, aspect: 0.42, speed: 0.0022, baseOpacity: 0.20, puffs: puffCluster(1) },
  { lat: 13.2, startLng: 104.8, widthKm: 4.0, aspect: 0.48, speed: 0.0032, baseOpacity: 0.16, puffs: puffCluster(2) },
  { lat: 12.6, startLng: 103.6, widthKm: 8.5, aspect: 0.38, speed: 0.0014, baseOpacity: 0.18, puffs: puffCluster(3) },
  { lat: 11.9, startLng: 106.2, widthKm: 3.2, aspect: 0.52, speed: 0.0036, baseOpacity: 0.14, puffs: puffCluster(4) },
  { lat: 11.2, startLng: 102.9, widthKm: 5.8, aspect: 0.40, speed: 0.0020, baseOpacity: 0.15, puffs: puffCluster(5) },
  { lat: 10.6, startLng: 105.4, widthKm: 4.6, aspect: 0.45, speed: 0.0028, baseOpacity: 0.13, puffs: puffCluster(6) },
  { lat: 12.1, startLng: 108.0, widthKm: 7.2, aspect: 0.40, speed: 0.0018, baseOpacity: 0.17, puffs: puffCluster(7) },
];

// Only render clouds once the map is zoomed in close to its max level —
// at wide/regional zoom they'd just be indistinct specks, so keep them
// hidden until the user is close enough for them to read as clouds.
const VISIBLE_AT_ZOOM = 15;

// Sun assumed upper-left → shadow falls lower-right, as a fraction of cluster size.
const SHADOW_DX = 0.10;
const SHADOW_DY = 0.22;

const KM_PER_DEG_LAT = 111.32;

function makeCloudOverlayClass() {
  return class CloudOverlay extends google.maps.OverlayView {
    private root: HTMLDivElement | null = null;
    private shadow: HTMLDivElement | null = null;
    private body: HTMLDivElement | null = null;
    private position: google.maps.LatLng;

    constructor(private spec: CloudSpec) {
      super();
      this.position = new google.maps.LatLng(spec.lat, spec.startLng);
    }

    onAdd() {
      const root = document.createElement("div");
      root.className = "map-cloud-root";
      root.style.position = "absolute";
      root.style.pointerEvents = "none";
      root.style.opacity = "0";

      const shadow = document.createElement("div");
      shadow.style.position = "absolute";
      shadow.style.pointerEvents = "none";
      shadow.className = "map-cloud-shadow";

      const body = document.createElement("div");
      body.style.position = "absolute";
      body.style.pointerEvents = "none";

      this.spec.puffs.forEach((p) => {
        const puff = document.createElement("div");
        puff.className = "map-cloud-puff";
        puff.style.position = "absolute";
        puff.style.left = `${50 + p.dx * 100}%`;
        puff.style.top = `${50 + p.dy * 100}%`;
        puff.style.width = `${p.scale * 60}%`;
        puff.style.height = `${p.scale * 60}%`;
        puff.style.opacity = String(p.opacity * this.spec.baseOpacity * 5);
        puff.style.transform = "translate(-50%, -50%)";
        body.appendChild(puff);
      });

      root.appendChild(shadow);
      root.appendChild(body);
      this.shadow = shadow;
      this.body = body;
      this.root = root;
      this.getPanes()?.overlayLayer.appendChild(root);
    }

    draw() {
      const proj = this.getProjection();
      if (!proj || !this.root) return;

      const center = proj.fromLatLngToDivPixel(this.position);
      if (!center) return;

      const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((this.spec.lat * Math.PI) / 180);
      const dLng = this.spec.widthKm / kmPerDegLng;
      const edge = proj.fromLatLngToDivPixel(
        new google.maps.LatLng(this.spec.lat, this.position.lng() + dLng)
      );
      if (!edge) return;

      const widthPx = Math.max(20, Math.abs(edge.x - center.x));
      const heightPx = widthPx * this.spec.aspect;

      this.root.style.left = `${center.x - widthPx / 2}px`;
      this.root.style.top = `${center.y - heightPx / 2}px`;
      this.root.style.width = `${widthPx}px`;
      this.root.style.height = `${heightPx}px`;

      if (this.body) {
        this.body.style.width = "100%";
        this.body.style.height = "100%";
        this.body.style.filter = `blur(${Math.max(4, widthPx * 0.045)}px)`;
      }
      if (this.shadow) {
        this.shadow.style.width = "100%";
        this.shadow.style.height = "100%";
        this.shadow.style.left = `${SHADOW_DX * 100}%`;
        this.shadow.style.top = `${SHADOW_DY * 100}%`;
        this.shadow.style.filter = `blur(${Math.max(6, widthPx * 0.08)}px)`;
        this.shadow.style.opacity = String(Math.min(0.14, this.spec.baseOpacity * 0.7));
      }
    }

    onRemove() {
      this.root?.remove();
      this.root = null;
      this.body = null;
      this.shadow = null;
    }

    setLng(lng: number) {
      this.position = new google.maps.LatLng(this.spec.lat, lng);
      this.draw();
    }

    setVisible(visible: boolean) {
      if (this.root) this.root.style.opacity = visible ? "1" : "0";
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

    const updateVisibility = () => {
      const visible = (map.getZoom() ?? 0) >= VISIBLE_AT_ZOOM;
      overlays.forEach((o) => o.setVisible(visible));
    };
    updateVisibility();
    const zoomListener = map.addListener("zoom_changed", updateVisibility);

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
      google.maps.event.removeListener(zoomListener);
      overlays.forEach((o) => o.setMap(null));
    };
  }, [map]);

  return null;
}
