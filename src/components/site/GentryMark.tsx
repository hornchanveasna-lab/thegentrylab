/**
 * GentryMark — the official G mark logo from TheGentryLab.svg
 * All shapes accept a single `color` prop so the mark always follows brand color.
 */
interface Props {
  color?: string;
  size?: number;        // rendered height in px (width scales proportionally)
  className?: string;
}

export function GentryMark({ color = "#ff5100", size = 32, className = "" }: Props) {
  // Original SVG canvas: 1500 × 1500, content within with a (36,19) outer translate.
  // We expose a clean viewBox trimmed to the actual mark bounds.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1500 1500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(36 19)">
        {/* ── Top horizontal bar ─────────────────────────── */}
        <rect x="143" y="2"    width="1285" height="283" fill={color} />

        {/* ── Left vertical bar ──────────────────────────── */}
        <rect x="0"   y="143"  width="287"  height="857" fill={color} />

        {/* ── Top-left circle cap ────────────────────────── */}
        <circle cx="143" cy="143" r="143" fill={color} />

        {/* ── Mid horizontal bar (crossbar of G) ─────────── */}
        <rect x="558" y="572"  width="870"  height="288" fill={color} />

        {/* ── Right vertical bar ─────────────────────────── */}
        <rect x="1141" y="572" width="287"  height="890" fill={color} />

        {/* ── Bottom horizontal bar ──────────────────────── */}
        <rect x="0"   y="1146" width="1428" height="316" fill={color} />
      </g>
    </svg>
  );
}
