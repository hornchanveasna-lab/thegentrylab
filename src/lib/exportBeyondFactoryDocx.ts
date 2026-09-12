import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from "docx";
import aerialOverview from "@/assets/research/beyond-the-factory/aerial-overview.jpg";

const ORANGE = "FF5100";
const DARK = "1A1A1A";
const MUTED = "666666";

/** Fetches a bundled image asset as raw bytes for embedding via ImageRun.
 *  `src` is a Vite-resolved asset URL (works both in dev and the built site). */
async function loadImageBytes(src: string): Promise<Uint8Array> {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function title(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 44, color: DARK })],
    spacing: { after: 120 },
  });
}

function heading(text: string, kicker?: string) {
  return [
    ...(kicker
      ? [new Paragraph({
          children: [new TextRun({ text: kicker, bold: true, size: 16, color: MUTED })],
          spacing: { before: 320, after: 40 },
        })]
      : []),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: kicker ? 0 : 320, after: 160 },
      children: [new TextRun({ text, bold: true, color: DARK, size: 28 })],
    }),
  ];
}

function body(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text, bold: opts.bold, color: opts.bold ? DARK : MUTED, size: opts.size ?? 22 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: `•  ${text}`, color: MUTED, size: 22 })],
  });
}

function subheading(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 20, color: ORANGE })],
  });
}

function bulletGroup(name: string, items: string[]) {
  return [subheading(name), ...items.map(bullet)];
}

export async function generateBeyondFactoryDocx() {
  const heroBytes = await loadImageBytes(aerialOverview);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: "THE GENTRY LAB — INDUSTRIAL INSIGHT 01 | 2026", bold: true, color: ORANGE, size: 20 })],
            spacing: { after: 80 },
          }),
          title("Beyond the Factory"),
          new Paragraph({
            children: [new TextRun({ text: "What the Next Generation of Manufacturing Means for Cambodia", italics: true, size: 26, color: DARK })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "A Practical Perspective from Sihanoukville & ISI SEZ", color: MUTED, size: 22 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "People | Places | Possibilities", bold: true, size: 16, color: MUTED })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new ImageRun({ type: "jpg", data: heroBytes, transformation: { width: 600, height: 337 } })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "ISI SEZ, Sihanoukville — factory and warehouse buildings under construction, 2026", italics: true, size: 15, color: MUTED })],
            spacing: { after: 300 },
          }),

          ...heading("Manufacturing is changing. Are we ready for what comes with it?", "01 · FROM THE GROUND"),
          body("Over the past decade, I have had the opportunity to work practically across industrial projects in Cambodia — from factory planning, engineering and construction to infrastructure, cost, utilities and project delivery."),
          body("Looking at the scale of industrial development happening today, I believe we are entering another important stage."),
          body("The story is no longer simply about bringing more factories into Cambodia."),
          body("The question is becoming: What kind of manufacturing do we want to attract, and what must Cambodia be ready for when it arrives?", { bold: true }),
          body("This became particularly clear to me while looking at the development taking shape at ISI SEZ in Sihanoukville."),
          body("From the air, we see large factory buildings, internal roads, infrastructure and land being transformed. But what interests me is not only what has already been constructed. It is what can grow around it."),
          body("A major manufacturing investment does not exist by itself. It requires power. It consumes and manages water. It needs roads, ports and logistics. It creates demand for workers and technical skills. It brings suppliers, maintenance services, engineering, construction, transportation and supporting businesses."),
          body("And when enough of these activities begin to connect with each other, we are no longer talking about individual factories. We are talking about an industrial ecosystem. That is the opportunity I believe Cambodia should be preparing for."),

          ...heading("Roadboss Tire Cambodia — More Than a Factory", "02 · A NEW SCALE OF MANUFACTURING"),
          body("Roadboss Tire's planned Cambodia operation provides an interesting example of the scale of manufacturing investment now emerging in the country."),
          body("According to the company's January 2026 introduction, its Cambodia operation is located within ISI SEZ in Sihanoukville Province and covers more than 2,000 mu of land."),
          body("The company indicates planned annual production capacity of 15 million PCR tires and 2.6 million TBR tires.", { bold: true }),
          body("The operation is expected to employ more than 2,000 people, while its products are positioned for international markets spanning more than 170 countries and regions."),
          body("This is significant not simply because of the size of the factory. It is significant because of the type of manufacturing system being introduced."),
          body("The company describes a manufacturing platform incorporating industrial internet, big data, 5G, IoT, artificial intelligence, automated logistics and digital production-management systems."),
          body("Its equipment strategy combines international and Chinese manufacturing technology, including automated production equipment, AGVs, automated warehousing and quality-control systems."),
          body("This represents a different level of industrial requirement. A factory of this nature cannot depend only on four walls and a roof. It depends on the ecosystem surrounding it."),

          ...heading("From Port City to Industrial Gateway", "03 · WHY SIHANOUKVILLE MATTERS"),
          body("Sihanoukville has a strategic advantage that very few locations in Cambodia can replicate. The port."),
          body("For export-oriented manufacturing, logistics is one of the most important components of competitiveness. Raw materials need to arrive. Equipment needs to be imported. Finished products need to reach international markets."),
          body("Every additional movement, delay or logistics constraint eventually becomes part of the manufacturer's cost. This makes the relationship between industrial development and port infrastructure particularly important."),
          body("For Sihanoukville, the opportunity is therefore bigger than simply developing more industrial land. The long-term opportunity is to create a connected manufacturing and logistics ecosystem around:"),
          body("Port → Expressway → Industrial Zones → Utilities → Manufacturing → Suppliers → Global Markets", { bold: true }),
          body("When these elements work together, location becomes a competitive advantage. But infrastructure alone does not automatically create an industrial cluster. The surrounding development environment must be ready as well."),

          ...heading("One Factory Can Create Many Other Opportunities", "04 · BEYOND THE FACTORY"),
          body("When we look at a large manufacturing investment, it is easy to focus on the investment value or number of jobs. But the economic impact can extend much further."),
          body("Consider a tire factory. The factory itself requires raw materials, machinery, energy, water, logistics and labor. Around that factory, another layer of businesses can develop."),
          ...bulletGroup("Raw Materials", ["Rubber", "Steel reinforcement", "Carbon black", "Chemicals", "Packaging materials"]),
          ...bulletGroup("Industrial Services", ["Engineering", "Equipment maintenance", "Automation", "Testing and inspection", "Environmental services"]),
          ...bulletGroup("Logistics", ["Trucking", "Warehousing", "Container handling", "Freight forwarding", "Customs services"]),
          ...bulletGroup("Construction & Infrastructure", ["Factory expansion", "Warehouses", "Utility systems", "Roads and drainage", "Worker facilities"]),
          ...bulletGroup("People", ["Engineers", "Technicians", "Machine operators", "Logistics specialists", "Maintenance teams", "Management professionals"]),
          body("This is where the real long-term value of industrial development starts to appear.", { bold: true }),
          body("Factory → Suppliers → Services → Skills → Infrastructure → Industrial Cluster", { bold: true }),
          body("The objective should therefore not only be attracting the anchor manufacturer. Cambodia should think about how to capture more of the value created around that manufacturer."),

          ...heading("The Bigger Opportunity for Cambodia", "05 · FROM ASSEMBLY TO INDUSTRIAL CAPABILITY"),
          body("For many years, Cambodia's manufacturing story has been strongly associated with labor-intensive production. That has played an important role in Cambodia's development. But the next stage can go further."),
          body("Modern manufacturing investment can introduce: Automation, Digital manufacturing, Advanced production equipment, International quality systems, Technical skills, Supply-chain management, Environmental standards, Engineering capability."),
          body("Roadboss describes its Cambodia facility as incorporating digital production management, intelligent logistics, AI-supported quality inspection and automated manufacturing systems."),
          body("This matters. Because technology does not only enter Cambodia through machines. Knowledge comes with it. Workers learn. Engineers gain experience. Local suppliers improve. Service companies develop new capabilities."),
          body("Over time, these capabilities can transfer into other industries. This is how industrial development can gradually move from Made in Cambodia toward Industrial Capability in Cambodia.", { bold: true }),
          body("That distinction will become increasingly important over the next decade."),

          ...heading("Attracting Investment Is Only the Beginning", "06 · WHAT CAMBODIA SHOULD BE READY FOR"),
          body("From my practical experience working on industrial developments, one lesson continues to become clearer: getting the investor interested is only the first step.", { bold: true }),
          body("The real test begins when the project needs to be implemented. A manufacturer may ask: Can I buy this land? But the development team needs to ask many more questions."),
          ...bulletGroup("Power", ["How much capacity does the factory require?", "Is that capacity available today?", "If not, how long will an upgrade take?", "What redundancy is required?", "How will future expansion be supported?"]),
          ...bulletGroup("Water", ["What is the daily industrial demand?", "Where will the water come from?", "Is storage required?", "What happens during peak demand?"]),
          ...bulletGroup("Wastewater", ["What type of effluent will the production process generate?", "Can the industrial park treatment system handle it?", "Is pretreatment required?", "What environmental standards need to be achieved?"]),
          ...bulletGroup("Logistics", ["How far is the port?", "Can the roads handle the required truck movements?", "Is container movement efficient?", "Where will trucks wait?", "How will raw materials and finished goods flow through the site?"]),
          ...bulletGroup("People", ["Where will thousands of workers come from?", "How will they travel to work?", "Where will they live?", "Are the technical skills available locally?", "What training will be required?"]),
          ...bulletGroup("Land", ["Is the land legally ready?", "Is the elevation appropriate?", "What is the flood risk?", "What soil conditions should be expected?", "Is there sufficient land for future expansion?"]),
          ...bulletGroup("Development Process", ["How quickly can approvals move?", "Are environmental, construction, fire and operational requirements understood early?", "Can design, permits, procurement and construction move together without creating unnecessary project risk?"]),
          body("These questions are not secondary issues. For industrial investors, they directly affect: CAPEX. Schedule. Operational risk. And ultimately: Investment confidence.", { bold: true }),

          ...heading("How Much Value Can Stay in Cambodia?", "07 · THE LOCAL SUPPLY CHAIN OPPORTUNITY"),
          body("This may be one of the most important questions. When a large manufacturer enters Cambodia, how much of its economic activity can eventually be supported locally?"),
          body("Roadboss identifies local natural rubber as one area where its Cambodian operation can contribute to greater integration between agriculture and industry. That is an important example."),
          body("Cambodia already produces raw materials. But greater value can be created when those materials connect with manufacturing, processing, engineering and export industries inside the country."),
          body("The same thinking applies beyond rubber. Future industrial policy and private-sector development should increasingly ask:"),
          bullet("What can Cambodia supply locally?"),
          bullet("What are we currently importing that could eventually be produced here?"),
          bullet("What supporting industries could locate close to major manufacturers?"),
          bullet("What capabilities do Cambodian companies need to meet international supplier standards?"),
          body("An anchor factory can therefore become more than a tenant. It can become the beginning of an industrial cluster."),

          ...heading("Industrial Development is Usually Discussed in Terms of Land, Roads and Electricity", "08 · PEOPLE MAY BECOME THE MOST IMPORTANT INFRASTRUCTURE"),
          body("But as manufacturing becomes more sophisticated, another type of infrastructure becomes increasingly important: Human capability.", { bold: true }),
          body("Modern factories require more than general labor. They require: Technicians, Automation specialists, Electrical engineers, Mechanical engineers, Production engineers, Quality specialists, Maintenance teams, Environmental professionals, Supply-chain specialists, Digital-system operators, Managers."),
          body("Roadboss indicates that its operation is expected to create thousands of local employment opportunities and includes cooperation around workforce skills development."),
          body("For Cambodia, this should be viewed as a long-term opportunity. The question is not only: How many jobs will the factory create? The better question is: What new skills will Cambodia gain because the factory is here?", { bold: true }),
          body("Industrial parks, manufacturers, universities, technical institutes and government agencies have an opportunity to work much more closely around this issue. The industrial workforce we prepare today will influence the industries Cambodia can attract tomorrow."),

          ...heading("Growth and Sustainability Need to Move Together", "09 · GREEN INDUSTRIAL DEVELOPMENT"),
          body("Industrial growth creates economic value. But it also creates significant demands on energy, water, land and the environment. These issues become more important as industrial developments increase in scale."),
          body("Roadboss identifies green manufacturing, resource efficiency, responsible sourcing and wastewater management as part of its development approach."),
          body("Future industrial competitiveness will increasingly depend on more than land price and labor cost. Investors will also consider: Energy efficiency, Renewable energy, Water security, Wastewater treatment, Waste management, Carbon performance, Supply-chain sustainability, Environmental compliance."),
          body("Industrial parks therefore have an opportunity to evolve from simply providing serviced land toward providing a more complete sustainable industrial platform. This can include shared infrastructure and services that individual factories would otherwise need to develop independently."),
          body("Done well, sustainability becomes more than compliance. It becomes part of industrial competitiveness."),

          ...heading("No Single Organization Can Build an Industrial Ecosystem Alone", "10 · INDUSTRIAL DEVELOPMENT NEEDS PARTNERSHIP"),
          body("During this development journey, I have also had the opportunity to engage with provincial leadership in Sihanoukville. For me, these interactions reinforce an important point.", {}),
          body("Government creates the enabling environment. Developers prepare land and infrastructure. Manufacturers bring investment, technology and global markets. Financial institutions provide capital. Educational institutions develop people. Local companies build supporting industries. Engineers and contractors turn plans into physical assets. Logistics providers connect production to markets."),
          body("When these pieces work separately, development becomes difficult. When they work together, industrial growth can accelerate."),
          body("This is why collaboration between Government + Developers + Investors + Industry + Education + Infrastructure Providers will become increasingly important.", { bold: true }),
          body("The objective should not simply be approving more factories. The objective should be creating an environment where good manufacturers can enter Cambodia, establish successfully, expand confidently and remain competitive for decades."),

          ...heading("What Could Come Next?", "11 · FROM FACTORY TO CLUSTER"),
          body("Looking at today's factory development, I often think about what the same location could look like ten years from now."),
          body("An anchor manufacturer arrives. Then logistics providers expand. Suppliers begin locating nearby. Workers and technical talent concentrate around the area. Training institutions respond to industry demand. Supporting factories appear. Warehouses and distribution facilities grow. Utilities expand. Infrastructure improves."),
          body("Eventually, what started as one investment becomes a cluster."),
          body("This is how we should think about the future value of major industrial investments. Not: How much factory area are we building today? But: What industrial ecosystem could grow around this investment tomorrow?", { bold: true }),
          body("For Sihanoukville, the combination of port access, logistics infrastructure, industrial land and increasing manufacturing activity creates an interesting foundation. The opportunity is significant. But realizing it will require deliberate planning."),

          ...heading("Cambodia's Next Industrial Question", "12 · THE GENTRY LAB VIEW"),
          body("Cambodia does not only need more factories. Cambodia needs to become increasingly capable of supporting better factories.", { bold: true }),
          body("Factories with more technology. Factories connected to global supply chains. Factories creating stronger local supplier networks. Factories developing technical skills. Factories operating with higher environmental standards. Factories that remain and expand for the long term."),
          body("Land availability alone is not enough. Low labor cost alone is not enough. Investment incentives alone are not enough."),
          body("The next generation of industrial competitiveness will increasingly depend on the complete development ecosystem: Infrastructure readiness, Reliable utilities, Efficient logistics, Development certainty, Skilled people, Local supply chains, Environmental capability, Expansion potential, and, importantly, the ability to execute."),
          body("From what I have witnessed working practically across industrial development and project delivery, the opportunity for Cambodia is real. But the value will not come automatically. We need to prepare for it."),
          body("The factories being built today could become the foundation of much larger industrial ecosystems tomorrow."),
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [new TextRun({ text: "Are we preparing only for the next factory — or for the next generation of Cambodian industry?", bold: true, size: 24, color: ORANGE })],
          }),

          ...heading("About The Gentry Lab"),
          body("The Gentry Lab explores the intersection between industrial investment, development strategy and practical project execution in Cambodia."),
          body("Our work looks beyond individual buildings to understand the complete industrial development journey:"),
          body("Land → Infrastructure → Utilities → Permits → Factory → Operation → Expansion", { bold: true }),
          body("Through research, practical frameworks, case studies and industry perspectives, The Gentry Lab aims to bridge the gap between investment ambition and development reality."),
          body("People | Places | Possibilities — The Gentry Lab, Cambodia Industrial Development Intelligence & Advisory"),

          ...heading("Case Reference"),
          body("This Industrial Insight uses Roadboss Tire (Cambodia) as a case perspective based on company information provided in its January 2026 corporate introduction."),
          body("The company describes its Cambodia operation as being located at ISI SEZ in Sihanoukville Province, with more than 2,000 mu of land, more than 2,000 employees, planned annual production capacity of 15 million PCR and 2.6 million TBR tires, international market coverage and an increasingly digital and automated manufacturing platform."),
          body("The company materials also identify green manufacturing, wastewater management, local natural-rubber supply-chain development, employment and skills development as components of its Cambodia strategy."),
          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: "Source: Roadboss Tire (Cambodia) Company Introduction, January 2026.", italics: true, size: 16, color: MUTED })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Beyond-the-Factory-The-Gentry-Lab.docx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
