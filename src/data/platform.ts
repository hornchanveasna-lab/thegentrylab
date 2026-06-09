// Curated seed data for The Gentry Lab Industrial Intelligence Platform.
// Illustrative — based on public knowledge (CDC, SEZ Board, EDC, MPWT).
// Coordinates are approximate.

export type LayerGroup =
  | "investment"
  | "infrastructure"
  | "utilities"
  | "risk"
  | "labor"
  | "corridors";

export type SiteKind =
  | "sez"
  | "park"
  | "factory"
  | "logistics"
  | "port"
  | "airport"
  | "substation"
  | "university"
  | "tvet"
  | "corridor";

export interface MapSite {
  id: string;
  name: string;
  kind: SiteKind;
  layer: LayerGroup;
  province: string;
  lat: number;
  lng: number;
  size?: string;
  status?: "Operational" | "Under Construction" | "Planned";
  utilities?: string;
  road?: string;
  notes?: string;
  score?: number; // suitability snapshot 0-100
  strengths?: string[];
  constraints?: string[];
  targetIndustries?: string[];
  recommendation?: string;
  image_url?: string; // hero image for Inspector panel
}

export interface Corridor {
  id: string;
  name: string;
  shortName: string;
  color: string;
  waypoints: [number, number][]; // [lat, lng] pairs
  description: string;
}

export const LAYER_META: Record<
  LayerGroup,
  { label: string; color: string; description: string }
> = {
  investment: {
    label: "Investment",
    color: "#ff5100",
    description: "SEZs · Industrial parks · Factories · Logistics hubs",
  },
  infrastructure: {
    label: "Infrastructure",
    color: "#facc15",
    description: "Ports · Airports · Expressways",
  },
  utilities: {
    label: "Utilities",
    color: "#38bdf8",
    description: "EDC substations · Water treatment plants",
  },
  risk: {
    label: "Risk",
    color: "#f43f5e",
    description: "Flood plains · Coastal erosion · Environmental zones",
  },
  labor: {
    label: "Labor",
    color: "#a78bfa",
    description: "Universities · TVET centres — 9 provinces",
  },
  corridors: {
    label: "Corridors",
    color: "#34d399",
    description: "9 national road & industrial development corridors",
  },
};

// Corridor waypoints sourced from OSRM (OpenStreetMap road network) — actual road geometry.
// Raw routes simplified with Ramer–Douglas–Peucker (ε ≈ 0.001°) from 1000–3900 raw points.
export const CORRIDORS: Corridor[] = [
  {
    id: "nr1",
    name: "National Road 1 — Phnom Penh to Bavet",
    shortName: "NR1",
    color: "#34d399",
    waypoints: [
      [11.5570, 104.9310],[11.5560, 104.9282],[11.5564, 104.9406],[11.5511, 104.9445],
      [11.5440, 104.9617],[11.5406, 104.9606],[11.5387, 104.9620],[11.5389, 104.9657],
      [11.5332, 104.9795],[11.5325, 104.9928],[11.5275, 105.0087],[11.5239, 105.0189],
      [11.5106, 105.0387],[11.5111, 105.0502],[11.5000, 105.0695],[11.4973, 105.0929],
      [11.4853, 105.1247],[11.4595, 105.1548],[11.4481, 105.1771],[11.4345, 105.1894],
      [11.4265, 105.1994],[11.4156, 105.2206],[11.4047, 105.2325],[11.3919, 105.2406],
      [11.3663, 105.2444],[11.3268, 105.2408],[11.3157, 105.2486],[11.3166, 105.2571],
      [11.3133, 105.2592],[11.3068, 105.2602],[11.3060, 105.2564],[11.2712, 105.2637],
      [11.2704, 105.2666],[11.2754, 105.2755],[11.2770, 105.2904],[11.2607, 105.2944],
      [11.2568, 105.3062],[11.2496, 105.3178],[11.2443, 105.3223],[11.2426, 105.3287],
      [11.1965, 105.3622],[11.1507, 105.4596],[11.1425, 105.4832],[11.1488, 105.5612],
      [11.1556, 105.6120],[11.1405, 105.6456],[11.1232, 105.7035],[11.1082, 105.7405],
      [11.0877, 105.8010],[11.0901, 105.8171],[11.0801, 105.8376],[11.0764, 105.8499],
      [11.0513, 105.8902],[11.0431, 105.9067],[11.0359, 105.9339],[11.0430, 105.9671],
      [11.0379, 106.0101],[11.0479, 106.0012],[11.0620, 106.0032],
    ],
    description: "Key corridor to Vietnam border at Bavet; anchors Svay Rieng SEZ cluster.",
  },
  {
    id: "nr2",
    name: "National Road 2 — Phnom Penh to Kep",
    shortName: "NR2",
    color: "#60a5fa",
    waypoints: [
      [11.5430, 104.9168],[11.5442, 104.9279],[11.5235, 104.9324],[11.4955, 104.9428],
      [11.4921, 104.9435],[11.4874, 104.9416],[11.4812, 104.9448],[11.4674, 104.9349],
      [11.4547, 104.9317],[11.4479, 104.9212],[11.4453, 104.9167],[11.4442, 104.9094],
      [11.4439, 104.8846],[11.4035, 104.8639],[11.3818, 104.8628],[11.3608, 104.8684],
      [11.3406, 104.8674],[11.3137, 104.8508],[11.2914, 104.8439],[11.2425, 104.8118],
      [11.2162, 104.8027],[11.2045, 104.7903],[11.1964, 104.7850],[11.1806, 104.7811],
      [11.1525, 104.7766],[11.1110, 104.7753],[11.0874, 104.7604],[11.0785, 104.7587],
      [11.0616, 104.7615],[11.0456, 104.7613],[11.0092, 104.7548],[10.9930, 104.7567],
      [10.9896, 104.7649],[10.9883, 104.7827],[10.9905, 104.7898],[11.0039, 104.7352],
      [11.0054, 104.7012],[11.0117, 104.6720],[10.9693, 104.6644],[10.9477, 104.6549],
      [10.8415, 104.4636],[10.7921, 104.3899],[10.7703, 104.3737],[10.7170, 104.3141],
      [10.7136, 104.2854],[10.6847, 104.2448],[10.6690, 104.2142],[10.6613, 104.2039],
      [10.6442, 104.1898],[10.6334, 104.1842],[10.6109, 104.1816],[10.6091, 104.1783],
      [10.6012, 104.1811],[10.6017, 104.1862],[10.6069, 104.1885],[10.6118, 104.2145],
      [10.6106, 104.2270],[10.5907, 104.2505],[10.5670, 104.2699],[10.5535, 104.2886],
      [10.5131, 104.2919],[10.5002, 104.2888],[10.4835, 104.2936],[10.4846, 104.2959],
    ],
    description: "Southern corridor through Takeo, linking PP to Kampot and Kep.",
  },
  {
    id: "nr3",
    name: "National Road 3 — Phnom Penh to Kampot",
    shortName: "NR3",
    color: "#f59e0b",
    waypoints: [
      [11.5566, 104.8478],[11.5662, 104.8070],[11.5589, 104.8074],[11.5562, 104.7920],
      [11.5325, 104.7649],[11.5314, 104.7459],[11.5257, 104.7289],[11.5270, 104.7070],
      [11.5145, 104.6820],[11.5130, 104.6638],[11.5045, 104.6491],[11.4941, 104.6172],
      [11.4905, 104.5944],[11.4864, 104.5887],[11.4730, 104.5825],[11.4683, 104.5775],
      [11.4620, 104.5620],[11.4510, 104.5468],[11.4464, 104.5349],[11.4353, 104.5213],
      [11.4330, 104.5028],[11.4142, 104.4552],[11.4338, 104.6551],[11.4061, 104.6504],
      [11.3894, 104.6524],[11.3598, 104.6499],[11.3439, 104.6407],[11.3147, 104.6337],
      [11.2886, 104.6237],[11.2553, 104.6165],[11.2244, 104.5947],[11.2135, 104.5848],
      [11.1900, 104.5723],[11.1692, 104.5586],[11.1576, 104.5452],[11.1438, 104.5352],
      [11.1220, 104.5244],[11.0897, 104.5037],[11.0688, 104.4942],[11.0488, 104.4759],
      [11.0287, 104.4641],[11.0062, 104.4538],[10.9878, 104.4484],[10.9490, 104.4322],
      [10.9053, 104.4133],[10.8682, 104.4018],[10.8220, 104.3693],[10.7752, 104.3476],
      [10.7162, 104.3125],[10.7136, 104.2854],[10.6847, 104.2448],[10.6710, 104.2173],
      [10.6619, 104.2046],[10.6458, 104.1908],[10.6341, 104.1845],[10.6109, 104.1816],
      [10.6040, 104.1802],
    ],
    description: "Connects capital to Kampot province; passes through Kampong Speu industrial belt.",
  },
  {
    id: "nr4",
    name: "National Road 4 — Phnom Penh to Sihanoukville",
    shortName: "NR4",
    color: "#e879f9",
    waypoints: [
      [11.5601, 104.8430],[11.5662, 104.8070],[11.5562, 104.7920],[11.5320, 104.7636],
      [11.5314, 104.7459],[11.5257, 104.7289],[11.5270, 104.7070],[11.5145, 104.6820],
      [11.5130, 104.6638],[11.4933, 104.6149],[11.4899, 104.5931],[11.4864, 104.5887],
      [11.4730, 104.5825],[11.4620, 104.5620],[11.4510, 104.5468],[11.4353, 104.5213],
      [11.4330, 104.5028],[11.4124, 104.4525],[11.3880, 104.4301],[11.3827, 104.4230],
      [11.3761, 104.4018],[11.3730, 104.3805],[11.3578, 104.3602],[11.3484, 104.3404],
      [11.3232, 104.3206],[11.3077, 104.2974],[11.2868, 104.2624],[11.2715, 104.2312],
      [11.2535, 104.2043],[11.2377, 104.1845],[11.2132, 104.1375],[11.2071, 104.0862],
      [11.1974, 104.0606],[11.1794, 104.0394],[11.1577, 104.0262],[11.1432, 103.9907],
      [11.1129, 103.9707],[11.0941, 103.9389],[11.0615, 103.9147],[11.0382, 103.8753],
      [11.0180, 103.8443],[10.9887, 103.8264],[10.9711, 103.8128],[10.9528, 103.7991],
      [10.9235, 103.8116],[10.9057, 103.8131],[10.8971, 103.7483],[10.8834, 103.7356],
      [10.8672, 103.7347],[10.8407, 103.7410],[10.8173, 103.7359],[10.7877, 103.7430],
      [10.7661, 103.7355],[10.7386, 103.7247],[10.7087, 103.6864],[10.6985, 103.6626],
      [10.6971, 103.6423],[10.6824, 103.6138],[10.6604, 103.6135],[10.6293, 103.6044],
      [10.6147, 103.5677],[10.6347, 103.5455],[10.6339, 103.5275],[10.6260, 103.5259],
    ],
    description: "Cambodia's premier industrial corridor; links capital to deep-water port at Sihanoukville.",
  },
  {
    id: "nr5",
    name: "National Road 5 — Phnom Penh to Poipet",
    shortName: "NR5",
    color: "#fb923c",
    waypoints: [
      [11.5580, 104.9210],[11.5691, 104.9221],[11.5818, 104.9193],[11.5851, 104.9171],
      [11.6041, 104.9187],[11.6161, 104.9150],[11.6310, 104.9034],[11.6383, 104.8831],
      [11.6465, 104.8730],[11.6802, 104.8497],[11.7036, 104.8386],[11.7186, 104.8368],
      [11.7396, 104.8288],[11.7712, 104.8257],[11.7856, 104.8220],[11.8061, 104.8080],
      [11.8279, 104.7968],[11.8305, 104.7882],[11.8270, 104.7735],[11.8307, 104.7660],
      [11.8320, 104.7507],[11.8298, 104.7353],[11.8472, 104.7220],[11.8626, 104.7155],
      [11.9024, 104.7059],[11.9546, 104.7192],[12.0040, 104.7264],[12.0342, 104.7292],
      [12.0538, 104.7280],[12.1194, 104.6968],[12.1619, 104.6668],[12.1843, 104.6608],
      [12.2175, 104.6677],[12.2448, 104.6712],[12.2509, 104.6682],[12.2585, 104.6588],
      [12.2705, 104.6401],[12.2715, 104.6235],[12.2759, 104.5946],[12.3147, 104.5646],
      [12.3532, 104.5201],[12.3770, 104.4880],[12.4030, 104.4784],[12.4194, 104.4683],
      [12.4659, 104.4313],[12.4736, 104.4045],[12.4776, 104.3508],[12.4979, 104.3140],
      [12.5292, 104.1884],[12.5257, 104.0105],[12.5293, 103.9355],[12.5343, 103.9195],
      [12.5502, 103.8816],[12.5581, 103.8587],[12.6290, 103.7425],[12.6634, 103.6649],
      [12.6737, 103.6365],[12.6997, 103.6063],[12.7267, 103.4910],[12.7387, 103.4746],
      [12.7587, 103.4564],[12.8545, 103.3897],[12.8850, 103.3753],[12.9345, 103.3564],
      [12.9973, 103.3184],[13.0251, 103.3066],[13.0522, 103.2697],[13.0711, 103.2440],
      [13.0921, 103.2010],[13.1060, 103.1663],[13.1111, 103.1374],[13.1433, 103.1182],
      [13.2181, 103.1086],[13.2561, 103.0908],[13.3040, 103.0731],[13.3666, 103.0346],
      [13.4029, 103.0181],[13.4777, 103.0124],[13.5375, 103.0228],[13.5509, 102.9967],
      [13.5764, 102.9829],[13.5867, 102.9744],[13.5867, 102.9458],[13.5837, 102.8722],
      [13.6191, 102.7293],[13.6280, 102.6754],[13.6308, 102.6259],[13.6342, 102.6002],
      [13.6448, 102.5737],[13.6560, 102.5590],[13.6582, 102.5534],
    ],
    description: "Northwest corridor to Thailand border at Poipet; serves Kampong Chhnang & Pursat.",
  },
  {
    id: "nr6",
    name: "National Road 6 — Phnom Penh to Siem Reap",
    shortName: "NR6",
    color: "#a3e635",
    waypoints: [
      [11.5770, 104.9190],[11.5818, 104.9193],[11.5851, 104.9171],[11.6089, 104.9180],
      [11.6107, 104.9284],[11.6282, 104.9240],[11.6488, 104.9149],[11.6570, 104.9133],
      [11.6666, 104.9133],[11.6778, 104.9181],[11.6988, 104.9329],[11.7122, 104.9505],
      [11.7392, 104.9793],[11.7501, 104.9939],[11.7693, 105.0082],[11.7842, 105.0069],
      [11.7967, 104.9779],[11.8143, 104.9748],[11.8356, 104.9804],[11.8507, 104.9689],
      [11.8606, 104.9585],[11.8775, 104.9547],[11.8918, 104.9227],[11.9151, 104.9282],
      [11.9325, 104.9380],[11.9527, 104.9441],[11.9824, 104.9410],[11.9987, 104.9482],
      [12.0157, 104.9570],[12.0205, 104.9683],[12.0440, 104.9926],[12.0558, 105.0727],
      [12.0581, 105.0909],[12.0492, 105.1126],[12.0848, 105.0757],[12.0965, 105.0739],
      [12.1018, 105.0711],[12.1240, 105.0863],[12.1512, 105.1161],[12.1657, 105.1240],
      [12.1779, 105.1274],[12.2000, 105.1247],[12.2880, 105.1223],[12.3937, 105.0831],
      [12.4238, 105.0885],[12.4630, 105.1158],[12.4756, 105.1204],[12.4944, 105.1222],
      [12.5112, 105.1157],[12.5255, 105.0990],[12.5572, 105.0579],[12.5710, 105.0474],
      [12.5892, 105.0216],[12.6461, 104.9753],[12.6557, 104.9428],[12.6538, 104.9263],
      [12.6690, 104.9071],[12.7015, 104.8922],[12.7346, 104.8976],[12.7507, 104.9059],
      [12.7911, 104.8443],[12.7939, 104.8276],[12.7897, 104.8182],[12.8072, 104.7506],
      [12.8221, 104.6569],[12.8672, 104.6212],[12.8898, 104.6061],[12.9167, 104.5912],
      [12.9421, 104.5836],[12.9502, 104.5808],[12.9650, 104.5653],[13.0002, 104.5634],
      [13.0189, 104.5414],[13.0373, 104.5126],[13.0380, 104.4769],[13.0900, 104.4066],
      [13.0912, 103.3748],[13.1300, 104.3320],[13.1969, 104.2174],[13.2203, 104.1854],
      [13.2532, 104.1082],[13.2861, 104.0665],[13.3420, 104.0009],[13.3481, 103.9567],
      [13.3612, 103.8695],[13.3611, 103.8611],
    ],
    description: "Northern corridor connecting capital to Siem Reap tourism and logistics hub.",
  },
  {
    id: "ring3",
    name: "Ring Road 3 — Phnom Penh Outer Belt",
    shortName: "RR3",
    color: "#22d3ee",
    waypoints: [
      [11.6808, 104.9189],[11.6988, 104.9329],[11.7122, 104.9505],[11.7387, 104.9786],
      [11.7501, 104.9939],[11.7559, 104.9987],[11.7395, 105.0178],[11.7389, 105.0246],
      [11.7324, 105.0299],[11.7314, 105.0371],[11.7296, 105.0395],[11.6838, 105.0570],
      [11.6763, 105.0549],[11.6697, 105.0573],[11.6652, 105.0410],[11.6618, 105.0431],
      [11.6532, 105.0432],[11.4955, 104.9428],[11.4641, 104.9542],[11.4718, 104.9648],
      [11.4663, 104.9665],[11.4689, 105.0057],[11.4684, 105.0317],[11.4644, 105.0425],
      [11.4533, 105.0521],[11.4466, 105.0420],[11.4380, 105.0232],[11.4334, 104.9956],
      [11.4211, 104.9782],[11.4194, 104.9093],[11.4234, 104.8996],[11.4032, 104.8638],
      [11.3818, 104.8628],[11.3608, 104.8684],[11.3408, 104.8675],[11.3137, 104.8508],
      [11.2843, 104.8398],[11.2906, 104.8197],[11.3015, 104.7999],[11.3043, 104.7766],
      [11.3255, 104.7629],[11.3348, 104.7371],[11.3392, 104.7129],[11.3538, 104.6744],
      [11.3587, 104.6494],[11.3894, 104.6524],[11.4061, 104.6504],[11.4338, 104.6551],
      [11.4479, 104.6146],[11.4828, 104.6108],[11.4951, 104.6634],[11.5312, 104.6709],
      [11.5622, 104.6793],[11.5833, 104.6779],[11.5958, 104.6448],[11.6126, 104.6367],
      [11.6285, 104.6392],[11.6397, 104.6353],[11.6427, 104.6482],[11.6420, 104.6604],
      [11.6475, 104.6647],[11.6472, 104.6887],[11.6413, 104.7321],[11.6432, 104.7391],
      [11.6498, 104.7484],[11.6623, 104.8024],[11.6663, 104.8313],[11.6588, 104.8486],
      [11.6653, 104.8772],[11.6819, 104.8847],[11.6888, 104.8922],[11.6815, 104.9206],
      [11.6808, 104.9189],
    ],
    description: "Outer ring road enabling industrial decentralisation from Phnom Penh core.",
  },
  {
    id: "airport-corridor",
    name: "Airport Corridor — Techo International",
    shortName: "Airport",
    color: "#f43f5e",
    waypoints: [
      [11.5670, 104.9181],[11.5349, 104.8853],[11.5340, 104.8797],[11.5215, 104.8760],
      [11.5191, 104.8778],[11.5004, 104.8739],[11.4856, 104.8704],[11.4814, 104.8731],
      [11.4781, 104.8729],[11.4749, 104.8665],[11.4672, 104.8605],[11.4582, 104.8606],
      [11.4548, 104.8588],[11.4528, 104.8479],[11.4475, 104.8443],[11.4472, 104.8378],
      [11.4296, 104.8492],[11.4250, 104.8593],[11.4242, 104.8724],[11.4032, 104.8638],
      [11.3818, 104.8628],[11.3608, 104.8684],[11.3408, 104.8675],[11.3319, 104.8621],
      [11.3324, 104.8505],[11.3359, 104.8510],
    ],
    description: "Dedicated access corridor to Techo International Airport; key for air freight logistics.",
  },
  {
    id: "port-corridor",
    name: "Port Corridor — Sihanoukville",
    shortName: "Port",
    color: "#818cf8",
    waypoints: [
      [10.6260, 103.5259],[10.6339, 103.5275],[10.6343, 103.5460],[10.6143, 103.5677],
      [10.6003, 103.5898],[10.5990, 103.5947],[10.6005, 103.6066],[10.6065, 103.6138],
      [10.6138, 103.6192],[10.6238, 103.6107],
    ],
    description: "Access corridor to Sihanoukville Autonomous Port (SAP); Cambodia's deep-water gateway.",
  },
];

export const SITES: MapSite[] = [
  // Investment — SEZs & parks
  {
    id: "ppsez",
    name: "Phnom Penh SEZ",
    kind: "sez",
    layer: "investment",
    province: "Phnom Penh / Kandal",
    // Verified: Phum Kamrieng, Sangkat Kantok, Khan Kamboul — NR4 at 11°30'29"N, 104°46'41"E
    lat: 11.4885,
    lng: 104.7818,
    size: "360 ha",
    status: "Operational",
    utilities: "115kV substation, 4,800 m³/d water",
    road: "NR4 frontage",
    score: 95,
    notes: "Cambodia's anchor SEZ; garment, electronics and precision components mix.",
    strengths: ["Proven infrastructure", "115kV direct feed", "Bonded warehouse on-site", "NR4 & expressway access"],
    constraints: ["Land premium vs. provincial SEZs", "Wastewater at 80% capacity"],
    targetIndustries: ["Electronics Assembly", "Garment & Textile", "Precision Components", "Logistics"],
    recommendation: "First-choice location for export-oriented light manufacturing requiring reliable utilities and immediate logistics access. Best suited for MNC anchor tenants or JV structures requiring proximity to capital.",
  },
  {
    id: "manhattan",
    name: "Manhattan SVS SEZ",
    kind: "sez",
    layer: "investment",
    province: "Svay Rieng",
    lat: 11.046,
    lng: 106.119,
    size: "180 ha",
    status: "Operational",
    utilities: "Grid + on-site 22kV",
    road: "NR1, Bavet border",
    score: 92,
    notes: "Closest SEZ to Vietnam; ideal for export to HCMC port.",
    strengths: ["Vietnam border adjacency", "Low land cost", "NR1 direct access", "Active tenant community"],
    constraints: ["Single power source (22kV)", "Limited wastewater treatment", "Remote from capital labour pool"],
    targetIndustries: ["Garment & Textile", "Electronics", "Furniture", "Plastics"],
    recommendation: "Strong choice for manufacturers already operating in Vietnam seeking cost arbitrage and ASEAN tariff benefits. Particularly effective for garment and light electronics with HCMC as primary export port.",
  },
  {
    id: "tai-seng",
    name: "Tai Seng Bavet SEZ",
    kind: "sez",
    layer: "investment",
    province: "Svay Rieng",
    lat: 11.064,
    lng: 106.116,
    size: "125 ha",
    status: "Operational",
    score: 88,
    strengths: ["Border zone benefits", "Chinese developer network", "Bonded status"],
    constraints: ["Smaller utility headroom", "Shared grid with Manhattan SEZ"],
    targetIndustries: ["Garment", "Light Manufacturing", "Trade Facilitation"],
    recommendation: "Suitable secondary option in the Bavet cluster for smaller operations seeking border-zone bonded status.",
  },
  {
    id: "sihanoukville-sez",
    name: "Sihanoukville SEZ (SSEZ)",
    kind: "sez",
    layer: "investment",
    province: "Preah Sihanouk",
    lat: 10.622,
    lng: 103.636,
    size: "1,113 ha",
    status: "Operational",
    utilities: "230kV substation, direct port pipeline",
    road: "NR4, PP–SHV Expressway",
    score: 88,
    notes: "Largest SEZ by area; China-led with direct deep-water port adjacency.",
    strengths: ["Direct SAP port access", "230kV substation on-site", "Expressway link to Phnom Penh", "Largest land bank in Cambodia"],
    constraints: ["Regulatory uncertainty post-2023 casino crackdown", "Utility reliability variance", "Perception risk from prior illicit activity"],
    targetIndustries: ["Heavy Industry", "Port Logistics", "Chemicals", "Energy", "Automotive"],
    recommendation: "Best suited for heavy industry and port-dependent manufacturing. Conduct enhanced due diligence on utility reliability and regulatory environment. Strong long-term fundamentals given port adjacency and land scale.",
  },
  {
    id: "techo",
    name: "Techo Industrial Park",
    kind: "park",
    layer: "investment",
    province: "Kandal",
    lat: 11.370,
    lng: 104.91,
    size: "200 ha",
    status: "Under Construction",
    score: 84,
    strengths: ["Adjacent to Techo International Airport", "New infrastructure", "Kandal labor pool"],
    constraints: ["Construction not complete", "Utility connections pending", "Limited track record"],
    targetIndustries: ["Air Freight Logistics", "Pharmaceutical", "Electronics", "Cold Chain"],
    recommendation: "High-potential for air cargo-dependent industries. Monitor construction progress; suitable for early-mover positioning with phased commitment strategy.",
  },
  {
    id: "polo-bavet",
    name: "Polo Bavet Industrial Park",
    kind: "park",
    layer: "investment",
    province: "Svay Rieng",
    lat: 11.052,
    lng: 106.108,
    size: "94 ha",
    status: "Operational",
    score: 81,
    strengths: ["Operational status", "Border proximity", "Thai developer credibility"],
    constraints: ["Smaller scale", "Limited utility capacity"],
    targetIndustries: ["Garment", "Light Assembly", "Packaging"],
    recommendation: "Complementary option within the Bavet corridor cluster for tenants requiring smaller footprints.",
  },
  {
    id: "kampot-park",
    name: "Kampot Industrial Zone",
    kind: "park",
    layer: "investment",
    province: "Kampot",
    lat: 10.62,
    lng: 104.18,
    size: "75 ha",
    status: "Planned",
    score: 70,
    strengths: ["Low land cost", "Port access (Kampot River)", "Agri-processing proximity"],
    constraints: ["Planned status only", "Limited power infrastructure", "Remote labour"],
    targetIndustries: ["Food Processing", "Agro-industry", "Salt & Minerals"],
    recommendation: "Monitor development. Suitable for agro-processing seeking low-cost land near southern coast. Require infrastructure commitments before commitment.",
  },
  {
    id: "isi-sez",
    name: "ISI Special Economic Zone",
    kind: "sez",
    layer: "investment",
    province: "Preah Sihanouk",
    // Cheung Kou commune (Trapeang Kou village), Prey Nob district — along PP-SVK Expressway corridor
    // Coord verified 2026-06 via Nominatim (Prey Nob district 10.72,103.80) + expressway alignment
    lat: 10.855,
    lng: 103.745,
    size: "800 ha (Phase 1: ~206 ha)",
    status: "Operational",
    utilities: "High-voltage grid connection, water supply, wastewater treatment",
    road: "PP-Sihanoukville Expressway (Prey Nob exit); NR4 access; 30 min to SAP deep-water port",
    score: 82,
    image_url: "https://thebettercambodia.com/wp-content/uploads/2025/01/New-Special-Economic-Zone-Launched-in-Sihanoukville.jpeg",
    notes: "ISI SEZ was officially launched January 10, 2025 in Trapeang Kou village, Cheung Kou commune, Prey Nob district, Preah Sihanouk province. Developed by ISI Group (Golden Port SEZ Development Co.), the zone spans 800 ha (Phase 1: ~206 ha, fixed-asset investment >$50M). Positioned directly on the PP-Sihanoukville Expressway corridor — 30 minutes from Sihanoukville Autonomous Port and ~1.5 hours from Phnom Penh. Targets manufacturing, logistics, and light industry seeking expressway + port combination.",
    strengths: [
      "Direct access to PP-Sihanoukville Expressway",
      "30 min to Sihanoukville deep-water port (SAP)",
      "800 ha land bank — large tenant formats possible",
      "New infrastructure, modern utility grid",
      "Techo International Airport planned nearby",
    ],
    constraints: [
      "Zone launched 2025 — limited operational track record",
      "Labour pool smaller than Phnom Penh area",
      "Phase 1 completion ongoing — not all plots ready",
      "Remote from Phnom Penh logistics cluster",
    ],
    targetIndustries: ["Manufacturing", "Logistics & Warehousing", "Light Industry", "Food Processing", "Export Assembly"],
    recommendation: "Compelling for NR4-corridor manufacturers seeking large format land near SAP port at lower cost than PPSEZ. The expressway access solves the historic NR4 congestion problem. Best for mid-to-large operations (>5 ha) where port proximity is a primary criteria. Verify Phase 1 utility commissioning status before committing.",
  },
  {
    id: "ksez",
    name: "Kampong Speu SEZ",
    kind: "sez",
    layer: "investment",
    province: "Kampong Speu",
    lat: 11.56,
    lng: 104.674,
    size: "240 ha",
    status: "Under Construction",
    utilities: "115kV planned, 3,000 m³/d water",
    road: "NR4, PP–SHV Expressway IC",
    score: 82,
    strengths: ["NR4 corridor access", "Expressway interchange", "Competitive land rates", "Labour pool from province"],
    constraints: ["Infrastructure partially complete", "115kV connection pending"],
    targetIndustries: ["Automotive Components", "Garment", "Food Processing", "General Manufacturing"],
    recommendation: "Emerging mid-corridor play on NR4. Best suited for manufacturers seeking NR4 logistics access at lower cost than PPSEZ. Hyundai plant nearby signals automotive cluster forming.",
  },
  // Factories
  {
    id: "f-electro-1",
    name: "Minebea Mitsumi Plant",
    kind: "factory",
    layer: "investment",
    province: "Phnom Penh",
    lat: 11.526,
    lng: 104.755,
    size: "32,000 m²",
    status: "Operational",
    utilities: "115kV feed via PPSEZ grid, 24h cooling water supply",
    road: "NR4 frontage via PPSEZ internal roads",
    notes: "Minebea Mitsumi (Japan) operates a precision miniature ball bearings and motor components plant within PPSEZ. One of the zone's anchor tenants since the early 2010s. Products exported primarily to Japan, Thailand, and China for OEM electronics and automotive applications. Employs ~3,500 workers. Minebea's Cambodia operation is cited as a benchmark for high-precision manufacturing viability in the country.",
    strengths: ["PPSEZ infrastructure + bonded status", "115kV stable power supply", "Japanese management systems", "Proven 10+ year track record in Cambodia"],
    constraints: ["Limited expansion land within PPSEZ footprint", "Skilled technician sourcing competitive"],
    targetIndustries: ["Precision Components", "Electronics", "Automotive Parts"],
  },
  {
    id: "f-garment-1",
    name: "Crystal Martin Facility",
    kind: "factory",
    layer: "investment",
    province: "Kandal",
    lat: 11.43,
    lng: 104.82,
    size: "18,000 m²",
    status: "Operational",
    road: "NR4 corridor, Kandal province",
    notes: "Crystal Martin (Hong Kong) is one of Cambodia's largest vertically integrated apparel manufacturers, supplying international fashion brands including H&M, Gap, and Zara. This facility in Kandal handles finishing and assembly. The company employs over 20,000 workers across its Cambodia operations. Production is export-oriented under the EU Everything But Arms (EBA) and US GSP frameworks.",
    strengths: ["Established supply chain relationships with global brands", "Experienced garment workforce", "NR4 logistics access"],
    constraints: ["Labour-cost pressure vs. Vietnam/Bangladesh", "EBA preference margin erosion risk"],
    targetIndustries: ["Garment & Apparel", "Textile Finishing", "Fashion OEM"],
  },
  {
    id: "f-food-1",
    name: "Cambodia Beverage Co.",
    kind: "factory",
    layer: "investment",
    province: "Phnom Penh",
    lat: 11.55,
    lng: 104.92,
    size: "25,000 m²",
    status: "Operational",
    road: "Ring Road access, northern PP industrial belt",
    notes: "Cambodia Beverage Company (CBC) produces Angkor Beer and other beverages under majority Heineken ownership. The plant runs high-speed bottling lines, refrigeration, and a certified water treatment plant at ~500,000 hectolitres/year. Exports to regional markets. Serves as a benchmark for food/beverage investment viability in Phnom Penh.",
    strengths: ["Domestic market leader", "Proven FMCG scale operations", "Cold chain logistics established"],
    constraints: ["Land-locked urban site limits expansion", "Requires significant water input"],
    targetIndustries: ["Food & Beverage", "FMCG Manufacturing"],
  },
  {
    id: "f-auto-1",
    name: "Hyundai-Kefico Assembly Plant",
    kind: "factory",
    layer: "investment",
    province: "Kampong Speu",
    lat: 11.47,
    lng: 104.48,
    size: "8 ha",
    status: "Under Construction",
    utilities: "115kV feed from Kampong Speu grid, 3,000 m³/d industrial water",
    road: "NR4, adjacent to Kampong Speu SEZ cluster",
    notes: "Hyundai Kefico (Korea) is building Cambodia's first dedicated automotive electronics assembly plant in Kampong Speu, targeting EV control module and engine management unit production. Investment value ~KRW 120B (~$90M). This is the first Korean Tier-1 automotive supplier to establish a greenfield facility in Cambodia, anchoring an emerging automotive sub-cluster on NR4. Target production start: 2026.",
    strengths: ["First-mover Korean auto supplier in Cambodia", "EV component growth sector", "NR4 + expressway logistics"],
    constraints: ["Construction not complete — commissioning risk", "Skilled automotive technician pipeline thin", "Power infrastructure requires upgrade"],
    targetIndustries: ["Automotive Electronics", "EV Components", "Precision Assembly"],
    recommendation: "If Hyundai Kefico succeeds, it will trigger Tier-2/3 supplier clustering on NR4. Kampong Speu sites adjacent to this facility have significant co-location upside.",
  },
  // Logistics
  {
    id: "log-wha",
    name: "WHA Logistics Hub",
    kind: "logistics",
    layer: "investment",
    province: "Kandal",
    lat: 11.46,
    lng: 104.78,
    size: "60 ha",
    status: "Under Construction",
    score: 86,
    utilities: "115kV grid feed planned, 24h water supply",
    road: "NR4, Kandal — 15 km from PP city, 2 km from Ring Road 3",
    notes: "WHA Corporation (Thailand) — ASEAN's largest industrial estate developer — is developing a 60-ha industrial estate and logistics hub in Kandal along NR4. The Cambodia hub targets manufacturers seeking a location between Phnom Penh and Sihanoukville with lower land cost than PPSEZ. Phase 1 (20 ha) targeting 2026 handover.",
    strengths: ["Tier-1 ASEAN industrial developer credibility", "NR4 + future expressway IC access", "Lower cost than PPSEZ", "Thai supply chain network connection"],
    constraints: ["Not yet operational — Phase 1 delivery risk", "Utility connections depend on EDC schedule"],
    targetIndustries: ["Logistics", "Light Manufacturing", "Cold Chain", "E-commerce Fulfillment"],
    recommendation: "Strong mid-term play. WHA's ASEAN credibility reduces developer risk. Best for manufacturers already in WHA's Thai park network seeking Cambodia production.",
  },
  {
    id: "log-dryport",
    name: "Phnom Penh Dry Port",
    kind: "logistics",
    layer: "investment",
    province: "Phnom Penh",
    lat: 11.61,
    lng: 104.85,
    size: "30 ha",
    status: "Operational",
    utilities: "Full grid, water, fibre, 24h operation",
    road: "NR5 / NR6 junction, north Phnom Penh — direct rail siding",
    notes: "Phnom Penh Dry Port (PPDP) is Cambodia's primary inland container depot and customs clearance hub, handling ~150,000 TEU/year with a direct rail connection to the PP-Sihanoukville railway line. Operated by a joint venture including CDC. Offers bonded warehousing, container stuffing/destuffing, and customs pre-clearance. Key node for manufacturers routing cargo to SAP without full road haulage.",
    strengths: ["Rail link to Sihanoukville Port", "Bonded customs pre-clearance", "Night operation available"],
    constraints: ["Congestion during peak garment export seasons (Mar-May, Sep-Nov)", "Rail frequency limited to 1-2 services/day"],
    targetIndustries: ["Container Logistics", "Bonded Warehousing", "Export Manufacturing"],
  },
  {
    id: "log-maersk",
    name: "Maersk Bonded Warehouse",
    kind: "logistics",
    layer: "investment",
    province: "Preah Sihanouk",
    lat: 10.63,
    lng: 103.53,
    size: "22,000 m²",
    status: "Operational",
    utilities: "Grid power, cold storage available",
    road: "SAP port gate — <2 km to container terminal",
    notes: "A.P. Moller-Maersk operates a 22,000 m² bonded logistics facility at Sihanoukville Autonomous Port, providing port-adjacent warehousing, container freight station (CFS), and cross-docking services. Maersk's presence confirms SAP's commercial viability as a deep-water export hub. Handles full container and LCL consolidation for garment, electronics, and food processing exporters.",
    strengths: ["Port-gate adjacency — zero off-dock drayage", "Maersk global logistics network integration", "Bonded CFS status for duty-free processing", "Cold storage available for food exporters"],
    constraints: ["Premium pricing vs. off-port alternatives", "SAP port capacity constraints during peak season"],
    targetIndustries: ["Export Logistics", "Garment Consolidation", "Cold Chain", "E-commerce Exports"],
  },

  // Infrastructure
  {
    id: "port-sihanouk",
    name: "Sihanoukville Autonomous Port",
    kind: "port",
    layer: "infrastructure",
    province: "Preah Sihanouk",
    lat: 10.646,
    lng: 103.508,
    status: "Operational",
    utilities: "230kV grid, bonded zone, 24h operations",
    road: "NR4, PP-Sihanoukville Expressway — ~2.5 hr from PP",
    notes: "Sihanoukville Autonomous Port (SAP) is Cambodia's only deep-water port and primary container gateway, handling ~650,000 TEU/year. SAP 2 expansion adds a second terminal targeting 1.2M TEU by 2028, co-financed by ADB and the Cambodian government. Global carrier calls from Maersk, COSCO, Evergreen, and Yang Ming. Direct rail connection to Phnom Penh Dry Port.",
    strengths: ["Cambodia's sole deep-water container gateway", "Global carrier calls (Maersk, COSCO, Evergreen)", "SAP-2 expansion doubles capacity by 2028", "Rail + road multimodal connections"],
    constraints: ["Port congestion during peak season (Jan-Mar)", "Single port dependency — national supply chain risk"],
    targetIndustries: ["Export Manufacturing", "Container Logistics", "Port Logistics"],
  },
  {
    id: "port-ppap",
    name: "Phnom Penh Autonomous Port (LM17)",
    kind: "port",
    layer: "infrastructure",
    province: "Kandal",
    lat: 11.583,
    lng: 104.922,
    status: "Operational",
    utilities: "Grid, bonded zone, 24h operations",
    road: "Tonle Sap/Mekong confluence, central Phnom Penh",
    notes: "Phnom Penh Autonomous Port (PPAP/LM17) handles barge traffic to/from Vietnam (HCMC via Mekong), domestic cargo, and roll-on/roll-off vessels at ~200,000 TEU equivalent/year. Key for manufacturers exporting via Vietnam's deep-water ports (Cat Lai, Cai Mep) using lower-cost river barging instead of road trucking to SAP.",
    strengths: ["River barge to Vietnam ports — lower cost than road to SAP", "Bonded customs zone on-site", "Less congestion than SAP"],
    constraints: ["Draft-limited by Mekong seasonal low water", "Vietnam customs adds complexity vs. direct SAP export"],
    targetIndustries: ["River Cargo", "Barge Logistics", "Bulk Commodities"],
  },
  {
    id: "airport-techo",
    name: "Techo International Airport",
    kind: "airport",
    layer: "infrastructure",
    province: "Kandal",
    lat: 11.356,
    lng: 104.932,
    status: "Operational",
    utilities: "Full aviation infrastructure, cargo terminal operational",
    road: "Expressway spur from PP Ring Road 3, ~25 km from city centre",
    notes: "Techo International Airport (TIA) opened in late 2025, replacing Phnom Penh's Pochentong airport. Built on 26 km² in Kandal province, TIA handles 13M pax/year (expandable to 50M+). The cargo terminal Phase I (25,000 m²) is operational; Phase II adds a dedicated freighter apron targeting pharma, electronics, and perishables. Cambodia's gateway for air freight-dependent industries.",
    strengths: ["New purpose-built facility — modern cargo handling", "25,000 m² cargo terminal operational", "Expressway + Ring Road 3 direct access"],
    constraints: ["15 km further from Phnom Penh vs. old PNH", "Cargo terminal Phase II not complete until Q3 2026"],
    targetIndustries: ["Air Freight Logistics", "Pharmaceutical Manufacturing", "Electronics Export", "Perishables & Cold Chain"],
  },
  {
    id: "airport-ree",
    name: "Siem Reap-Angkor Intl. Airport",
    kind: "airport",
    layer: "infrastructure",
    province: "Siem Reap",
    lat: 13.3680,
    lng: 104.216,
    status: "Operational",
    utilities: "Full aviation infrastructure, cargo terminal",
    road: "NR6, ~48 km east of Siem Reap city",
    notes: "New Siem Reap-Angkor International Airport (SAI) opened November 2023, built by CCCA on 700 ha with a 4,000m runway and 7M pax/year capacity (expandable to 20M). Primarily serves the Angkor Wat tourism corridor. The modern cargo terminal positions Siem Reap as a secondary logistics hub for northwest agricultural and handicraft exports. Old airport is ~45 km west.",
    strengths: ["Modern 4,000m runway handles wide-body freighters", "Tourism gateway — highest international pax density outside PP", "Cargo terminal for perishables and handicrafts"],
    constraints: ["48 km from Siem Reap city — logistics cost premium", "Limited direct cargo routes vs. Techo Airport"],
    targetIndustries: ["Tourism Logistics", "Perishable Exports", "Handicraft & Artisanal Products"],
  },
  {
    id: "expy-pps",
    name: "PP–Sihanoukville Expressway IC",
    kind: "logistics",
    layer: "infrastructure",
    province: "Kampong Speu",
    lat: 11.453,
    lng: 104.6570,
    status: "Operational",
    notes: "Cambodia's first expressway (opened 2022), 187 km connecting Phnom Penh to Sihanoukville. Built by CRBC under a 50-year BOT concession. Travel time reduced from 4-5 hrs (NR4) to ~2.5 hrs. Eight interchanges serve Kampong Speu, Kampong Seila, Preah Sihanouk, and the SAP port area. Primary logistics spine for the NR4 industrial corridor. Toll: ~$10–15 per 20ft container truck.",
    strengths: ["187 km PP→Sihanoukville in 2.5 hrs", "8 interchanges serving key industrial zones", "Purpose-built truck lanes with 40t axle loading"],
    constraints: ["Tolled — adds ~$10–15 per container truck vs. NR4", "CRBC concession to 2072 — toll escalation risk"],
    targetIndustries: ["Port Logistics", "Manufacturing Supply Chain", "Industrial Park Access"],
  },
  {
    id: "expy-bavet",
    name: "PP–Bavet Expressway (planned)",
    kind: "logistics",
    layer: "infrastructure",
    province: "Svay Rieng",
    lat: 11.30,
    lng: 105.50,
    status: "Planned",
    notes: "Planned 138 km expressway connecting Phnom Penh to Bavet border (Vietnam) via NR1 alignment. A USD 1.6B BOT concession reached financial close May 2026. When built, it will reduce PP-Bavet travel time from ~3.5 hrs to ~1.5 hrs, transforming Svay Rieng SEZ cluster logistics competitiveness. Construction expected to begin late 2026, targeting 2030 completion.",
    strengths: ["Transforms Bavet SEZ logistics — 1.5 hr PP→Vietnam border", "BOT structure reduces government fiscal exposure"],
    constraints: ["Planned only — construction not started", "2030 target is ambitious for Cambodia project timelines"],
    targetIndustries: ["Svay Rieng SEZ Logistics", "Vietnam Supply Chain Integration", "Border Trade"],
  },

  // Utilities
  {
    id: "sub-gs1",
    name: "GS1 230kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Phnom Penh",
    lat: 11.58,
    lng: 104.88,
    status: "Operational",
    utilities: "230/115/22 kV, ~400 MVA capacity",
    notes: "GS1 is EDC's primary bulk transmission substation for Phnom Penh, receiving 230kV from domestic generation (Lower Sesan 2) and Thailand/Vietnam interconnects. Distributes via 115kV rings to PPSEZ, Kandal industrial belt, and central PP distribution substations. A 200 MVA capacity upgrade was completed Q1 2026, increasing headroom for new industrial connections in the PP/Kandal corridor.",
    targetIndustries: ["All industrial sectors in Phnom Penh / Kandal"],
  },
  {
    id: "sub-takmao",
    name: "Takmao 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Kandal",
    lat: 11.475,
    lng: 104.95,
    status: "Operational",
    utilities: "115/22 kV, 200 MVA (upgrade completed Q1 2026)",
    notes: "Takmao substation serves the southeast Phnom Penh/Kandal industrial belt including Takhmao municipality and NR2 corridor factories. The 200 MVA upgrade completed Q1 2026 unlocked capacity for new industrial park connections. Power quality rated 99.2% uptime. Critical for the Kandal garment cluster and emerging logistics parks on NR2 and Ring Road 3.",
    targetIndustries: ["Garment", "Light Manufacturing", "Logistics"],
  },
  {
    id: "sub-bavet",
    name: "Bavet 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Svay Rieng",
    lat: 11.056,
    lng: 106.112,
    status: "Operational",
    utilities: "115/22 kV, 80 MVA — upgrade to 160 MVA planned 2027",
    notes: "Bavet substation is the sole EDC high-voltage supply point for the entire Bavet SEZ cluster (Manhattan, Tai Seng, Polo Bavet). Current capacity 80 MVA is at ~75% utilisation. EDC has budgeted a 160 MVA upgrade for 2027. Any manufacturer requiring >3 MW should conduct an independent power demand survey before committing. SEZ operators have on-site 22kV diesel redundancy averaging 2-3 hrs.",
    constraints: ["80 MVA at 75% utilisation — near-capacity", "Upgrade not until 2027"],
    targetIndustries: ["Garment", "Electronics", "Light Manufacturing"],
  },
  {
    id: "sub-sville",
    name: "Sihanoukville 230kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Preah Sihanouk",
    lat: 10.70,
    lng: 103.62,
    status: "Operational",
    utilities: "230kV, ~300 MVA — serves SSEZ and SAP port complex",
    notes: "Primary grid connection for SSEZ, Sihanoukville Autonomous Port, and the city's industrial north. Connected to the 100MW SSEZ coal power plant. A planned offshore wind interconnect (Cambodian Wind Power, 60MW Phase I) targets this substation as landfall by 2027. Supply is adequate for current industrial demand but will require 2x expansion to service combined SSEZ + ISI SEZ + SAP 2 growth.",
    targetIndustries: ["Heavy Industry", "Port Operations", "Chemical Processing"],
  },
  {
    id: "sub-kampot",
    name: "Kampot 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Kampot",
    lat: 10.61,
    lng: 104.17,
    status: "Operational",
    utilities: "115/22 kV, 80 MVA — ~40% utilisation",
    notes: "Kampot's only 115kV substation serves the provincial town, agricultural processing, and the planned Kampot Industrial Zone. With 80 MVA capacity at ~40% utilisation, there is material headroom for new industrial users. Benefits from reliable cross-border power supply from Vietnam via the Kampot-Ha Tien 115kV interconnect — an underappreciated utility advantage vs. more remote provinces.",
    strengths: ["40% utilisation — significant available headroom", "Vietnam interconnect for supply redundancy"],
    targetIndustries: ["Agro-processing", "Food Manufacturing", "Light Industry"],
  },
  {
    id: "sub-siemreap",
    name: "Siem Reap 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Siem Reap",
    lat: 13.362,
    lng: 103.86,
    status: "Operational",
    utilities: "115/22 kV, 120 MVA — ~55% utilisation",
    notes: "Siem Reap's primary 115kV substation upgraded to 120 MVA in 2024 ahead of the new Siem Reap-Angkor International Airport opening. Currently at ~55% utilisation given tourism's light power demand profile. This surplus capacity is a strategic asset for any manufacturer targeting the northwest corridor or airport-adjacent logistics.",
    strengths: ["55% utilisation — available headroom outside PP", "120 MVA post-2024 upgrade"],
    targetIndustries: ["Light Industry", "Food Processing", "Airport Logistics"],
  },

  // Risk markers
  {
    id: "risk-mekong",
    name: "Mekong Floodplain Belt",
    kind: "logistics",
    layer: "risk",
    province: "Kandal",
    lat: 11.55,
    lng: 105.10,
    notes: "Recurrent monsoon flooding; verify ground elevation > +9.0 mASL before site selection.",
  },
  {
    id: "risk-tonle",
    name: "Tonle Sap Lowlands",
    kind: "logistics",
    layer: "risk",
    province: "Kampong Chhnang",
    lat: 12.25,
    lng: 104.65,
    notes: "Seasonal lake expansion up to 16,000 km². Unsuitable for heavy industry without major ground-raising.",
  },
  {
    id: "risk-coastal",
    name: "Coastal Erosion Zone",
    kind: "logistics",
    layer: "risk",
    province: "Preah Sihanouk",
    lat: 10.58,
    lng: 103.47,
    notes: "Active coastal erosion; 3–5m annual retreat in some areas. Sea level rise risk horizon 2040–2060.",
  },

  // Labor
  {
    id: "u-rupp",
    name: "Royal University of Phnom Penh",
    kind: "university",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.569,
    lng: 104.89,
    notes: "Royal University of Phnom Penh (RUPP) is Cambodia's flagship public university with ~20,000 students. Key faculties for industrial investors: Science (physics, chemistry, biology), Engineering, and Information Technology. Graduates ~1,200 science/engineering students annually. RUPP has active industry partnership programs with CDC-approved investment firms for internship-to-hire pipelines. Language skills are strong — many graduates speak English and Khmer proficiently.",
    strengths: ["Largest public STEM university in Cambodia", "CDC-supported industry internship programs", "Strong English proficiency vs. regional competitors"],
    targetIndustries: ["Electronics", "Data Centers", "Food Science", "IT Services"],
  },
  {
    id: "u-itc",
    name: "Institute of Technology of Cambodia",
    kind: "university",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.57,
    lng: 104.89,
    notes: "Institute of Technology of Cambodia (ITC) is the country's premier engineering university, co-founded by the French government and operating in partnership with major engineering schools (INSA, École Polytechnique network). Produces ~500 engineering graduates annually in civil, mechanical, electrical, and IT engineering. Primary source of graduate engineers for PPSEZ, SSEZ, and large manufacturing operations. Several Japanese and Korean manufacturing companies have dedicated ITC partnership programs.",
    strengths: ["Only dedicated engineering university in Cambodia", "French engineering school curriculum standards", "Japanese/Korean manufacturer partnership programs", "500 engineering graduates/year"],
    constraints: ["Competitive — graduates are recruited heavily by PP-based companies", "Limited postgraduate research capacity"],
    targetIndustries: ["Manufacturing Engineering", "Electronics", "Automotive", "Construction"],
  },
  {
    id: "u-norton",
    name: "Norton University",
    kind: "university",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.568,
    lng: 104.898,
    notes: "Norton University is Cambodia's largest private university with ~25,000 students across faculties of Business, IT, Law, and Engineering. Strong output of business administration and IT graduates relevant to industrial park management, back-office operations, and supply chain logistics. Lower engineering specialisation vs. ITC but strong pipeline for supervisory and management roles in manufacturing. Industry ties with logistics, banking, and telecoms sectors.",
    strengths: ["Largest university in Cambodia by enrolment", "Strong business + IT graduate output", "Industry ties in logistics and management"],
    targetIndustries: ["Logistics Management", "Industrial Administration", "IT Services", "Finance & Compliance"],
  },
  {
    id: "tvet-npic",
    name: "NPIC (National Polytechnic Inst.)",
    kind: "tvet",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.568, // Coord verified 2026-06-09 — Russian Federation Blvd, Tuol Kork, Phnom Penh
    lng: 104.902,
    notes: "National Polytechnic Institute of Cambodia (NPIC) is the country's primary technical and vocational education institution under the Ministry of Labour. Offers 2-3 year diploma programs in mechanical engineering, electrical systems, automotive technology, welding, and industrial maintenance. Produces ~1,500 technician-level graduates annually. Major industrial investors (Japanese automotive, Korean electronics) actively recruit from NPIC and sponsor curriculum co-development programs.",
    strengths: ["Primary source of industrial technicians in Cambodia", "Curriculum co-development with Japanese/Korean manufacturers", "1,500 technician graduates/year"],
    constraints: ["Capacity cannot meet growing industrial demand", "Equipment in some labs dated vs. factory floor standards"],
    targetIndustries: ["Manufacturing Maintenance", "Automotive", "Electronics Assembly", "Industrial Engineering"],
  },
  {
    id: "tvet-svay",
    name: "Svay Rieng RTC",
    kind: "tvet",
    layer: "labor",
    province: "Svay Rieng",
    lat: 11.09,
    lng: 105.80,
    notes: "Svay Rieng Regional Training Centre (RTC) provides vocational training for the Bavet SEZ cluster, offering short-cycle (3-12 month) programs in garment sewing and quality control, electrical assembly, and machine operation. Capacity: ~800 trainees/year. Directly serves the garment and light electronics factories in Manhattan SEZ, Tai Seng SEZ, and Polo Bavet. Co-funded by JICA and Korean Embassy Cambodia programs for quality upskilling.",
    strengths: ["Proximity to Bavet SEZ cluster — on-site candidate pipeline", "JICA-co-funded curriculum for garment QC", "Short-cycle training matching factory ramp-up timelines"],
    constraints: ["Low capacity vs. Bavet cluster demand", "Predominantly garment-oriented — limited electronics/automotive skills"],
    targetIndustries: ["Garment QC", "Light Electronics Assembly", "Machine Operation"],
  },
  {
    id: "tvet-sville",
    name: "Sihanoukville Vocational Training Centre",
    kind: "tvet",
    layer: "labor",
    province: "Preah Sihanouk",
    lat: 10.64,
    lng: 103.53,
    notes: "Sihanoukville Vocational Training Centre provides TVET programs in welding, electrical installation, air conditioning/refrigeration, hospitality, and port logistics for the Preah Sihanouk province industrial and tourism base. Capacity: ~600 trainees/year. Serves SSEZ, the SAP port complex, and the growing ISI SEZ. ADB has funded a $3M upgrade program to add CNC machine operation and industrial automation tracks targeting SSEZ manufacturers.",
    strengths: ["ADB-funded upgrade — new CNC/automation tracks", "Port logistics curriculum serving SAP", "Serves both SSEZ and new ISI SEZ worker pipeline"],
    constraints: ["600/year capacity is insufficient for SSEZ + ISI SEZ combined demand", "Hospitality track competes with industrial programs for trainee slots"],
    targetIndustries: ["Port Logistics", "Industrial Maintenance", "Electronics Manufacturing", "Welding & Fabrication"],
  },
];

// Project Tracker
export type Sector =
  | "Garment"
  | "Electronics"
  | "Food Processing"
  | "Warehousing"
  | "Data Center"
  | "Automotive"
  | "Energy";

export interface TrackedProject {
  id: string;
  name: string;
  sector: Sector;
  province: string;
  size: string;
  investor: string;
  origin: string;
  status: "Planned" | "Under Construction" | "Operational";
  updated: string;
  summary: string;
  // enriched fields (populated by AI agent / Supabase)
  lat?:        number;
  lng?:        number;
  maps_url?:   string;
  source_url?: string;
  image_url?:  string;
  // latest news coverage (updated weekly by agent)
  latest_news_headline?: string;
  latest_news_url?:      string;
  latest_news_date?:     string;
  // CDC registration fields
  cdc_approval_date?: string;   // e.g. "Jun 2025"
  investment_usd?:    string;   // e.g. "$32M"
  planned_finish?:    string;   // e.g. "Q3 2026"
}

export const PROJECTS: TrackedProject[] = [
  { id: "p1", name: "Hyundai-Kefico Assembly Plant", sector: "Automotive", province: "Kampong Speu", size: "8 ha", investor: "Hyundai Mobis", origin: "Korea", status: "Under Construction", updated: "2026-03-12", summary: "Component assembly for SE Asian EV supply chain." },
  { id: "p2", name: "Shenzhou Garment Expansion", sector: "Garment", province: "Phnom Penh", size: "42,000 m²", investor: "Shenzhou Intl.", origin: "China", status: "Operational", updated: "2026-02-04", summary: "Phase III knitwear line, 4,200 workers." },
  { id: "p3", name: "Datacenter PNH-1", sector: "Data Center", province: "Phnom Penh", size: "12 MW", investor: "Telcotech / EDGE", origin: "Cambodia/Singapore", status: "Planned", updated: "2026-04-18", summary: "Tier III carrier-neutral facility, target online 2027." },
  { id: "p4", name: "Wuxi Electronics PCB Plant", sector: "Electronics", province: "Svay Rieng", size: "22,000 m²", investor: "Wuxi Tech", origin: "China", status: "Under Construction", updated: "2026-03-29", summary: "Multi-layer PCB for telecom hardware." },
  { id: "p5", name: "Lotte Foods Cambodia", sector: "Food Processing", province: "Kandal", size: "9 ha", investor: "Lotte Confectionery", origin: "Korea", status: "Planned", updated: "2026-01-21", summary: "Snacks production for ASEAN distribution." },
  { id: "p6", name: "WHA Cold Chain Hub", sector: "Warehousing", province: "Kandal", size: "30,000 m²", investor: "WHA Group", origin: "Thailand", status: "Under Construction", updated: "2026-04-02", summary: "Multi-temperature warehousing, dry port adjacent." },
  { id: "p7", name: "Toray Synthetic Fabrics", sector: "Garment", province: "Preah Sihanouk", size: "15,000 m²", investor: "Toray Industries", origin: "Japan", status: "Operational", updated: "2025-11-30", summary: "Technical textiles for sportswear OEMs." },
  { id: "p8", name: "BYD Auto Assembly", sector: "Automotive", province: "Sihanoukville", size: "20 ha", investor: "BYD", origin: "China", status: "Planned", updated: "2026-05-09", summary: "CKD EV assembly serving ASEAN tariff zones." },
  { id: "p9", name: "Schaeffler Bearings Plant", sector: "Electronics", province: "Phnom Penh", size: "11,000 m²", investor: "Schaeffler AG", origin: "Germany", status: "Under Construction", updated: "2026-02-25", summary: "Precision bearings for industrial machinery." },
  { id: "p10", name: "Smart Axiata Edge POP", sector: "Data Center", province: "Siem Reap", size: "2 MW", investor: "Smart Axiata", origin: "Malaysia", status: "Operational", updated: "2026-01-08", summary: "Northern edge POP serving tourism corridor." },
  { id: "p11", name: "Mondelez Biscuit Plant", sector: "Food Processing", province: "Kampong Speu", size: "6 ha", investor: "Mondelez Intl.", origin: "USA", status: "Planned", updated: "2026-04-30", summary: "Regional biscuit manufacturing." },
  { id: "p12", name: "Maersk Bonded Warehouse", sector: "Warehousing", province: "Preah Sihanouk", size: "22,000 m²", investor: "A.P. Moller-Maersk", origin: "Denmark", status: "Operational", updated: "2025-12-14", summary: "Bonded warehousing at SAP port." },
];

export const SECTORS: Sector[] = [
  "Garment", "Electronics", "Food Processing", "Warehousing", "Data Center", "Automotive", "Energy",
];

// News
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  date: string;
  sector: Sector | "Infrastructure" | "Policy";
  province: string;
  summary: string;
  url: string;
  image_url?: string;  // OG image URL from article (populated by scheduled agents)
}

export const NEWS: NewsItem[] = [
  { id: "n1", headline: "PP–Bavet Expressway reaches financial close", source: "Khmer Times", date: "2026-05-22", sector: "Infrastructure", province: "Svay Rieng", summary: "USD 1.6B BOT concession signed; 138 km link to Vietnam border breaks ground Q4.", url: "#" },
  { id: "n2", headline: "EDC tenders 500 MW solar park in Kampong Chhnang", source: "Phnom Penh Post", date: "2026-05-14", sector: "Energy", province: "Kampong Chhnang", summary: "Pre-qualification opens for IPPs; PPA tenor 25 years.", url: "#" },
  { id: "n3", headline: "Hyundai breaks ground on assembly plant at KSEZ", source: "Nikkei Asia", date: "2026-04-30", sector: "Automotive", province: "Kampong Speu", summary: "Phase I capacity 25,000 vehicles/year, exporting to ASEAN under ATIGA.", url: "#" },
  { id: "n4", headline: "Techo International Airport hits 4M passengers", source: "CAA Cambodia", date: "2026-04-18", sector: "Infrastructure", province: "Kandal", summary: "Cargo terminal Phase II commissioning Q3, +60k tonnes annual capacity.", url: "#" },
  { id: "n5", headline: "CDC approves USD 320M data-center cluster", source: "Khmer Times", date: "2026-04-02", sector: "Data Center", province: "Phnom Penh", summary: "Three Tier III facilities to be developed by 2028; combined 38 MW IT load.", url: "#" },
  { id: "n6", headline: "MoE tightens EIA requirements for >5 ha industrial sites", source: "MoE Cambodia", date: "2026-03-21", sector: "Policy", province: "Nationwide", summary: "New decree mandates 60-day public consultation; affects all SEZ tenants from Jul 1.", url: "#" },
  { id: "n7", headline: "Toray expands technical textile output by 40%", source: "Nikkei Asia", date: "2026-03-09", sector: "Garment", province: "Preah Sihanouk", summary: "Investment of USD 48M; targets Japanese sportswear OEMs.", url: "#" },
  { id: "n8", headline: "EDC commissions Takmao 115 kV substation upgrade", source: "EAC", date: "2026-02-28", sector: "Infrastructure", province: "Kandal", summary: "Adds 200 MVA capacity to southern Phnom Penh industrial belt.", url: "#" },
  { id: "n9", headline: "WHA breaks ground on cold-chain hub near LM17", source: "Bangkok Post", date: "2026-02-15", sector: "Warehousing", province: "Kandal", summary: "30,000 m² multi-temperature warehouse; F&B and pharma tenants.", url: "#" },
  { id: "n10", headline: "BYD signs MoU for Sihanoukville CKD plant", source: "Reuters", date: "2026-01-30", sector: "Automotive", province: "Preah Sihanouk", summary: "Up to 20 ha allocation; production planned for late 2027.", url: "#" },
];

// Research
export interface ResearchBrief {
  id: string;
  title: string;
  category: "Sector" | "Province" | "Regulation" | "Cost";
  pages: number;
  abstract: string;
}

export const RESEARCH: ResearchBrief[] = [
  { id: "r1", title: "Cambodia SEZ Landscape 2026", category: "Sector", pages: 42, abstract: "Census of 54 active and planned SEZs with tenant mix, utility capacity, and absorption rates." },
  { id: "r2", title: "Power Capacity by Province", category: "Province", pages: 28, abstract: "EDC substation inventory, transformer headroom, and 2027 grid reinforcement schedule." },
  { id: "r3", title: "Permit Pathway for Foreign Manufacturers", category: "Regulation", pages: 36, abstract: "End-to-end mapping of CDC, MIH, MoE, MLMUPC and municipal approvals with realistic timelines." },
  { id: "r4", title: "Construction Cost Benchmark — Industrial Buildings", category: "Cost", pages: 22, abstract: "USD/m² ranges for PEB, RC-frame and hybrid factories across six provinces." },
  { id: "r5", title: "Labor Availability & Wage Curves", category: "Sector", pages: 30, abstract: "Provincial labor pool sizing, TVET output, and 5-year wage projections by skill tier." },
  { id: "r6", title: "Land Due Diligence Playbook", category: "Regulation", pages: 48, abstract: "Title verification, hard/soft title risks, encumbrance and easement red flags." },
  { id: "r7", title: "Logistics Cost Map — Factory to Port", category: "Cost", pages: 18, abstract: "Truck, rail and barge cost per TEU from major industrial zones to SAP and HCMC." },
  { id: "r8", title: "Flood Risk Atlas — Industrial Suitability", category: "Province", pages: 26, abstract: "Province-by-province hydrology overlay with recommended minimum platform elevations." },
  { id: "r9", title: "ISI SEZ — Site Intelligence Brief", category: "Sector", pages: 14, abstract: "Operational profile, tenant mix, utility headroom, cost benchmarks, and competitive positioning of ISI SEZ versus PPSEZ and Techo Industrial Park." },
];
