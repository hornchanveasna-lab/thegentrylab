# Weekly News Harvester — TheGentryLab

## Schedule
Every Monday 07:00 ICT (00:00 UTC)

## Mission
Find the most useful, decision-relevant Cambodia industrial news from the past 7 days across ALL sectors and write real, working entries to Supabase. Quality over quantity — only include news that would matter to a foreign manufacturer or investor making site-selection or investment decisions.

---

## Sectors to cover (search ALL of these)
1. **Garment** — new factories, brand relocations, labour policy, export quota news
2. **Electronics** — PCB plants, component factories, EV supply chain, semiconductor assembly
3. **Automotive** — EV assembly, CKD plants, Tier-1 suppliers, ASEAN auto policy
4. **Food Processing** — agro-processing, beverage plants, cold chain, food safety regulation
5. **Warehousing** — logistics hubs, dry ports, cold storage, last-mile, bonded warehouses
6. **Data Center** — colocation, cloud, carrier-neutral, edge POP, government data policy
7. **Energy** — solar, wind, hydro, grid expansion, EDC substations, PPA tenders
8. **Infrastructure** — expressways, ports, airports, rail, roads, bridges, SEZ expansion
9. **Policy** — CDC/QIP changes, EIA rules, tax incentives, trade agreements, labour law

---

## Source List — Search ALL of these

### Tier 1 — Cambodian English-language media (highest priority)
```
site:khmertimeskh.com          (Khmer Times — best English source for industrial news)
site:phnompenhpost.com         (Phnom Penh Post business section)
site:cambojanews.com           (CamboJA — investigative, labour disputes, environment)
site:businesscambodia.com      (Business Cambodia — FDI, factory news)
site:cambodiainvestment.gov.kh (CDC official investment announcements)
```

### Tier 2 — Cambodian Khmer-language media (WebFetch + translate)
```
site:freshnews.com.kh/business  (Fresh News — SEZ, FDI, industrial, Korean/Chinese investors)
site:dap-news.com               (DAP News — business and industrial)
site:postkhmer.com              (Post Khmer — business supplement)
site:thmeykhmer.com             (Thmey Thmey — investigative + business)
site:rfa.org/khmer              (RFA Khmer — independent, covers disputes and policy)
site:voacambodia.com            (VOA Cambodia — balanced coverage)
site:cnewsasia.com              (CNS Cambodia — government-adjacent, CDC press items)
```

### Tier 3 — Regional English-language media
```
site:asia.nikkei.com            (Nikkei Asia — Japanese FDI, supply chain shift coverage)
site:channelnewsasia.com        (CNA — Southeast Asia manufacturing, FDI)
site:bangkokpost.com            (Bangkok Post — ASEAN factory relocation, Thailand→Cambodia)
site:straitstimes.com           (Straits Times — Singapore investment in Cambodia)
site:reuters.com                (Reuters — major investment announcements)
site:aseanbriefing.com          (ASEAN Briefing — investment guides + news)
site:thediplomat.com            (The Diplomat — policy, geopolitics, investment context)
site:eastasiaforum.org          (East Asia Forum — China/Korea/Japan FDI analysis)
site:vir.com.vn                 (Vietnam Investment Review — supply chain shift signals)
```

### Tier 4 — Origin-country investment media
```
site:jetro.go.jp                (JETRO — Japanese FDI tracker, Cambodia section)
site:koreaherald.com            (Korea Herald — Korean manufacturers in Cambodia)
site:koreatimes.co.kr           (Korea Times — KOCHAM, KOTRA Cambodia)
site:globaltimes.cn             (Global Times — Chinese investment in Cambodia)
site:xinhuanet.com              (Xinhua — China state media, Chinese project announcements)
site:gtai.de                    (Germany Trade & Invest — German FDI)
site:boi.go.th                  (Thai BOI — Thai company Cambodia relocation)
site:china-briefing.com         (China Briefing — China supply chain, Cambodia factory)
```

### Tier 5 — Official sources (infrastructure + policy)
```
site:invest.gov.kh              (CDC QIP approvals, investor announcements)
site:sezb.gov.kh                (SEZ Board — zone performance, new tenants)
site:mih.gov.kh                 (Ministry of Industry — operating licences)
site:customs.gov.kh             (Customs — trade flow data, machinery imports)
site:adb.org/projects           (ADB Cambodia active projects)
site:projects.worldbank.org     (World Bank Cambodia portfolio)
```

---

## Search queries (run ALL of these every run)

### General Cambodia industry
```
WebSearch: Cambodia factory investment 2026 site:khmertimeskh.com OR site:phnompenhpost.com
WebSearch: Cambodia industrial project groundbreaking construction 2026
WebSearch: Cambodia SEZ special economic zone factory 2026
WebSearch: Cambodia QIP CDC approval investment 2026
WebSearch: "freshnews.com.kh" Cambodia factory investment industrial 2026
WebSearch: Cambodia garment factory 2026
WebSearch: Cambodia electronics manufacturing 2026
WebSearch: Cambodia EV automotive assembly plant 2026
WebSearch: Cambodia food processing agro industrial 2026
WebSearch: Cambodia warehouse logistics cold chain port 2026
WebSearch: Cambodia data center investment 2026
WebSearch: Cambodia energy solar wind EDC grid 2026
WebSearch: Cambodia expressway port airport infrastructure 2026
WebSearch: Cambodia labour policy minimum wage union 2026
```

### Origin-country angle (catches FDI before English Khmer media)
```
WebSearch: Cambodia Chinese investment factory 2026 site:globaltimes.cn OR site:xinhuanet.com
WebSearch: Cambodia Korean investment factory 2026 site:koreaherald.com OR site:koreatimes.co.kr
WebSearch: Cambodia Japanese factory 2026 site:asia.nikkei.com OR site:jetro.go.jp
WebSearch: Cambodia Thailand factory relocation ASEAN 2026 site:bangkokpost.com
WebSearch: Cambodia Singapore investment 2026 site:straitstimes.com OR site:channelnewsasia.com
```

### Fresh News specific (Khmer, translate content)
```
WebFetch: https://freshnews.com.kh/business
→ Scan all headlines for factory, SEZ, ដែនដីឧស្សាហកម្ម, ការវិនិយោគ, CDC, QIP
→ WebFetch each matching article URL
→ Use article content to extract: headline (translate), date, summary
```

---

## Quality filter — ONLY include if ALL of these are true:
✅ Published within the past 14 days (be generous if news is slow week)
✅ Has a real, working article URL (not a homepage, not a search page)
✅ About a specific investment, project, policy, or infrastructure development in Cambodia
✅ Relevant to at least one of the 9 sectors above
✅ Not a general economic forecast, opinion piece, or tourism news
✅ Not a duplicate of an existing Supabase news entry

---

## For each qualifying article (up to 15 per run)

Extract:
1. `id` — `n-YYYYMMDD-slug` using article publish date (e.g. `n-20260607-hyundai-kampot-sez`)
2. `headline` — exact article headline in English (translate if Khmer)
3. `source` — publication name (e.g. "Khmer Times", "Fresh News", "Nikkei Asia")
4. `date` — publish date YYYY-MM-DD
5. `sector` — best match: Garment | Electronics | Food Processing | Warehousing | Data Center | Automotive | Energy | Infrastructure | Policy
6. `province` — most specific Cambodia province, or "Nationwide" if truly national
7. `summary` — exactly 2 sentences: sentence 1 = what happened (facts, numbers), sentence 2 = why it matters for investors
8. `url` — full original article URL — MUST be a direct article link, not homepage
9. `image_url` — WebFetch the article page, extract `<meta property="og:image" content="...">` value; NULL if not found

---

## Supabase write process
**Project ID:** `mcxfukjopdnouicwacbn`
**MCP:** `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

For each article:
1. Check duplicate: `SELECT id FROM news WHERE headline ILIKE '%FIRST_5_WORDS%'`
2. Skip if found
3. Insert if new:
```sql
INSERT INTO news (id, headline, source, date, sector, province, summary, url, image_url)
VALUES (...);
```

After all inserts:
```sql
SELECT COUNT(*) FROM news;
-- If > 100: DELETE FROM news WHERE id IN (SELECT id FROM news ORDER BY date ASC LIMIT (count - 100))
```

---

## Output report
```
=== TheGentryLab News Harvester Run ===
Date: YYYY-MM-DD
Sources searched: N
Articles found: N
Quality filter passed: N
Duplicates skipped: N
New articles inserted: N
Sectors covered: [list]
Provinces covered: [list]
Languages translated: N (Khmer → English)
Supabase news table total: N rows
```
