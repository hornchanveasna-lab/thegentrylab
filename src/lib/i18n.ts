/* ─────────────────────────────────────────────────────────────────
   TheGentryLab i18n — 6-language translation system
   Languages: en | kh | cn | fr | kr | jp
───────────────────────────────────────────────────────────────── */

export type LangCode = "en" | "kh" | "cn" | "fr" | "kr" | "jp";

export const LANG_NAMES: Record<LangCode, string> = {
  en: "English",
  kh: "ភាសាខ្មែរ",
  cn: "中文",
  fr: "Français",
  kr: "한국어",
  jp: "日本語",
};

export const LANG_FLAGS: Record<LangCode, string> = {
  en: "🇬🇧",
  kh: "🇰🇭",
  cn: "🇨🇳",
  fr: "🇫🇷",
  kr: "🇰🇷",
  jp: "🇯🇵",
};

export const LANG_ORDER: LangCode[] = ["en", "kh", "cn", "fr", "kr", "jp"];

/* ── Translation dictionary ──────────────────────────────────── */
const T = {
  en: {
    nav: {
      home: "Home", map: "Map", tracker: "Tracker", news: "News",
      research: "Research", about: "About", contact: "Contact",
      getAdvisory: "Get advisory",
    },
    hero: {
      eyebrow: "Industrial Intelligence · Cambodia",
      h1a: "What does it",
      h1b: "actually take to",
      h1c: "develop",
      h1d: "land in Cambodia?",
      sub: "9 stages. 110+ sites mapped. One free platform built from $500M+ of delivered projects.",
      cta1: "Explore the map",
      cta2: "About the platform",
      tags: ["9-Stage GIDF", "110+ Sites", "Free Access", "CDC · EDC · MPWT Data"],
    },
    gidf: {
      eyebrow: "The Framework · GIDF",
      title1: "GentryLab Industrial",
      title2: "Development Framework",
      sub: "Touch any stage to reveal what really happens on the ground in Cambodia.",
      hintOpen: "▼ cambodia intel",
      hintClose: "▲ hide",
      labelStat: "Key insight",
      labelProcess: "What actually happens",
      labelImplication: "Investor implication",
    },
    mapSection: {
      eyebrow: "Free Intelligence Platform",
      title1: "Every SEZ, corridor &",
      title2: "risk zone — mapped.",
      desc: "Our interactive intelligence map layers 110+ industrial sites, 9 development corridors, EDC substation data, flood risk zones, and labour catchments across Cambodia — all free.",
      cta: "Open the map",
      liveBadge: "● Live Intelligence · Cambodia",
      layersBadge: "6 layers active",
      corridorLabel: "9 corridors · 110+ sites",
      launchCta: "Launch interactive map →",
      stats: [
        { n: "110+", label: "Industrial sites" },
        { n: "9",    label: "Dev corridors"    },
        { n: "6",    label: "Data layers"      },
        { n: "Free", label: "Always"           },
      ],
    },
    map: {
      layersBtn: "Layers",
      searchPlaceholder: "Paste Google Maps link or place name…",
      go: "Go",
      yourLocation: "★ YOUR LOCATION",
      noResults: "No results found in Cambodia.",
      badUrl: "Could not extract coordinates from URL.",
      layerControl: "Layer Control",
      searchSite: "Search site or province…",
      disclaimer: "Data illustrative · Verify before investment decision",
      advisory: "GentryLab Advisory",
    },
    contact: {
      eyebrow: "Engage",
      headline1: "Secure your",
      headline2: "industrial",
      headlineAccent: "footprint.",
      body: "Direct advisory for manufacturers and funds entering Cambodia. Typical engagements: feasibility study, technical due diligence, owner's representative for EPC delivery.",
      officeLabel: "Phnom Penh Office",
      contactLabel: "Contact",
      emailBtn: "Email principal advisor",
    },
    footer: { dashboard: "Dashboard" },
    stageTitles: [
      "Site Selection", "Land Due Diligence", "Master Planning",
      "Utility Strategy", "Permit Navigation", "Factory Design",
      "EPC Budgeting", "Delivery", "Operations",
    ],
    stageStats: [
      "3 CDC pre-cleared zones — 30+ provinces with NO industrial land policy",
      "Only 30% of Cambodian industrial land has hard LMAP title",
      "15% green space mandatory — missed by 60% of first CDC submissions",
      "EDC industrial tariff: $0.12–$0.18/kWh — new substation: 8–24 months",
      "9 separate ministry approvals — order matters, most investors get it wrong",
      "Industrial build cost: $280–$420/m² — wrong spec adds 40%+ in retrofit costs",
      "Average cost overrun on Cambodian industrial builds: 23% — 80% from utility surprises",
      "June–October rainy season: construction pace drops 35–45%",
      "SEZ customs clearance: same-day vs 3–5 days outside zone",
    ],
    stageProcess: [
      "Province scoring across 12 criteria: EDC headroom, flood risk, NR access, labour pool, title clarity, CDC reach. GentryLab shortlists to 3 sites before client visits.",
      "Ministry of Land hard title search, encumbrance check at local cadastral office, ownership chain verified back 2 transfers minimum, flood history from ODC GeoServer.",
      "CDC requires masterplan before QIP registration. Layout must show green buffer, fire access road (6m min), internal road grid, utility entry points, waste treatment zone.",
      "Load calculation → EDC feasibility → substation sizing → dedicated line vs shared feeder → water permit from MOWRAM → wastewater discharge to MIME Class B.",
      "Sequence: MoE ECC → MIH licence → CDC QIP → MoLVT → fire dept → building permit → EDC → water authority → customs (SEZ). Wrong order = restart.",
      "ASEAN industrial code applies. Steel portal frame for garment/light mfg. Reinforced concrete for pharma/food. Wet season roof loading: min 1.5kN/m². FM2 floor flatness for logistics.",
      "Bill of quantities → 3 contractor quotes (1 international, 1 regional, 1 local) → contingency for utility works → VAT, stamp duty, professional fees.",
      "Mobilisation → site clearing → foundation → structural frame → envelope → MEP rough-in → fit-out → utility connections → testing & commissioning → handover.",
      "Facility management: MEP maintenance, security, MIME waste audit (quarterly), EDC reconciliation, fire cert (annual), MoLVT labour audit preparation.",
    ],
    stageImplication: [
      "Investors who skip corridor analysis average 14 months longer to first production. Site choice locks your utility cost for 20 years.",
      "Soft-title land can be blocked 2–3 years mid-development. Title risk is the #1 reason foreign industrial projects stall in Cambodia.",
      "QIP status unlocks up to 9 years corporate tax exemption + import duty waiver. A rejected masterplan costs 3–6 months and a full redesign fee.",
      "Power cost differential across provinces: $0.04/kWh. On 3MW demand that's $105K/year. Utility strategy done wrong is a 20-year cost penalty.",
      "Done correctly: 8–11 months. Done incorrectly: 18–30 months. Permit sequencing is GentryLab's highest-value advisory service.",
      "Under-specced factories cost more to upgrade than to build right. GentryLab benchmarks against 60+ buildings — investors save 12–18% vs local estimates.",
      "Benchmarked projects average 8% under final cost vs 23% over for unbenchmarked builds.",
      "Projects that miss the dry season (Nov–May) for foundation works typically slip 6 months.",
      "SEZ operators handle customs in-zone. For export manufacturers, SEZ location saves 3–5 days per shipment cycle.",
    ],
  },

  kh: {
    nav: {
      home: "ទំព័រដើម", map: "ផែនទី", tracker: "តាមដាន", news: "ព័ត៌មាន",
      research: "ស្រាវជ្រាវ", about: "អំពីយើង", contact: "ទំនាក់ទំនង",
      getAdvisory: "ទទួលការប្រឹក្សា",
    },
    hero: {
      eyebrow: "ព័ត៌មានឧស្សាហកម្ម · កម្ពុជា",
      h1a: "តើត្រូវការ",
      h1b: "អ្វីខ្លះដើម្បី",
      h1c: "អភិវឌ្ឍ",
      h1d: "ដីឧស្សាហកម្មនៅកម្ពុជា?",
      sub: "៩ ដំណាក់កាល · ទីតាំងជាង ១១០ · វេទិកាឥតគិតថ្លៃ ដែលបង្កើតពីគម្រោងជាង ៥០០ លានដុល្លារ",
      cta1: "ស្វែងរកផែនទី",
      cta2: "អំពីវេទិកា",
      tags: ["GIDF ៩ ដំណាក់កាល", "ទីតាំង ១១០+", "ចូលប្រើឥតគិតថ្លៃ", "ទិន្នន័យ CDC · EDC · MPWT"],
    },
    gidf: {
      eyebrow: "ក្របខ័ណ្ឌ · GIDF",
      title1: "ក្របខ័ណ្ឌអភិវឌ្ឍន៍ឧស្សាហកម្ម",
      title2: "GentryLab",
      sub: "ចុចលើដំណាក់កាលណាមួយ ដើម្បីស្វែងយល់ពីដំណើរការពិតប្រាកដនៅកម្ពុជា",
      hintOpen: "▼ ព័ត៌មានកម្ពុជា",
      hintClose: "▲ លាក់",
      labelStat: "ចំណុចសំខាន់",
      labelProcess: "អ្វីដែលពិតប្រាកដកើតឡើង",
      labelImplication: "ផលប៉ះពាល់ចំពោះវិនិយោគិន",
    },
    mapSection: {
      eyebrow: "វេទិកាព័ត៌មានឥតគិតថ្លៃ",
      title1: "រដ្ឋប្បកម្ម SEZ ផ្លូវ",
      title2: "និងតំបន់ហានិភ័យ — គ្រប់គ្រាន់",
      desc: "ផែនទីរបស់យើងបង្ហាញទីតាំងឧស្សាហកម្មជាង ១១០ ផ្លូវអភិវឌ្ឍន៍ ៩ ទិន្នន័យ EDC តំបន់ទឹកជំនន់ និងកម្លាំងពលករ — ឥតគិតថ្លៃ",
      cta: "បើកផែនទី",
      liveBadge: "● ព័ត៌មានផ្ទាល់ · កម្ពុជា",
      layersBadge: "ស្រទាប់ ៦ សកម្ម",
      corridorLabel: "ផ្លូវ ៩ · ទីតាំង ១១០+",
      launchCta: "បើកផែនទីអន្តរកម្ម →",
      stats: [
        { n: "១១០+", label: "ទីតាំងឧស្សាហកម្ម" },
        { n: "៩",    label: "ផ្លូវអភិវឌ្ឍន៍" },
        { n: "៦",    label: "ស្រទាប់ទិន្នន័យ" },
        { n: "ឥតគិតថ្លៃ", label: "ជានិច្ច" },
      ],
    },
    map: {
      layersBtn: "ស្រទាប់",
      searchPlaceholder: "បិទភ្ជាប់តំណ Google Maps ឬឈ្មោះទីកន្លែង…",
      go: "ស្វែងរក",
      yourLocation: "★ ទីតាំងរបស់អ្នក",
      noResults: "រកមិនឃើញទីតាំងនៅកម្ពុជា",
      badUrl: "មិនអាចទាញយក좌標ពី URL",
      layerControl: "ការគ្រប់គ្រងស្រទាប់",
      searchSite: "ស្វែងរកទីតាំង ឬខេត្ត…",
      disclaimer: "ទិន្នន័យគំរូ · ផ្ទៀងផ្ទាត់មុនសម្រេចចិត្ត",
      advisory: "ការប្រឹក្សា GentryLab",
    },
    contact: {
      eyebrow: "ទំនាក់ទំនង",
      headline1: "ធានាទីតាំង",
      headline2: "ឧស្សាហកម្ម",
      headlineAccent: "របស់អ្នក",
      body: "ការប្រឹក្សាផ្ទាល់សម្រាប់អ្នកផលិតនិងមូលនិធិដែលចូលកម្ពុជា",
      officeLabel: "ការិយាល័យភ្នំពេញ",
      contactLabel: "ទំនាក់ទំនង",
      emailBtn: "ផ្ញើអ៊ីមែលទៅទីប្រឹក្សា",
    },
    footer: { dashboard: "ផ្ទាំងគ្រប់គ្រង" },
    stageTitles: [
      "ការជ្រើសរើសទីតាំង", "ការត្រួតពិនិត្យដី", "ការរៀបចំមេស្ទ័រផ្លែន",
      "យុទ្ធសាស្ត្រប្រើប្រាស់ប្រើ", "ការចរចារអាជ្ញាប័ណ្ណ", "ការរចនាអគារ",
      "ការធ្វើថវិកា EPC", "ការចែកចាយ", "ប្រតិបត្តិការ",
    ],
    stageStats: [
      "តំបន់ CDC ៣ ដែលបានអនុម័ត — ខេត្តជាង ៣០ គ្មានគោលនយោបាយដីឧស្សាហកម្ម",
      "ដីឧស្សាហកម្មកម្ពុជាតែ ៣០% ប៉ុណ្ណោះដែលមានប័ណ្ណ LMAP",
      "ទំហំបៃតង ១៥% ចាំបាច់ — ៦០% នៃការដាក់ស្នើ CDC លើកដំបូងបរាជ័យ",
      "តម្លៃ EDC: $០.១២–$០.១៨/kWh — ស្ថានីយ៍ថ្មី ៨–២៤ ខែ",
      "ការអនុម័ត ៩ ក្រសួង — លំដាប់សំខាន់ ភាគច្រើនខុស",
      "តម្លៃសំណង់: $២៨០–$៤២០/m² — លក្ខណៈខុសបន្ថែម ៤០%+",
      "ការលើសថវិកាមធ្យម ២៣% — ៨០% ពីការភ្ញាក់ផ្អើលប្រព័ន្ធ",
      "រដូវវស្សា មិថុនា–តុលា: ល្បឿនសំណង់ ៣៥–៤៥%",
      "ការឆ្លងកាត់គយ SEZ: ថ្ងៃតែមួយ ធៀបនឹង ៣–៥ ថ្ងៃខាងក្រៅ",
    ],
    stageProcess: [
      "ការវាយតម្លៃខេត្ត ១២ លក្ខណៈ: EDC, ហានិភ័យទឹកជំនន់, ផ្លូវ NR, ពលករ, ចំណងជើងដី, CDC. GentryLab ជ្រើសរើស ៣ ទីតាំង",
      "ការស្វែងរកចំណងជើងដីពី MoL, ការពិនិត្យ encumbrance, ការផ្ទៀងផ្ទាត់ម្ចាស់ ២ ការផ្ទេរ, ប្រវត្តិទឹកជំនន់",
      "CDC ត្រូវការ masterplan មុន QIP. ប្លង់ត្រូវបង្ហាញ: buffer បៃតង, ផ្លូវភ្លើង (6m), ក្រឡាផ្លូវ, ចំណុចចូល, តំបន់ស្ថានីយ៍",
      "គណនាផ្ទុក → EDC feasibility → ទំហំ substation → សម្រេចចិត្ត dedicated vs shared → ការអនុញ្ញាតទឹក → MIME Class B",
      "លំដាប់: MoE ECC → MIH → CDC QIP → MoLVT → ភ្លើង → building permit → EDC → ទឹក → customs. ខុសសើម = ចាប់ផ្ដើមឡើងវិញ",
      "បទដ្ឋាន ASEAN. Steel portal frame សម្រាប់ garment. RC សម្រាប់ pharma/food. ដំបូលរដូវវស្សា: 1.5kN/m². FM2 floor",
      "Bill of quantities → ការដេញថ្លៃ ៣ (អន្តរជាតិ, ឌីណា, ក្នុងស្រុក) → contingency → VAT, stamp duty, phí chuyên nghiệp",
      "ប្រែកម្ពស់ → ការសម្អាតទីតាំង → មូលដ្ឋាន → ស្ទ្រាំ → MEP → fit-out → ភ្ជាប់ប្រព័ន្ធ → testing → handover",
      "ការគ្រប់គ្រងអគារ: MEP, សន្តិសុខ, MIME audit (ត្រីមាស), EDC, ប្រព័ន្ធភ្លើង (ប្រចាំឆ្នាំ), MoLVT",
    ],
    stageImplication: [
      "វិនិយោគិនដែលរំលងការវិភាគ corridor ជាមធ្យមយូរជាង ១៤ ខែ",
      "ដីប័ណ្ណទន់អាចត្រូវបានបង្អង់ ២–៣ ឆ្នាំ",
      "ស្ថានភាព QIP ឱ្យ ៩ ឆ្នាំ ពន្ធ + ការលើកលែងពន្ធគយ",
      "ភាពខុសគ្នានៃតម្លៃ: $0.04/kWh = $105K/ឆ្នាំ on 3MW",
      "ត្រឹមត្រូវ: ៨–១១ ខែ. ខុស: ១៨–៣០ ខែ",
      "GentryLab benchmark 60+ អគារ — សន្សំ ១២–១៨%",
      "Project benchmark ជាមធ្យម ៨% ក្រោមការប៉ាន់ ធៀបនឹង ២៣% លើស",
      "ខកខាន dry season = ហូរលង ៦ ខែ",
      "SEZ = customs ថ្ងៃតែមួយ — សន្សំ ៣–៥ ថ្ងៃ/shipment",
    ],
  },

  cn: {
    nav: {
      home: "首页", map: "地图", tracker: "追踪", news: "新闻",
      research: "研究", about: "关于", contact: "联系",
      getAdvisory: "获取咨询",
    },
    hero: {
      eyebrow: "工业情报 · 柬埔寨",
      h1a: "在柬埔寨",
      h1b: "开发工业用地",
      h1c: "究竟需要",
      h1d: "做什么？",
      sub: "9个阶段 · 110+个已标注地块 · 基于5亿美元+已交付项目打造的免费平台",
      cta1: "查看地图",
      cta2: "关于平台",
      tags: ["9阶段GIDF", "110+地块", "免费使用", "CDC · EDC · MPWT数据"],
    },
    gidf: {
      eyebrow: "框架体系 · GIDF",
      title1: "GentryLab工业",
      title2: "开发框架",
      sub: "点击任意阶段，了解柬埔寨一线真实情况",
      hintOpen: "▼ 柬埔寨情报",
      hintClose: "▲ 收起",
      labelStat: "关键数据",
      labelProcess: "实际发生的事",
      labelImplication: "对投资者的影响",
    },
    mapSection: {
      eyebrow: "免费情报平台",
      title1: "每一个SEZ、走廊",
      title2: "与风险区 — 全部上图",
      desc: "我们的互动地图涵盖110+工业地块、9条发展走廊、EDC变电站数据、洪水风险区和劳动力覆盖范围 — 完全免费",
      cta: "打开地图",
      liveBadge: "● 实时情报 · 柬埔寨",
      layersBadge: "6个图层已激活",
      corridorLabel: "9条走廊 · 110+地块",
      launchCta: "启动互动地图 →",
      stats: [
        { n: "110+", label: "工业地块" },
        { n: "9",    label: "发展走廊" },
        { n: "6",    label: "数据图层" },
        { n: "免费", label: "永久" },
      ],
    },
    map: {
      layersBtn: "图层",
      searchPlaceholder: "粘贴Google地图链接或地点名称…",
      go: "搜索",
      yourLocation: "★ 您的位置",
      noResults: "在柬埔寨未找到结果",
      badUrl: "无法从URL提取坐标",
      layerControl: "图层控制",
      searchSite: "搜索地块或省份…",
      disclaimer: "数据仅供参考 · 请在投资决策前核实",
      advisory: "GentryLab顾问意见",
    },
    contact: {
      eyebrow: "咨询",
      headline1: "锁定您的",
      headline2: "工业",
      headlineAccent: "布局",
      body: "为进入柬埔寨的制造商和基金提供直接顾问服务：可行性研究、技术尽调、EPC业主代表",
      officeLabel: "金边办公室",
      contactLabel: "联系方式",
      emailBtn: "发送邮件给首席顾问",
    },
    footer: { dashboard: "仪表板" },
    stageTitles: [
      "选址", "土地尽职调查", "总规划",
      "公用设施策略", "审批导航", "厂房设计",
      "EPC预算", "交付", "运营",
    ],
    stageStats: [
      "3个CDC预清关区 — 超过30个省份没有工业用地政策",
      "柬埔寨工业用地仅30%持有LMAP硬权证",
      "强制15%绿地 — 60%的CDC首次申报未达标",
      "EDC工业电价：$0.12–$0.18/度 — 新建变电站：8–24个月",
      "9个独立部门审批 — 顺序至关重要，大多数投资者弄错了",
      "工业建设成本：$280–$420/m² — 规格错误翻修成本增加40%+",
      "柬埔寨工业建设平均超支23% — 80%源于公用设施意外",
      "6–10月雨季：施工进度下降35–45%",
      "经济特区当天清关 vs 区外3–5天",
    ],
    stageProcess: [
      "跨12项指标评分各省：EDC余量、洪水风险、NR通道、劳动力、地权清晰度、CDC覆盖",
      "土地部硬权证查询、地籍局抵押核查、追溯2次转让的所有权链、ODC洪水历史",
      "CDC要求QIP登记前提交总规划。须含绿化带、消防通道(≥6m)、内部路网、市政接入点、污水处理区",
      "负荷计算→EDC可行性→变电站容量→专用线vs共用馈线→MOWRAM取水许可→MIME B类排污",
      "顺序：MoE ECC→MIH→CDC QIP→MoLVT→消防→建筑许可→EDC→水务→海关(SEZ)，顺序错误=重来",
      "适用ASEAN工业规范。服装/轻工用钢结构门式刚架；医药/食品用钢筋混凝土。雨季屋面荷载≥1.5kN/m²",
      "工程量清单→三家报价(国际/区域/本地)→公用配套预留→增值税、印花税、专业费用",
      "进场→场清→基础(雨季关键路径)→主体结构→外围护→MEP→装修→市政接入→调试→竣工",
      "设施管理：MEP维保、安保、MIME废物审计(季度)、EDC电表核对、消防认证(年度)、MoLVT劳工审计",
    ],
    stageImplication: [
      "跳过走廊分析的投资者平均晚14个月投产，选址锁定未来20年能源成本",
      "软权证项目可能被阻碍或延迟2–3年，产权风险是外资工业项目在柬埔寨搁浅的首要原因",
      "QIP资质可解锁最长9年企业所得税豁免+进口关税豁免，总规划被拒耗时3–6个月并需全面修改",
      "各省电费差异可达$0.04/度，3MW用电量每年差价$10.5万，公用设施策略失误是20年成本惩罚",
      "正确流程：8–11个月；错误流程：18–30个月。审批排序是GentryLab价值最高的顾问服务",
      "规格不足的厂房升级成本高于新建，GentryLab对标60+栋已交付建筑，比本地估价节省12–18%",
      "有基准的项目平均低于最终造价8%，无基准超支23%",
      "错过旱季(11月–5月)地基施工窗口的项目通常延误6个月",
      "经济特区在区内办理海关，出口制造商每个运输周期节省3–5天",
    ],
  },

  fr: {
    nav: {
      home: "Accueil", map: "Carte", tracker: "Suivi", news: "Actualités",
      research: "Recherche", about: "À propos", contact: "Contact",
      getAdvisory: "Conseil",
    },
    hero: {
      eyebrow: "Intelligence Industrielle · Cambodge",
      h1a: "Que faut-il vraiment",
      h1b: "pour développer",
      h1c: "du foncier",
      h1d: "industriel au Cambodge ?",
      sub: "9 étapes · 110+ sites cartographiés · Plateforme gratuite issue de 500M$+ de projets livrés",
      cta1: "Explorer la carte",
      cta2: "À propos",
      tags: ["GIDF 9 étapes", "110+ sites", "Accès gratuit", "Données CDC · EDC · MPWT"],
    },
    gidf: {
      eyebrow: "Le Cadre · GIDF",
      title1: "Cadre de Développement",
      title2: "Industriel GentryLab",
      sub: "Cliquez sur une étape pour découvrir la réalité du terrain au Cambodge",
      hintOpen: "▼ intel cambodge",
      hintClose: "▲ réduire",
      labelStat: "Chiffre clé",
      labelProcess: "Ce qui se passe réellement",
      labelImplication: "Impact pour l'investisseur",
    },
    mapSection: {
      eyebrow: "Plateforme d'intelligence gratuite",
      title1: "Chaque ZES, corridor",
      title2: "et zone à risque — cartographié",
      desc: "Notre carte interactive superpose 110+ sites industriels, 9 corridors de développement, les données des sous-stations EDC, les zones inondables et les bassins de main-d'œuvre — le tout gratuitement",
      cta: "Ouvrir la carte",
      liveBadge: "● Intelligence en direct · Cambodge",
      layersBadge: "6 couches actives",
      corridorLabel: "9 corridors · 110+ sites",
      launchCta: "Lancer la carte interactive →",
      stats: [
        { n: "110+", label: "Sites industriels" },
        { n: "9",    label: "Corridors"         },
        { n: "6",    label: "Couches de données"},
        { n: "Free", label: "Toujours"          },
      ],
    },
    map: {
      layersBtn: "Couches",
      searchPlaceholder: "Coller un lien Google Maps ou un nom de lieu…",
      go: "Aller",
      yourLocation: "★ VOTRE POSITION",
      noResults: "Aucun résultat au Cambodge",
      badUrl: "Impossible d'extraire les coordonnées de l'URL",
      layerControl: "Contrôle des couches",
      searchSite: "Rechercher un site ou une province…",
      disclaimer: "Données illustratives · À vérifier avant toute décision d'investissement",
      advisory: "Conseil GentryLab",
    },
    contact: {
      eyebrow: "Engagement",
      headline1: "Sécurisez votre",
      headline2: "empreinte",
      headlineAccent: "industrielle.",
      body: "Conseil direct pour les industriels et fonds entrant au Cambodge : étude de faisabilité, due diligence technique, maîtrise d'ouvrage déléguée EPC",
      officeLabel: "Bureau de Phnom Penh",
      contactLabel: "Contact",
      emailBtn: "Écrire au conseiller principal",
    },
    footer: { dashboard: "Tableau de bord" },
    stageTitles: [
      "Sélection de site", "Due diligence foncière", "Planification directrice",
      "Stratégie utilités", "Navigation permis", "Conception usine",
      "Budgétisation EPC", "Livraison", "Exploitation",
    ],
    stageStats: [
      "3 zones pré-approuvées CDC — plus de 30 provinces sans politique foncière industrielle",
      "Seulement 30% des terrains industriels cambodgiens ont un titre LMAP dur",
      "15% d'espaces verts obligatoires — manqué par 60% des premières soumissions CDC",
      "Tarif EDC industriel : 0,12–0,18$/kWh — nouveau sous-station : 8–24 mois",
      "9 approbations ministérielles distinctes — l'ordre compte, la plupart des investisseurs se trompent",
      "Construction industrielle : 280–420$/m² — mauvaise spec = +40% en rénovation",
      "Dépassement moyen au Cambodge : 23% — 80% viennent des surprises sur les utilités",
      "Saison des pluies juin–octobre : rythme de construction –35 à 45%",
      "Dédouanement ZES : le jour même vs 3–5 jours hors zone",
    ],
    stageProcess: [
      "Notation provinciale sur 12 critères : capacité EDC, risque inondation, accès NR, main-d'œuvre, clarté du titre, couverture CDC",
      "Recherche titre dur au Ministère des Terres, vérification des charges cadastrales, chaîne de propriété sur 2 transferts minimum, historique inondations ODC",
      "CDC exige le masterplan avant l'enregistrement QIP. Le plan doit montrer : zone tampon verte, voie pompiers (6m min), voirie interne, points d'entrée utilités, zone traitement eaux usées",
      "Calcul de charge → faisabilité EDC → dimensionnement sous-station → ligne dédiée vs feeder partagé → permis eau MOWRAM → rejet MIME Classe B",
      "Séquence : ECC MoE → licence MIH → QIP CDC → MoLVT → pompiers → permis construire → EDC → eau → douanes (ZES). Mauvais ordre = recommencer",
      "Norme ASEAN. Portique acier pour confection/industrie légère. Béton armé pour pharma/agroalimentaire. Charge toiture saison pluies ≥1,5kN/m². Planéité FM2 pour logistique",
      "Métrés depuis plans → 3 offres (1 international, 1 régional, 1 local) → contingence raccordements (souvent exclus) → TVA, droits d'enregistrement, honoraires",
      "Mobilisation → débroussaillage → fondations (chemin critique en saison pluies) → structure → enveloppe → MEP → second œuvre → raccordements → mise en service → réception",
      "Gestion d'installation : maintenance MEP, sécurité, audit MIME (trimestriel), réconciliation EDC, certification incendie (annuel), audit MoLVT",
    ],
    stageImplication: [
      "Les investisseurs qui sautent l'analyse corridor démarrent en production 14 mois plus tard en moyenne. Le choix du site verrouille le coût énergie pour 20 ans",
      "Un terrain à titre mou peut être bloqué 2–3 ans en cours de développement. Le risque foncier est la 1ère cause d'arrêt des projets industriels étrangers au Cambodge",
      "Le statut QIP débloque jusqu'à 9 ans d'exonération IS + franchise douanière. Un masterplan refusé coûte 3–6 mois et une refonte complète",
      "L'écart de coût énergie entre provinces : 0,04$/kWh. Sur 3MW, c'est 105 000$/an. Une mauvaise stratégie utilités est une pénalité de coût sur 20 ans",
      "Bien fait : 8–11 mois. Mal fait : 18–30 mois. Le séquencement des permis est le service le plus rentable de GentryLab",
      "Une usine sous-dimensionnée coûte plus à améliorer qu'à bien construire. GentryLab benchmark 60+ bâtiments livrés — économies de 12–18% vs estimations locales",
      "Les projets benchmarkés finissent en moyenne 8% sous le coût final vs 23% de dépassement sans benchmark",
      "Les projets qui ratent la fenêtre saison sèche (nov–mai) pour les fondations glissent typiquement de 6 mois",
      "Les opérateurs ZES gèrent les douanes en zone — économie de 3–5 jours par cycle d'expédition",
    ],
  },

  kr: {
    nav: {
      home: "홈", map: "지도", tracker: "추적기", news: "뉴스",
      research: "연구", about: "소개", contact: "문의",
      getAdvisory: "자문 받기",
    },
    hero: {
      eyebrow: "산업 인텔리전스 · 캄보디아",
      h1a: "캄보디아에서",
      h1b: "산업 부지를",
      h1c: "개발하려면",
      h1d: "무엇이 필요한가?",
      sub: "9단계 · 110개 이상 부지 · 5억 달러 이상 프로젝트 기반의 무료 플랫폼",
      cta1: "지도 탐색",
      cta2: "플랫폼 소개",
      tags: ["9단계 GIDF", "110개+ 부지", "무료 이용", "CDC · EDC · MPWT 데이터"],
    },
    gidf: {
      eyebrow: "프레임워크 · GIDF",
      title1: "GentryLab 산업",
      title2: "개발 프레임워크",
      sub: "각 단계를 클릭하여 캄보디아 현장에서 실제로 일어나는 일을 확인하세요",
      hintOpen: "▼ 캄보디아 인텔",
      hintClose: "▲ 닫기",
      labelStat: "핵심 인사이트",
      labelProcess: "실제로 일어나는 일",
      labelImplication: "투자자 영향",
    },
    mapSection: {
      eyebrow: "무료 인텔리전스 플랫폼",
      title1: "모든 SEZ, 개발 축",
      title2: "및 위험 지역 — 지도화",
      desc: "110개 이상의 산업 부지, 9개 개발 축, EDC 변전소 데이터, 홍수 위험 지역, 노동력 현황을 레이어로 제공 — 완전 무료",
      cta: "지도 열기",
      liveBadge: "● 실시간 인텔리전스 · 캄보디아",
      layersBadge: "6개 레이어 활성",
      corridorLabel: "9개 축 · 110개+ 부지",
      launchCta: "인터랙티브 지도 열기 →",
      stats: [
        { n: "110+", label: "산업 부지" },
        { n: "9",    label: "개발 축"  },
        { n: "6",    label: "데이터 레이어" },
        { n: "무료", label: "항상"     },
      ],
    },
    map: {
      layersBtn: "레이어",
      searchPlaceholder: "Google Maps 링크 또는 장소명 붙여넣기…",
      go: "검색",
      yourLocation: "★ 내 위치",
      noResults: "캄보디아에서 결과를 찾을 수 없습니다",
      badUrl: "URL에서 좌표를 추출할 수 없습니다",
      layerControl: "레이어 제어",
      searchSite: "부지 또는 주 검색…",
      disclaimer: "데이터 참고용 · 투자 결정 전 반드시 확인",
      advisory: "GentryLab 자문",
    },
    contact: {
      eyebrow: "문의",
      headline1: "산업",
      headline2: "거점을",
      headlineAccent: "확보하세요.",
      body: "캄보디아 진출 제조기업 및 펀드를 위한 직접 자문: 타당성 조사, 기술 실사, EPC 발주처 대리",
      officeLabel: "프놈펜 사무소",
      contactLabel: "연락처",
      emailBtn: "수석 자문에게 이메일",
    },
    footer: { dashboard: "대시보드" },
    stageTitles: [
      "부지 선정", "토지 실사", "마스터 플랜",
      "유틸리티 전략", "허가 절차", "공장 설계",
      "EPC 예산", "납품", "운영",
    ],
    stageStats: [
      "CDC 사전 승인 구역 3개 — 산업 토지 정책 없는 30개 이상 주",
      "캄보디아 산업 토지 중 LMAP 경성 권원 보유 30%에 불과",
      "녹지 15% 의무 — CDC 최초 제출의 60% 미달",
      "EDC 산업 전기요금: $0.12–$0.18/kWh — 신규 변전소: 8–24개월",
      "9개 부처 개별 승인 — 순서가 핵심, 대부분 투자자가 잘못함",
      "산업 건축비: $280–$420/m² — 잘못된 스펙 = 40%+ 추가 비용",
      "캄보디아 평균 공사 초과: 23% — 80%는 유틸리티 예상 외 비용",
      "6–10월 우기: 공사 속도 35–45% 감소",
      "SEZ 통관: 당일 vs 구역 외 3–5일",
    ],
    stageProcess: [
      "12개 기준으로 주 평가: EDC 여유, 홍수 위험, NR 접근, 노동력, 권원 명확성, CDC 커버리지. GentryLab 3개 부지로 압축",
      "토지부 경성 권원 조회, 지적 사무소 담보 확인, 최소 2회 양도 소유권 체인, ODC 홍수 이력",
      "CDC는 QIP 등록 전 마스터플랜 제출 필요. 녹지 완충, 소방 도로(6m 이상), 내부 도로망, 유틸리티 진입점, 폐수 처리 구역 포함",
      "부하 계산 → EDC 타당성 → 변전소 용량 → 전용선 vs 공유 피더 → MOWRAM 취수 허가 → MIME Class B 방류",
      "순서: MoE ECC → MIH → CDC QIP → MoLVT → 소방 → 건축 허가 → EDC → 수도 → 세관(SEZ). 순서 오류 = 처음부터",
      "ASEAN 산업 규정 적용. 의류/경공업은 스틸 포털 프레임, 제약/식품은 RC. 우기 지붕 하중 ≥1.5kN/m², 물류 FM2 평탄도",
      "물량 산출서 → 3사 견적(국제, 지역, 현지) → 유틸리티 연결 공사 예비비 → 부가세, 인지세, 전문가 수수료",
      "동원 → 부지 정리 → 기초(우기 크리티컬 패스) → 구조체 → 외피 → MEP → 마감 → 유틸리티 연결 → 시운전 → 인도",
      "시설 관리: MEP 유지보수, 보안, MIME 폐기물 감사(분기), EDC 전력 정산, 소방 인증(연간), MoLVT 노동 감사",
    ],
    stageImplication: [
      "개발 축 분석을 건너뛴 투자자는 평균 14개월 늦게 생산 개시. 부지 선택은 20년 에너지 비용을 고정",
      "연성 권원 토지는 개발 중 2–3년 지연될 수 있음. 권원 위험은 외국인 산업 프로젝트 지연 1위",
      "QIP 지위로 최대 9년 법인세 면제 + 수입관세 면제. 마스터플랜 반려 시 3–6개월 손실",
      "주별 전력비 차이 $0.04/kWh = 3MW 기준 연 $10.5만. 잘못된 유틸리티 전략은 20년 비용 패널티",
      "올바른 경우: 8–11개월. 잘못된 경우: 18–30개월. 허가 순서는 GentryLab 최고 가치 서비스",
      "규격 미달 공장 업그레이드 비용 > 처음부터 제대로 짓기. GentryLab 60개+ 건물 벤치마크 — 현지 견적 대비 12–18% 절감",
      "벤치마크 프로젝트는 최종 비용보다 평균 8% 낮음 vs 비벤치마크 23% 초과",
      "건기(11–5월) 기초 공사 창을 놓치면 통상 6개월 지연",
      "SEZ 운영자는 구역 내 통관 처리. 수출 제조업체는 선적 주기당 3–5일 절감",
    ],
  },

  jp: {
    nav: {
      home: "ホーム", map: "地図", tracker: "追跡", news: "ニュース",
      research: "リサーチ", about: "概要", contact: "お問い合わせ",
      getAdvisory: "アドバイザリー",
    },
    hero: {
      eyebrow: "産業インテリジェンス · カンボジア",
      h1a: "カンボジアで",
      h1b: "工業用地を",
      h1c: "開発するには",
      h1d: "何が必要か？",
      sub: "9段階 · 110以上の拠点をマッピング · 5億ドル以上の完成プロジェクトで構築した無料プラットフォーム",
      cta1: "地図を探索",
      cta2: "プラットフォーム概要",
      tags: ["9段階GIDF", "110以上の拠点", "無料アクセス", "CDC · EDC · MPWTデータ"],
    },
    gidf: {
      eyebrow: "フレームワーク · GIDF",
      title1: "GentryLab産業",
      title2: "開発フレームワーク",
      sub: "各ステージをクリックして、カンボジア現場の実態を確認",
      hintOpen: "▼ カンボジア情報",
      hintClose: "▲ 閉じる",
      labelStat: "重要データ",
      labelProcess: "実際に起きていること",
      labelImplication: "投資家への影響",
    },
    mapSection: {
      eyebrow: "無料インテリジェンスプラットフォーム",
      title1: "すべてのSEZ、回廊",
      title2: "リスクゾーン — 地図化",
      desc: "110以上の工業拠点、9つの開発回廊、EDC変電所データ、洪水リスクゾーン、労働力データをレイヤーで提供 — すべて無料",
      cta: "地図を開く",
      liveBadge: "● ライブインテリジェンス · カンボジア",
      layersBadge: "6レイヤー有効",
      corridorLabel: "9回廊 · 110以上の拠点",
      launchCta: "インタラクティブ地図を起動 →",
      stats: [
        { n: "110+", label: "工業拠点" },
        { n: "9",    label: "開発回廊" },
        { n: "6",    label: "データレイヤー" },
        { n: "無料", label: "常時"     },
      ],
    },
    map: {
      layersBtn: "レイヤー",
      searchPlaceholder: "Googleマップリンクまたは地名を貼り付け…",
      go: "検索",
      yourLocation: "★ あなたの位置",
      noResults: "カンボジアで結果が見つかりません",
      badUrl: "URLから座標を抽出できません",
      layerControl: "レイヤーコントロール",
      searchSite: "拠点または州を検索…",
      disclaimer: "データは参考用 · 投資判断前に確認してください",
      advisory: "GentryLabアドバイザリー",
    },
    contact: {
      eyebrow: "お問い合わせ",
      headline1: "工業",
      headline2: "拠点を",
      headlineAccent: "確保する。",
      body: "カンボジアに進出するメーカーおよびファンドへの直接アドバイザリー：フィージビリティスタディ、テクニカルデューデリジェンス、EPCオーナーズレプレゼンタティブ",
      officeLabel: "プノンペンオフィス",
      contactLabel: "連絡先",
      emailBtn: "主席アドバイザーにメール",
    },
    footer: { dashboard: "ダッシュボード" },
    stageTitles: [
      "サイト選定", "土地デューデリジェンス", "マスタープランニング",
      "ユーティリティ戦略", "許認可ナビゲーション", "工場設計",
      "EPC予算策定", "デリバリー", "オペレーション",
    ],
    stageStats: [
      "CDC事前承認ゾーン3か所 — 工業用地政策のない州30以上",
      "カンボジアの工業用地でLMAPハードタイトルを持つのは30%のみ",
      "緑地15%が義務 — CDCへの初回申請の60%が未達",
      "EDC工業電気料金：$0.12–$0.18/kWh — 新規変電所：8–24か月",
      "9省庁の個別承認 — 順序が重要、ほとんどの投資家が間違える",
      "工業建設コスト：$280–$420/m² — 仕様ミスで改修費+40%以上",
      "カンボジアの工業建設平均超過：23% — 80%はユーティリティの想定外コスト",
      "6–10月雨季：施工ペース35–45%低下",
      "SEZ通関：当日 vs 区域外3–5日",
    ],
    stageProcess: [
      "12基準で州評価：EDC余力・洪水リスク・NRアクセス・労働力・権原明確性・CDCカバレッジ。GentryLabが3拠点に絞り込み",
      "土地省ハードタイトル調査、地籍局担保確認、最低2回の所有権チェーン確認、ODC洪水履歴",
      "CDCはQIP登録前にマスタープラン提出を要求。緑地バッファ・消防道路(6m以上)・内部道路網・ユーティリティ接続点・排水処理区域を明示",
      "負荷計算→EDC可行性→変電所容量→専用線vs共用フィーダー→MOWRAM取水許可→MIME Class B排水",
      "順序：MoE ECC→MIH→CDC QIP→MoLVT→消防→建築許可→EDC→水道→税関(SEZ)。順序誤り=やり直し",
      "ASEAN工業規格適用。縫製/軽工業はスチールポータルフレーム、医薬/食品はRC造。雨季屋根荷重≥1.5kN/m²、物流はFM2床",
      "数量積算書→3社見積(国際・地域・現地)→ユーティリティ工事予備費→消費税・登録印紙・専門家費用",
      "動員→整地→基礎(雨季クリティカルパス)→躯体→外装→MEP→仕上げ→ユーティリティ接続→試運転→引渡し",
      "施設管理：MEP保守・セキュリティ・MIME廃棄物監査(四半期)・EDC電力照合・消防認定(年次)・MoLVT労働監査準備",
    ],
    stageImplication: [
      "回廊分析を省いた投資家は生産開始まで平均14か月遅延。拠点選択は20年間のエネルギーコストを固定する",
      "ソフトタイトルの土地は開発途中で2–3年ブロックされる可能性。権原リスクは外資工業プロジェクト停滞の第1位原因",
      "QIPステータスで最大9年法人税免除+輸入関税免除。マスタープラン却下は3–6か月と全面改訂費用",
      "州間の電力コスト差：$0.04/kWh。3MW需要で年間$10.5万の差。ユーティリティ戦略の失敗は20年のコストペナルティ",
      "正しく行えば8–11か月。間違えれば18–30か月。許認可の順序はGentryLabの最高付加価値サービス",
      "仕様不足の工場は建て直しより改修費が高い。GentryLabは60以上の竣工建物をベンチマーク — 現地見積比12–18%節約",
      "ベンチマーク済みプロジェクトは最終コストを平均8%下回る vs 未ベンチマークは23%超過",
      "乾季(11–5月)の基礎工事窓を逃したプロジェクトは通常6か月遅延",
      "SEZ事業者はゾーン内で通関処理。輸出製造業者は輸送サイクルごとに3–5日節約",
    ],
  },
} as const;

/* ── Deep-get helper ─────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

/* ── Public API ──────────────────────────────────────────── */
export function getLang(): LangCode {
  try { return (localStorage.getItem("tgl_lang") as LangCode) || "en"; } catch { return "en"; }
}

export function setLang(code: LangCode) {
  try { localStorage.setItem("tgl_lang", code); } catch { /* */ }
  window.dispatchEvent(new CustomEvent("tgl-lang-changed", { detail: code }));
}

/** Translate a dot-path key for the given lang (falls back to "en"). */
export function translate(lang: LangCode, key: string): string {
  const val = deepGet(T[lang], key) ?? deepGet(T["en"], key) ?? key;
  return typeof val === "string" ? val : key;
}

/** Translate a dot-path that resolves to a string array. */
export function translateArr(lang: LangCode, key: string): string[] {
  const val = deepGet(T[lang], key) ?? deepGet(T["en"], key) ?? [];
  return Array.isArray(val) ? val : [];
}

/** Translate a dot-path that resolves to an array of objects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function translateObjArr(lang: LangCode, key: string): any[] {
  const val = deepGet(T[lang], key) ?? deepGet(T["en"], key) ?? [];
  return Array.isArray(val) ? val : [];
}

/* ── React hook ──────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";

export function useLang() {
  const [lang, setLangState] = useState<LangCode>(getLang);

  useEffect(() => {
    const handler = (e: Event) => setLangState((e as CustomEvent<LangCode>).detail);
    window.addEventListener("tgl-lang-changed", handler);
    return () => window.removeEventListener("tgl-lang-changed", handler);
  }, []);

  const t  = useCallback((key: string) => translate(lang, key), [lang]);
  const ta = useCallback((key: string) => translateArr(lang, key), [lang]);
  const to = useCallback((key: string) => translateObjArr(lang, key), [lang]);

  return { lang, t, ta, to };
}
