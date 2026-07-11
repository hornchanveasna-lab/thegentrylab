import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} from "docx";

const ORANGE = "FF5100";
const DARK = "1A1A1A";
const MUTED = "666666";

export interface SezDocxStats {
  total: number;
  noStatus: number;
  tierCounts: { Gold: number; Silver: number; Bronze: number; None: number };
  topProvinces: [string, number][];
  topZones: { id: string; name: string; province: string; score?: number; eip_tier?: string }[];
  chineseDeveloped: number;
}

function pct(stats: SezDocxStats, n: number) {
  return stats.total ? Math.round((n / stats.total) * 100) : 0;
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, color: DARK, size: 28 })],
  });
}

function body(runs: (string | { text: string; bold?: boolean })[]) {
  return new Paragraph({
    spacing: { after: 200 },
    children: runs.map((r) =>
      typeof r === "string"
        ? new TextRun({ text: r, color: MUTED, size: 22 })
        : new TextRun({ text: r.text, bold: r.bold, color: r.bold ? DARK : MUTED, size: 22 })
    ),
  });
}

function statCell(value: string, label: string) {
  return new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
    },
    margins: { top: 160, bottom: 160, left: 160, right: 160 },
    children: [
      new Paragraph({ children: [new TextRun({ text: value, bold: true, color: ORANGE, size: 32 })] }),
      new Paragraph({ children: [new TextRun({ text: label, color: MUTED, size: 16 })] }),
    ],
  });
}

export async function generateSezDocx(stats: SezDocxStats) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: "THE GENTRY LAB", bold: true, color: ORANGE, size: 20 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Cambodia SEZ Landscape 2026", bold: true, size: 44, color: DARK })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "A census of every SEZ and industrial park on our live map — which zones have genuine infrastructure, which are paper approvals, and where investment is actually landing.",
                color: MUTED, italics: true, size: 22,
              }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [new TextRun({ text: "LIVE DATA — updated continuously, not a static snapshot", bold: true, size: 16, color: MUTED })],
            spacing: { after: 160 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  statCell(String(stats.total), "SEZs & parks tracked"),
                  statCell(String(stats.noStatus), `No confirmed status (${pct(stats, stats.noStatus)}%)`),
                  statCell(String(stats.tierCounts.Gold), "Gold tier (>= 80)"),
                  statCell(String(stats.chineseDeveloped), "Chinese-developed / linked"),
                ],
              }),
            ],
          }),

          heading("The headline number is misleading"),
          body([
            "Cambodia is usually cited as having 71 gazetted SEZs. Our platform actively tracks ",
            { text: `${stats.total}`, bold: true },
            " SEZ / industrial-park entities with verifiable data — and of those, ",
            { text: `${stats.noStatus} (${pct(stats, stats.noStatus)}%)`, bold: true },
            " have no confirmed operating status: no public update, an unreachable website, or a stale Facebook page as the only presence.",
          ]),
          body([
            '"71 SEZs" is a CDC approval count. It is not 71 places you can put a factory. That gap is the single most important thing a first-time investor needs to understand before reading any zone-by-zone pitch deck.',
          ]),

          heading(`Only ${stats.tierCounts.Gold} zones clear Gold tier`),
          body([
            "Scoring every zone against the UNIDO / World Bank Eco-Industrial Park framework (management, environmental, social, economic pillars), just ",
            { text: `${stats.tierCounts.Gold} of ${stats.total} zones score Gold (>= 80)`, bold: true },
            ". Another ",
            { text: `${stats.tierCounts.Silver}`, bold: true },
            " clear Silver. That leaves roughly ",
            { text: `${pct(stats, stats.tierCounts.Bronze + stats.tierCounts.None)}%`, bold: true },
            ' of "SEZs" in Cambodia sitting at Bronze or below — viable for cost-sensitive light manufacturing at best, and in a meaningful number of cases, not viable yet at all.',
          ]),

          ...(stats.topZones.length > 0
            ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: ["Zone", "Province", "Score", "Tier"].map(
                        (h) =>
                          new TableCell({
                            shading: { fill: "F2F2F2" },
                            margins: { top: 100, bottom: 100, left: 120, right: 120 },
                            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: MUTED })] })],
                          })
                      ),
                    }),
                    ...stats.topZones.map(
                      (z) =>
                        new TableRow({
                          children: [
                            new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: z.name, size: 20, color: DARK, bold: true })] })] }),
                            new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: z.province, size: 20, color: MUTED })] })] }),
                            new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(z.score ?? "-"), size: 20, color: ORANGE, bold: true })] })] }),
                            new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: z.eip_tier ?? "-", size: 20, color: MUTED })] })] }),
                          ],
                        })
                    ),
                  ],
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),
              ]
            : []),

          heading("Two clusters carry the whole map"),
          body([
            `Geographically, this isn't ${stats.total} zones spread evenly across the country — it's two dense clusters plus a handful of standouts.` +
              (stats.topProvinces.length > 0
                ? ` ${stats.topProvinces[0][0]} alone accounts for ${stats.topProvinces[0][1]} tracked zones` +
                  (stats.topProvinces[1] ? ` — ${stats.topProvinces[1][0]} follows with ${stats.topProvinces[1][1]}.` : ".")
                : ""),
          ]),
          body([
            "Svay Rieng's Bavet border corridor is Cambodia's most mature manufacturing cluster, anchored by Manhattan SEZ — 50 tenants including Adidas, Puma, Uniqlo and ASICS, exporting an estimated $200M/month, roughly 6% of national exports from a single zone. Kampong Speu tells the opposite story: a dense cluster of small parks, mostly undocumented, with single-digit scores and no confirmed tenants — this is where the \"paper approval\" problem concentrates most heavily.",
          ]),

          heading("The China factor is bigger than headlines suggest"),
          body([
            `At least ${stats.chineseDeveloped} of the tracked zones are explicitly Chinese-developed or state-linked. This isn't a China-vs-West framing problem — it's a practical one: several of the strongest-performing zones on the platform (Sihanoukville SEZ, Score 88; the Sihanoukville Zhejiang Guoji zone, Score 75, now at full capacity) are Chinese-developed, meaning Western investors evaluating "is this zone credible" often need to evaluate Chinese industrial-park track records specifically, not generic SEZ criteria.`,
          ]),

          heading("What separates a real zone from a paper one"),
          body([
            "Looking at what the Gold/Silver-tier zones have in common that the no-status ones lack: a named developer with a traceable history, a confirmed tenant count (not just a hectare figure), port distance under roughly 35km, and — critically — an operating status update within the last 12 months. Zones missing two or more of these are the ones scoring below 40, and typically the ones with no confirmed status at all.",
          ]),

          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: "Sources: The Gentry Lab site tracker (live), CDC/SEZB public gazette, operator disclosures. Scoring: UNIDO/World Bank/GIZ International Framework for Eco-Industrial Parks v2.0.",
                italics: true, size: 16, color: MUTED,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Cambodia-SEZ-Landscape-2026-The-Gentry-Lab.docx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
