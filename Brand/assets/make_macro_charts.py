import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

BLACK = "#0A0A0B"
ACCENT = "#FF5100"
ACCENT_DEEP = "#CC3300"
MUTED = "#71717A"
STONE = "#E7E5E4"
BLUE = "#1A5C9E"
GREEN = "#217A4B"
PURPLE = "#7B3FA0"
GOLD = "#B86E00"
BG = "#F5F4F0"

plt.rcParams["font.family"] = "DejaVu Sans"

# ---- Chart 1: US tariff comparison, apparel exporters, as of late July 2026 ----
fig, ax = plt.subplots(figsize=(7.5, 4.2), dpi=200)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

countries = ["Cambodia", "Bangladesh", "Vietnam"]
rates = [19, 25.6, 28.1]
colors = [ACCENT_DEEP, GOLD, BLUE]

bars = ax.barh(countries, rates, color=colors, height=0.55, zorder=3)
for bar, rate in zip(bars, rates):
    ax.text(bar.get_width() + 0.6, bar.get_y() + bar.get_height() / 2, f"{rate}%",
            va="center", ha="left", fontsize=15, fontweight="bold", color=BLACK)

ax.set_xlim(0, 34)
ax.invert_yaxis()
ax.set_xlabel("Effective U.S. tariff rate on apparel exports (%)", fontsize=10, color=MUTED)
ax.tick_params(axis="y", labelsize=13, labelcolor=BLACK, length=0)
ax.tick_params(axis="x", labelsize=9, labelcolor=MUTED)
for spine in ["top", "right", "left"]:
    ax.spines[spine].set_visible(False)
ax.spines["bottom"].set_color(STONE)
ax.grid(axis="x", color=STONE, linewidth=0.8, zorder=0)
ax.set_title("U.S. TARIFF EXPOSURE — APPAREL EXPORTERS, LATE JULY 2026", fontsize=12,
             fontweight="bold", color=BLACK, loc="left", pad=14)
ax.text(0, -0.85, "Cambodia capped near 19% pending trade-investigation outcome · Bangladesh 25.6% · Vietnam 28.1%",
        fontsize=8, color=MUTED, transform=ax.get_xaxis_transform())
plt.tight_layout()
plt.savefig("chart-tariff-comparison.png", facecolor=BG, bbox_inches="tight")
plt.close()

# ---- Chart 2: GDP growth trajectory 2025-2027 ----
fig, ax = plt.subplots(figsize=(7.5, 4.2), dpi=200)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

years = ["2025\n(IMF est.)", "2026f\n(World Bank)", "2027f\n(World Bank)"]
vals = [4.8, 3.9, 5.1]
colors2 = [MUTED, ACCENT_DEEP, GREEN]
bars = ax.bar(years, vals, color=colors2, width=0.5, zorder=3)
for bar, v in zip(bars, vals):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.12, f"{v}%",
            ha="center", va="bottom", fontsize=15, fontweight="bold", color=BLACK)

ax.set_ylim(0, 6.2)
ax.set_ylabel("Real GDP growth (%)", fontsize=10, color=MUTED)
ax.tick_params(axis="x", labelsize=11, labelcolor=BLACK, length=0)
ax.tick_params(axis="y", labelsize=9, labelcolor=MUTED)
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
ax.spines["left"].set_color(STONE)
ax.spines["bottom"].set_color(STONE)
ax.grid(axis="y", color=STONE, linewidth=0.8, zorder=0)
ax.set_title("CAMBODIA GDP GROWTH — 2026 SOFT PATCH, 2027 REBOUND", fontsize=12,
             fontweight="bold", color=BLACK, loc="left", pad=14)
plt.tight_layout()
plt.savefig("chart-gdp-growth.png", facecolor=BG, bbox_inches="tight")
plt.close()

print("charts written")
