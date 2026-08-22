import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np

ORANGE = "#FF5100"
ORANGE_DEEP = "#CC3300"
BLACK = "#111110"
MUTED = "#71717A"
GRID = "#E7E5E4"
BLUE = "#1A5C9E"

plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["text.color"] = BLACK
plt.rcParams["axes.edgecolor"] = GRID

# ── 1. Infrastructure Readiness — horizontal bar chart ──────────────────
fig, ax = plt.subplots(figsize=(7.2, 3.6), dpi=300)
labels = ["Power (Grid Feed)", "Water / Wastewater", "Road Access", "Land Tenure", "Permit Status"][::-1]
values = [92, 68, 85, 74, 60][::-1]
bars = ax.barh(labels, values, height=0.55, color=ORANGE, zorder=3)
ax.set_xlim(0, 100)
ax.set_xticks([0, 25, 50, 75, 100])
ax.xaxis.grid(True, color=GRID, linewidth=1, zorder=0)
ax.set_axisbelow(True)
for spine in ["top", "right", "left"]:
    ax.spines[spine].set_visible(False)
ax.spines["bottom"].set_color(GRID)
ax.tick_params(axis="y", length=0, labelsize=11, colors=BLACK)
ax.tick_params(axis="x", length=0, labelsize=9, colors=MUTED)
for bar, v in zip(bars, values):
    ax.text(v + 2, bar.get_y() + bar.get_height()/2, f"{v}", va="center", ha="left",
             fontsize=11, fontweight="bold", color=ORANGE_DEEP)
ax.set_title("INFRASTRUCTURE READINESS INDEX", loc="left", fontsize=12, fontweight="bold",
             color=BLACK, pad=14)
plt.tight_layout()
plt.savefig("chart-infra-readiness.png", transparent=True)
plt.close()

# ── 2. Score donut / gauge ───────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(2.6, 2.6), dpi=300, subplot_kw={"aspect": "equal"})
score = 88
theta = np.linspace(90, 90 - 360*(score/100), 200)
theta_full = np.linspace(0, 360, 200)
def ring(ax, start, end, color, lw):
    t = np.linspace(np.radians(start), np.radians(end), 200)
    ax.plot(np.cos(t), np.sin(t), color=color, linewidth=lw, solid_capstyle="round")
ring(ax, 0, 360, "#E7E5E4", 14)
ring(ax, 90, 90 - 360*(score/100), ORANGE, 14)
ax.text(0, 0.08, f"{score}", ha="center", va="center", fontsize=34, fontweight="bold", color=BLACK)
ax.text(0, -0.28, "/ 100", ha="center", va="center", fontsize=12, color=MUTED)
ax.set_xlim(-1.3, 1.3); ax.set_ylim(-1.3, 1.3)
ax.axis("off")
plt.tight_layout()
plt.savefig("chart-score-donut.png", transparent=True)
plt.close()

# ── 3. Comparison bar chart (general report) ─────────────────────────────
fig, ax = plt.subplots(figsize=(7.2, 3.4), dpi=300)
cats = ["Option A", "Option B", "Option C"]
x = np.arange(len(cats))
w = 0.32
dimA = [72, 88, 64]
dimB = [58, 70, 91]
ax.bar(x - w/2, dimA, width=w, color=ORANGE, label="Dimension A", zorder=3)
ax.bar(x + w/2, dimB, width=w, color=BLUE, label="Dimension B", zorder=3)
ax.set_xticks(x); ax.set_xticklabels(cats, fontsize=11, color=BLACK)
ax.set_ylim(0, 100)
ax.yaxis.grid(True, color=GRID, linewidth=1, zorder=0)
ax.set_axisbelow(True)
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
ax.spines["left"].set_color(GRID); ax.spines["bottom"].set_color(GRID)
ax.tick_params(axis="y", labelsize=9, colors=MUTED, length=0)
ax.tick_params(axis="x", length=0)
ax.legend(frameon=False, fontsize=10, loc="upper center", bbox_to_anchor=(0.5, 1.16), ncol=2)
ax.set_title("COMPARATIVE INDICATOR ANALYSIS", loc="left", fontsize=12, fontweight="bold",
             color=BLACK, pad=34)
plt.tight_layout()
plt.savefig("chart-comparison.png", transparent=True)
plt.close()

# ── 4. Trend line chart (general report) ──────────────────────────────────
fig, ax = plt.subplots(figsize=(7.2, 3.2), dpi=300)
years = np.array([2021, 2022, 2023, 2024, 2025])
vals = np.array([1.2, 1.6, 1.9, 2.4, 3.1])
ax.plot(years, vals, color=ORANGE_DEEP, linewidth=3, marker="o", markersize=7,
        markerfacecolor=ORANGE, markeredgecolor="white", markeredgewidth=1.5, zorder=3)
ax.fill_between(years, vals, 0, color=ORANGE, alpha=0.08, zorder=1)
ax.set_ylim(0, max(vals)*1.25)
ax.yaxis.grid(True, color=GRID, linewidth=1, zorder=0)
ax.set_axisbelow(True)
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
ax.spines["left"].set_color(GRID); ax.spines["bottom"].set_color(GRID)
ax.tick_params(labelsize=10, colors=MUTED, length=0)
for xi, yi in zip(years, vals):
    ax.text(xi, yi + max(vals)*0.06, f"{yi}", ha="center", fontsize=10, fontweight="bold", color=ORANGE_DEEP)
ax.set_title("TREND: [METRIC NAME] ($BN)", loc="left", fontsize=12, fontweight="bold", color=BLACK, pad=14)
plt.tight_layout()
plt.savefig("chart-trend.png", transparent=True)
plt.close()

print("Charts written.")
