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
  pxPerSec: number; // drift speed in screen pixels/sec, not real-world wind —
                     // a real-world km/h speed converts to wildly different
                     // on-screen speeds depending on zoom (near-zero at low
                     // zoom, since meters/pixel shrinks a lot at high zoom).
                     // Fixing the screen speed keeps drift visibly moving at
                     // any zoom level where clouds are shown.
  baseOpacity: number;
  puffs: Puff[];
}

const KM_PER_DEG_LAT = 111.32;
const CLOUD_COUNT = 6;
const VISIBLE_AT_ZOOM = 15;
const BOUNDS_PADDING = 0.6; // fraction of viewport span to pad on each side

function puffCluster(seed: number): Puff[] {
  const rand = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const count = 4 + Math.floor(rand(1) * 2); // 4-5 puffs — fewer, so the cluster doesn't smear into a streak
  const puffs: Puff[] = [];
  for (let i = 0; i < count; i++) {
    // Puffs cluster tightly around center in a roughly circular spread
    // (equal dx/dy range) instead of a wide horizontal band, so the
    // overall shape reads as one round, soft cloud rather than a streak.
    const angle = rand(i * 2 + 1) * Math.PI * 2;
    const dist = rand(i * 2 + 2) * 0.28;
    puffs.push({
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      scale: 0.55 + rand(i * 3 + 3) * 0.4,
      opacity: 0.6 + rand(i * 4 + 4) * 0.25,
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
    widthKm: 0.25 + rand(1) * 0.55, // 250-800m — fits inside a max-zoom viewport
    aspect: 0.75 + rand(2) * 0.3, // 0.75-1.05 — round, not a flat streak
    pxPerSec: 18 + rand(3) * 22, // 18-40 px/s — clearly visible, calm drift
    baseOpacity: 0.06 + rand(4) * 0.05, // softer, less dense
    puffs: puffCluster(seed),
  };
}

// Sun assumed upper-left → shadow falls lower-right, as a fraction of cluster size.
const SHADOW_DX = 0.10;
const SHADOW_DY = 0.22;

// 156543.03392 / (111.32 km/deg * 1000) — see tick() for derivation.
const MERCATOR_DEG_CONST = 156543.03392 / (KM_PER_DEG_LAT * 1000);

const FIBER_FILTER_IDS = ["cloud-fiber-a", "cloud-fiber-b", "cloud-fiber-c"];

/**
 * Injects an SVG <defs> block with a few feTurbulence ("fractalNoise")
 * filters, once per document. Applying one of these to a puff's radial
 * gradient carves fibrous, uneven wisps out of its alpha channel —
 * plain radial-gradient blobs read as flat painted circles; real
 * clouds have patchy, fibrous density. Idempotent so remounts don't
 * duplicate it.
 */
function ensureCloudFilterDefs() {
  if (document.getElementById("map-cloud-filter-defs")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "map-cloud-filter-defs");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  const seeds = [7, 23, 41];
  const freqs = ["0.9 0.35", "0.7 0.5", "1.1 0.4"];
  svg.innerHTML = `<defs>${FIBER_FILTER_IDS.map((id, i) => `
    <filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feTurbulence type="fractalNoise" baseFrequency="${freqs[i]}" numOctaves="2" seed="${seeds[i]}" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0.55 0.55 0 0" result="noiseAlpha"/>
      <feComposite in="SourceGraphic" in2="noiseAlpha" operator="in"/>
    </filter>`).join("")}</defs>`;
  document.body.appendChild(svg);
}

function makeCloudOverlayClass() {
  return class CloudOverlay extends google.maps.OverlayView {
    private root: HTMLDivElement | null = null;
    private shadow: HTMLDivElement | null = null;
    private body: HTMLDivElement | null = null;
    lat = 0;
    lng = 0;

    constructor(private tpl: CloudTemplate) {
      super();
    }

    onAdd() {
      ensureCloudFilterDefs();

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

      this.tpl.puffs.forEach((p, i) => {
        // Two stacked layers per puff position: a soft, heavily-blurred
        // "base" (no texture — just a diffuse presence) and a smaller
        // "fiber" layer on top run through an SVG turbulence filter,
        // which carves patchy, uneven density out of it instead of a
        // flat painted circle. Together they read as a layered, wispy
        // cloud rather than a solid blob.
        const base = document.createElement("div");
        base.className = "map-cloud-puff map-cloud-puff-base";
        base.style.position = "absolute";
        base.style.left = `${50 + p.dx * 100}%`;
        base.style.top = `${50 + p.dy * 100}%`;
        base.style.width = `${p.scale * 68}%`;
        base.style.height = `${p.scale * 68}%`;
        base.style.opacity = String(p.opacity * this.tpl.baseOpacity * 2.4);
        base.style.transform = "translate(-50%, -50%)";
        body.appendChild(base);

        const fiber = document.createElement("div");
        fiber.className = "map-cloud-puff map-cloud-puff-fiber";
        fiber.style.position = "absolute";
        fiber.style.left = `${50 + p.dx * 100}%`;
        fiber.style.top = `${50 + p.dy * 100}%`;
        fiber.style.width = `${p.scale * 56}%`;
        fiber.style.height = `${p.scale * 56}%`;
        fiber.style.opacity = String(p.opacity * this.tpl.baseOpacity * 4.5);
        fiber.style.transform = "translate(-50%, -50%)";
        fiber.dataset.fiberId = FIBER_FILTER_IDS[i % FIBER_FILTER_IDS.length];
        body.appendChild(fiber);
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
        // Base layer stays heavily blurred (soft diffuse glow); the fiber
        // layer keeps a lighter blur so its turbulence texture stays
        // legible instead of being smoothed away — this contrast is what
        // reads as "layered" rather than one uniform blurred blob.
        const baseBlur = Math.max(6, widthPx * 0.14);
        const fiberBlur = Math.max(2, widthPx * 0.035);
        this.body.querySelectorAll<HTMLElement>(".map-cloud-puff-base").forEach((el) => {
          el.style.filter = `blur(${baseBlur}px)`;
        });
        this.body.querySelectorAll<HTMLElement>(".map-cloud-puff-fiber").forEach((el) => {
          el.style.filter = `url(#${el.dataset.fiberId}) blur(${fiberBlur}px)`;
        });
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
      this.draw();
    }

    // Converts the cloud's fixed screen-pixel speed into a lng/sec drift
    // rate for the current zoom. Standard Web Mercator resolution is
    // metersPerPixel = 156543.03392 * cos(lat) / 2^zoom — the cos(lat)
    // term cancels against the same term in meters-per-degree-longitude,
    // so this ends up independent of latitude, only zoom-dependent.
    tick(dt: number, zoom: number) {
      const degPerSec = (this.tpl.pxPerSec * MERCATOR_DEG_CONST) / Math.pow(2, zoom);
      this.lng += degPerSec * dt;
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
        const zoom = map.getZoom() ?? VISIBLE_AT_ZOOM;
        overlays.forEach((o) => o.tick(dt, zoom));
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
