/**
 * Mobile coverage GeoTIFF -> reprojected PNG overlay processor.
 * Reprojects operator coverage rasters from UTM48N (EPSG:32648) to Web Mercator.
 * Requires: npm i -D geotiff pngjs proj4
 * Usage: MC_DIR=<dir-of-tifs> node scripts/process-coverage.mjs <outDir>
 * Edit LAYERS[] to choose which operator/tech rasters to export.
 */
import { fromArrayBuffer } from "geotiff";
import { PNG } from "pngjs";
import proj4 from "proj4";
import fs from "fs";
import path from "path";

const UTM48 = "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs";
const MERC  = "EPSG:3857";
const WGS   = "EPSG:4326";
const toMerc = proj4(UTM48, MERC);
const mercToUtm = proj4(MERC, UTM48);
const mercToWgs = proj4(MERC, WGS);

const OUT_DIR = process.argv[2];
const SRC_W = 1600;        // source resample width
const OUT_W = 1500;        // output width

const LAYERS = [
  { key: "cov_cellcard_4g", label: "Cellcard 4G", color: "#f5a800", tif: "Cellcard 4G  LTE.tif" },
  { key: "cov_metfone_4g",  label: "Metfone 4G",  color: "#e30613", tif: "Metfone 4G  LTE.tif" },
  { key: "cov_smart_4g",    label: "Smart 4G",    color: "#3cb44b", tif: "Smart 4G  LTE.tif" },
];

const manifest = [];

for (const L of LAYERS) {
  const data = fs.readFileSync(path.join(process.env.MC_DIR, L.tif));
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const tiff = await fromArrayBuffer(ab);
  const img = await tiff.getImage();
  const ub = img.getBoundingBox();               // UTM [minX,minY,maxX,maxY]
  const W = img.getWidth(), H = img.getHeight();
  const srcH = Math.round(SRC_W * H / W);
  const [R, G, B, A] = await img.readRasters({ width: SRC_W, height: srcH });

  // target Mercator bbox from source corners + edge midpoints
  let tminX = Infinity, tminY = Infinity, tmaxX = -Infinity, tmaxY = -Infinity;
  for (let fx = 0; fx <= 1; fx += 0.5) for (let fy = 0; fy <= 1; fy += 0.5) {
    const ux = ub[0] + fx * (ub[2] - ub[0]);
    const uy = ub[1] + fy * (ub[3] - ub[1]);
    const [mx, my] = toMerc.forward([ux, uy]);
    if (mx < tminX) tminX = mx; if (mx > tmaxX) tmaxX = mx;
    if (my < tminY) tminY = my; if (my > tmaxY) tmaxY = my;
  }
  const outH = Math.round(OUT_W * (tmaxY - tminY) / (tmaxX - tminX));
  const png = new PNG({ width: OUT_W, height: outH });

  for (let oy = 0; oy < outH; oy++) {
    const merY = tmaxY - (oy + 0.5) / outH * (tmaxY - tminY);
    for (let ox = 0; ox < OUT_W; ox++) {
      const merX = tminX + (ox + 0.5) / OUT_W * (tmaxX - tminX);
      const [ux, uy] = mercToUtm.forward([merX, merY]);
      const sx = Math.floor((ux - ub[0]) / (ub[2] - ub[0]) * SRC_W);
      const sy = Math.floor((ub[3] - uy) / (ub[3] - ub[1]) * srcH);
      const o = (oy * OUT_W + ox) * 4;
      if (sx < 0 || sy < 0 || sx >= SRC_W || sy >= srcH) { png.data[o+3] = 0; continue; }
      const si = sy * SRC_W + sx;
      png.data[o] = R[si]; png.data[o+1] = G[si]; png.data[o+2] = B[si]; png.data[o+3] = A[si];
    }
  }

  const outPng = path.join(OUT_DIR, `${L.key}.png`);
  fs.writeFileSync(outPng, PNG.sync.write(png));
  const [west, south] = mercToWgs.forward([tminX, tminY]);
  const [east, north] = mercToWgs.forward([tmaxX, tmaxY]);
  const kb = (fs.statSync(outPng).size / 1024).toFixed(0);
  manifest.push({ key: L.key, label: L.label, color: L.color, png: `/geo/coverage/${L.key}.png`,
    bounds: { north: +north.toFixed(5), south: +south.toFixed(5), east: +east.toFixed(5), west: +west.toFixed(5) } });
  console.log(`✓ ${L.key}: ${OUT_W}x${outH}, ${kb} KB  bounds[N${north.toFixed(2)} S${south.toFixed(2)} E${east.toFixed(2)} W${west.toFixed(2)}]`);
}

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("manifest.json written");
