// Shared "bold graphic language" components — mirrors the visual system of
// The Gentry Lab's own AI advisor report (src/routes/tools/advisor.tsx),
// adapted for Word. Cover bands, category badges, key-stat cards, chart
// embeds, pull-quotes, and section tabs all live here so the three
// documents (style guide, site brief, research report) stay identical.

const fs = require("fs");
const path = require("path");
const {
  Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} = require("docx");
const { COLORS, PCOLS, FONT_SANS, FONT_MONO, CONTENT_WIDTH } = require("./brand-config");

const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: COLORS.stone200 };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function imgBuf(name) {
  return fs.readFileSync(path.join(__dirname, name));
}

// ── Hero cover band: black block, white bold title, category badge, ref ──
function heroCover({ logo, eyebrow, title, subtitle, badgeText, badgeColor, refText, dateText }) {
  const band = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [ new TableRow({ children: [
      new TableCell({
        borders: noBorders,
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        shading: { fill: COLORS.black, type: ShadingType.CLEAR },
        margins: { top: 520, bottom: 520, left: 420, right: 420 },
        children: [
          new Paragraph({ children: [
            new ImageRun({ type: "png", data: logo, transformation: { width: 30, height: 30 },
              altText: { title: "TGL mark", description: "The Gentry Lab mark", name: "mark" } }),
            new TextRun({ text: "   THE GENTRY LAB", font: FONT_MONO, size: 15, color: COLORS.white, bold: true }),
          ] }),
          new Paragraph({ spacing: { before: 260, after: 40 }, children: [
            new TextRun({ text: eyebrow.toUpperCase(), font: FONT_MONO, size: 16, color: badgeColor, bold: true }),
          ] }),
          new Paragraph({ spacing: { after: 120 }, children: [
            new TextRun({ text: title, font: FONT_SANS, bold: true, size: 46, color: COLORS.white }),
          ] }),
          ...(subtitle ? [new Paragraph({ spacing: { after: 220 }, children: [
            new TextRun({ text: subtitle, font: FONT_SANS, size: 22, color: "D8D8D8" }),
          ] })] : []),
          new Paragraph({ spacing: { before: 160 }, children: [
            new TextRun({ text: badgeText.toUpperCase() + "   ", font: FONT_MONO, size: 15, color: badgeColor, bold: true }),
            new TextRun({ text: "·  " + refText + "  ·  " + dateText, font: FONT_MONO, size: 15, color: "9A9A9A" }),
          ] }),
        ],
      }),
    ] }) ],
  });
  const rule = new Paragraph({
    spacing: { before: 0, after: 280 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: badgeColor, space: 0 } },
    children: [new TextRun("")],
  });
  return [band, rule];
}

// ── Category badge (small pill-style tag using bracket + color) ──────────
function categoryBadge(text, color) {
  return new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: "■ ", font: FONT_SANS, color, bold: true, size: 18 }),
    new TextRun({ text: text.toUpperCase(), font: FONT_MONO, size: 16, color, bold: true }),
  ] });
}

// ── Section tab: small colored square + eyebrow label before a heading ───
function sectionTab(label, color) {
  return new Paragraph({ spacing: { before: 200, after: 20 }, children: [
    new TextRun({ text: "■ ", font: FONT_SANS, color, bold: true, size: 17 }),
    new TextRun({ text: label.toUpperCase(), font: FONT_MONO, size: 15, color, bold: true }),
  ] });
}

// ── Key stat card row: 3-4 cards, big bold number, colored left rule ─────
function keyStatRow(stats) {
  const n = stats.length;
  const colW = Math.floor(CONTENT_WIDTH / n);
  const widths = Array(n).fill(colW);
  widths[n - 1] = CONTENT_WIDTH - colW * (n - 1);
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [ new TableRow({ children: stats.map((s, i) => new TableCell({
      borders: {
        top: thinBorder, bottom: thinBorder, right: thinBorder,
        left: { style: BorderStyle.SINGLE, size: 20, color: s.color || COLORS.accent },
      },
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: COLORS.stone50, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 200, right: 160 },
      children: [
        new Paragraph({ children: [
          new TextRun({ text: s.value, font: FONT_SANS, bold: true, size: 40, color: COLORS.black }),
        ] }),
        new Paragraph({ spacing: { before: 40 }, children: [
          new TextRun({ text: s.label.toUpperCase(), font: FONT_MONO, size: 14, color: COLORS.muted }),
        ] }),
      ],
    })) }) ],
  });
}

// ── Chart image, centered, with mono caption ──────────────────────────────
function chartImage(fileName, widthPx, heightPx, captionText) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [
      new ImageRun({ type: "png", data: imgBuf(fileName), transformation: { width: widthPx, height: heightPx },
        altText: { title: captionText || fileName, description: captionText || fileName, name: fileName } }),
    ] }),
    ...(captionText ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: captionText, font: FONT_MONO, size: 15, color: COLORS.muted }),
    ] })] : []),
  ];
}

// ── Pull quote — big italic statement with heavy left rule ───────────────
function pullQuote(text, color = COLORS.accent) {
  return new Paragraph({
    spacing: { before: 220, after: 220 }, indent: { left: 320 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color, space: 12 } },
    children: [new TextRun({ text, font: FONT_SANS, italics: true, bold: true, size: 26, color: COLORS.black })],
  });
}

module.exports = { heroCover, categoryBadge, sectionTab, keyStatRow, chartImage, pullQuote, imgBuf, thinBorder };

// ── Comparison matrix — N-column table, black header, bold row labels ────
function compareMatrix(headers, rows) {
  const n = headers.length;
  const first = 2400;
  const rest = Math.floor((CONTENT_WIDTH - first) / (n - 1));
  const widths = [first, ...Array(n - 2).fill(rest), CONTENT_WIDTH - first - rest * (n - 2)];
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) =>
    new TableCell({
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: COLORS.black, type: ShadingType.CLEAR },
      margins: { top: 110, bottom: 110, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: h, font: FONT_SANS, bold: true, size: 19, color: COLORS.white })] })],
    })) });
  const bodyRows = rows.map((r) => new TableRow({ children: r.map((cell, i) =>
    new TableCell({
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      width: { size: widths[i], type: WidthType.DXA },
      shading: i === 0 ? { fill: COLORS.stone50, type: ShadingType.CLEAR } : undefined,
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({
        text: cell, font: i === 0 ? FONT_SANS : FONT_MONO, bold: i === 0, size: i === 0 ? 19 : 18,
        color: COLORS.lightFg })] })],
    })) }));
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...bodyRows] });
}

// ── External factor grid — PESTEL-lite, 5 categorical cards in a 2-col grid
function externalFactorGrid(factors) {
  const colW = Math.floor(CONTENT_WIDTH / 2);
  const emptyCell = () => new TableCell({
    borders: noBorders, width: { size: colW, type: WidthType.DXA },
    children: [new Paragraph({ children: [new TextRun("")] })],
  });
  const rows = [];
  for (let i = 0; i < factors.length; i += 2) {
    const pair = factors.slice(i, i + 2);
    const cells = pair.map((f) => new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 20, color: f.color },
        bottom: thinBorder, left: thinBorder, right: thinBorder,
      },
      width: { size: colW, type: WidthType.DXA },
      shading: { fill: COLORS.stone50, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 200, right: 200 },
      children: [
        new Paragraph({ spacing: { after: 100 }, children: [
          new TextRun({ text: f.label.toUpperCase(), font: FONT_MONO, bold: true, size: 17, color: f.color }),
        ] }),
        ...f.points.map((p) => new Paragraph({ spacing: { after: 70 }, indent: { left: 220, hanging: 220 }, children: [
          new TextRun({ text: "■  ", font: FONT_SANS, color: f.color, bold: true, size: 14 }),
          new TextRun({ text: p, font: FONT_SANS, size: 19, color: COLORS.lightFg }),
        ] })),
      ],
    }));
    if (cells.length === 1) cells.push(emptyCell());
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [colW, CONTENT_WIDTH - colW], rows });
}

// ── Rating bar — dot-scale infographic (e.g. exposure/risk level 1-5) ────
function ratingBar(label, value, max, color) {
  const filled = "●".repeat(value);
  const empty = "○".repeat(Math.max(0, max - value));
  return new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: label + "   ", font: FONT_SANS, size: 20, color: COLORS.lightFg, bold: true }),
    new TextRun({ text: filled, font: FONT_SANS, size: 20, color, bold: true }),
    new TextRun({ text: empty, font: FONT_SANS, size: 20, color: COLORS.stone400 }),
  ] });
}

module.exports.compareMatrix = compareMatrix;
module.exports.externalFactorGrid = externalFactorGrid;
module.exports.ratingBar = ratingBar;
