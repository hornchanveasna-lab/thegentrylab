import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * MapClouds — small cumulus clusters that populate whatever part of the
 * map is currently in view, once zoomed in close to max zoom.
 *
 * Earlier versions anchored a fixed, sparse set of clouds to specific
 * lat/lng points scattered across all of Cambodia. That fails at high
 * zoom: a max-zoom viewport is only ~1-3km wide, so the odds of one of
 * those fixed points actually falling inside the visible area were
 * essentially zero — nothing appeared. Fixed-size (multi-km) clouds
 * were also far bigger than the whole visible viewport at that zoom.
 *
 * This version is a small viewport-relative particle system instead:
 * a fixed pool of clouds is kept seeded to random points inside the
 * *current* map bounds (padded), each drifting slowly east. Any cloud
 * that drifts outside the padded bounds — or whenever the user pans/
 * zooms somewhere new — gets reseeded to a fresh random point inside
 * the current view, so there are always a few clouds nearby wherever
 * you're actually looking.
 */

interface Puff {
  dx: number; // fraction of cluster width, -0.5..0.5
  dy: number; // fraction of cluster height
  scale: number; // relative to base puff size
  opacity: number;
}

interface CloudTemplate {
  widthKm: number;
  aspect: number; // height / width
  windKmh: number;
  baseOpacity: number;
  puffs: Puff[];
}

const KM_PER_DEG_LAT = 111.32;
const CLOUD_COUNT = 12;
const VISIBLE_AT_ZOOM = 15;
const BOUNDS_PADDING = 0.6; // fraction of viewport span to pad on each side

function puffCluster(seed: number): Puff[] {
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

function makeTemplate(seed: number): CloudTemplate {
  const rand = (n: number) => {
    const x = Math.sin(seed * 37.719 + n * 91.345) * 12543.847;
    return x - Math.floor(x);
  };
  return {
    widthKm: 0.25 + rand(1) * 0.65, // 250-900m — fits inside a max-zoom viewport
    aspect: 0.36 + rand(2) * 0.2,
    windKmh: 12 + rand(3) * 20,
    baseOpacity: 0.14 + rand(4) * 0.12,
    puffs: puffCluster(seed),
  };
}

// Sun assumed upper-left → shadow falls lower-right, as a fraction of cluster size.
const SHADOW_DX = 0.10;
const SHADOW_DY = 0.22;

function makeCloudOverlayClass() {
  return class CloudOverlay extends google.maps.OverlayView {
    private root: HTMLDivElement | null = null;
    private shadow: HTMLDivElement | null = null;
    private body: HTMLDivElement | null = null;
    lat = 0;
    lng = 0;
    degPerSec = 0;

    constructor(private tpl: CloudTemplate) {
      super();
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

      this.tpl.puffs.forEach((p) => {
        const puff = document.createElement("div");
        puff.className = "map-cloud-puff";
        puff.style.position = "absolute";
        puff.style.left = `${50 + p.dx * 100}%`;
        puff.style.top = `${50 + p.dy * 100}%`;
        puff.style.width = `${p.scale * 60}%`;
        puff.style.height = `${p.scale * 60}%`;
        puff.style.opacity = String(p.opacity * this.tpl.baseOpacity * 5);
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

      const center = proj.fromLatLngToDivPixel(new google.maps.LatLng(this.lat, this.lng));
      if (!center) return;

      const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((this.lat * Math.PI) / 180);
      const dLng = this.tpl.widthKm / kmPerDegLng;
      const edge = proj.fromLatLngToDivPixel(new google.maps.LatLng(this.lat, this.lng + dLng));
      if (!edge) return;

      const widthPx = Math.max(16, Math.abs(edge.x - center.x));
      const heightPx = widthPx * this.tpl.aspect;

      this.root.style.left = `${center.x - widthPx / 2}px`;
      this.root.style.top = `${center.y - heightPx / 2}px`;
      this.root.style.width = `${widthPx}px`;
      this.root.style.height = `${heightPx}px`;

      if (this.body) {
        this.body.style.width = "100%";
        this.body.style.height = "100%";
        this.body.style.filter = `blur(${Math.max(3, widthPx * 0.05)}px)`;
      }
      if (this.shadow) {
        this.shadow.style.width = "100%";
        this.shadow.style.height = "100%";
        this.shadow.style.left = `${SHADOW_DX * 100}%`;
        this.shadow.style.top = `${SHADOW_DY * 100}%`;
        this.shadow.style.filter = `blur(${Math.max(5, widthPx * 0.09)}px)`;
        this.shadow.style.opacity = String(Math.min(0.16, this.tpl.baseOpacity * 0.8));
      }
    }

    onRemove() {
      this.root?.remove();
      this.root = null;
      this.body = null;
      this.shadow = null;
    }

    setPosition(lat: number, lng: number) {
      this.lat = lat;
      this.lng = lng;
      const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
      this.degPerSec = (this.tpl.windKmh / 3600) / kmPerDegLng;
      this.draw();
    }

    tick(dt: number) {
      this.lng += this.degPerSec * dt;
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
    const overlays = Array.from({ length: CLOUD_COUNT }, (_, i) => {
      const o = new CloudOverlay(makeTemplate(i + 1));
      o.setMap(map);
      return o;
    });
    let seeded = false;

    const paddedBounds = () => {
      const b = map.getBounds();
      if (!b) return null;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      const latSpan = ne.lat() - sw.lat();
      const lngSpan = ne.lng() - sw.lng();
      return {
        latMin: sw.lat() - latSpan * BOUNDS_PADDING,
        latMax: ne.lat() + latSpan * BOUNDS_PADDING,
        lngMin: sw.lng() - lngSpan * BOUNDS_PADDING,
        lngMax: ne.lng() + lngSpan * BOUNDS_PADDING,
      };
    };

    const respawn = (o: InstanceType<typeof CloudOverlay>, box: NonNullable<ReturnType<typeof paddedBounds>>) => {
      const lat = box.latMin + Math.random() * (box.latMax - box.latMin);
      const lng = box.lngMin + Math.random() * (box.lngMax - box.lngMin);
      o.setPosition(lat, lng);
    };

    const isVisibleZoom = () => (map.getZoom() ?? 0) >= VISIBLE_AT_ZOOM;

    const seedAll = () => {
      const box = paddedBounds();
      if (!box) return;
      overlays.forEach((o) => respawn(o, box));
      seeded = true;
    };

    const reseedOutOfBounds = () => {
      const box = paddedBounds();
      if (!box) return;
      overlays.forEach((o) => {
        if (o.lat < box.latMin || o.lat > box.latMax || o.lng < box.lngMin || o.lng > box.lngMax) {
          respawn(o, box);
        }
      });
    };

    const updateVisibility = () => {
      const visible = isVisibleZoom();
      overlays.forEach((o) => o.setVisible(visible));
      if (visible && !seeded) seedAll();
    };
    updateVisibility();

    const zoomListener = map.addListener("zoom_changed", updateVisibility);
    const idleListener = map.addListener("idle", () => {
      if (isVisibleZoom()) reseedOutOfBounds();
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (isVisibleZoom() && !reducedMotion) {
        overlays.forEach((o) => o.tick(dt));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      google.maps.event.removeListener(zoomListener);
      google.maps.event.removeListener(idleListener);
      overlays.forEach((o) => o.setMap(null));
    };
  }, [map]);

  return null;
}
