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

const KM_PER_DEG_LAT = 111.32;

/**
 * Grid + jitter across Cambodia's landmass so that wherever the user
 * zooms in close, there's a good chance a cloud is nearby — 7 clouds
 * spread across the whole country meant most zoomed-in views had none
 * in frame at all, which read as "nothing is moving."
 *
 * Speed is generated from a realistic wind speed (km/h) and converted
 * to degrees-longitude/sec using each cloud's own latitude, so drift
 * speed reads consistently regardless of where the cloud sits.
 */
function generateClouds(): CloudSpec[] {
  const rand = (seed: number, n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const LAT_MIN = 10.3, LAT_MAX = 14.3;
  const LNG_MIN = 102.2, LNG_MAX = 107.6;
  const COLS = 8, ROWS = 5;

  const clouds: CloudSpec[] = [];
  let seed = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      seed++;
      const jitterLat = (rand(seed, 1) - 0.5) * 0.7;
      const jitterLng = (rand(seed, 2) - 0.5) * 0.7;
      const lat = LAT_MIN + ((r + 0.5) / ROWS) * (LAT_MAX - LAT_MIN) + jitterLat;
      const lng = LNG_MIN + ((c + 0.5) / COLS) * (LNG_MAX - LNG_MIN) + jitterLng;

      const widthKm = 3 + rand(seed, 3) * 6; // 3-9 km
      const windKmh = 14 + rand(seed, 4) * 22; // 14-36 km/h — visible but calm drift
      const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
      const speed = (windKmh / 3600) / kmPerDegLng; // deg lng / sec

      clouds.push({
        lat,
        startLng: lng,
        widthKm,
        aspect: 0.36 + rand(seed, 5) * 0.2,
        speed,
        baseOpacity: 0.12 + rand(seed, 6) * 0.1,
        puffs: puffCluster(seed),
      });
    }
  }
  return clouds;
}

const CLOUDS: CloudSpec[] = generateClouds();

// Only render clouds once the map is zoomed in close to its max level —
// at wide/regional zoom they'd just be indistinct specks, so keep them
// hidden until the user is close enough for them to read as clouds.
const VISIBLE_AT_ZOOM = 15;

// Sun assumed upper-left → shadow falls lower-right, as a fraction of cluster size.
const SHADOW_DX = 0.10;
const SHADOW_DY = 0.22;

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
