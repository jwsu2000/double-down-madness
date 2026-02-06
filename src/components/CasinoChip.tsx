// ─── Premium Casino Chip Component ────────────────────────────────────────────
// Realistic casino chip with edge notches, inner rings, embossed text, 3D depth

import type { ChipValue } from '../engine/rules';

interface CasinoChipProps {
  value: ChipValue;
  size?: number;       // diameter in px
  interactive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

// ─── Color Schemes per Denomination ───────────────────────────────────────────

interface ChipColorScheme {
  face: string;         // main face gradient start
  faceEnd: string;      // main face gradient end
  edge: string;         // edge/notch color
  edgeAlt: string;      // alternating edge color
  ring: string;         // inner ring color
  text: string;         // denomination text color
  shadow: string;       // 3D shadow color
  highlight: string;    // top highlight
}

const CHIP_SCHEMES: Record<ChipValue, ChipColorScheme> = {
  1: {
    face: '#e8e4e0',
    faceEnd: '#cdc8c2',
    edge: '#e8e4e0',
    edgeAlt: '#4a90d9',
    ring: '#b8b3ac',
    text: '#3a3632',
    shadow: '#8a8580',
    highlight: '#ffffff',
  },
  5: {
    face: '#cc2233',
    faceEnd: '#991122',
    edge: '#cc2233',
    edgeAlt: '#ffffff',
    ring: '#ff4455',
    text: '#ffffff',
    shadow: '#661118',
    highlight: '#ff6677',
  },
  25: {
    face: '#1a8a4a',
    faceEnd: '#0e6633',
    edge: '#1a8a4a',
    edgeAlt: '#ffffff',
    ring: '#2bb866',
    text: '#ffffff',
    shadow: '#0a4422',
    highlight: '#3dcc77',
  },
  100: {
    face: '#1a1a1e',
    faceEnd: '#0d0d10',
    edge: '#1a1a1e',
    edgeAlt: '#d4a843',
    ring: '#3a3a42',
    text: '#d4a843',
    shadow: '#000000',
    highlight: '#4a4a55',
  },
  500: {
    face: '#6b2fa0',
    faceEnd: '#4a1f70',
    edge: '#6b2fa0',
    edgeAlt: '#ffffff',
    ring: '#9b55d0',
    text: '#ffffff',
    shadow: '#2d1345',
    highlight: '#b87ae0',
  },
};

// ─── Number of edge notches ───────────────────────────────────────────────────

const NOTCH_COUNT = 16;

export default function CasinoChip({
  value,
  size = 64,
  interactive = false,
  disabled = false,
  onClick,
  className = '',
}: CasinoChipProps) {
  const scheme = CHIP_SCHEMES[value];
  const r = size / 2;
  const notchWidth = 6;
  const notchDepth = size * 0.08;

  // Generate edge notch rectangles
  const notches = [];
  for (let i = 0; i < NOTCH_COUNT; i++) {
    const angle = (i * 360) / NOTCH_COUNT;
    const isAlt = i % 2 === 0;
    notches.push(
      <rect
        key={i}
        x={r - notchWidth / 2}
        y={0}
        width={notchWidth}
        height={notchDepth + 1}
        rx={1}
        fill={isAlt ? scheme.edgeAlt : scheme.edge}
        transform={`rotate(${angle} ${r} ${r})`}
      />
    );
  }

  const innerR1 = r * 0.82;
  const innerR2 = r * 0.76;
  const innerR3 = r * 0.42;

  return (
    <div
      className={`relative select-none ${interactive && !disabled ? 'cursor-pointer' : ''} ${disabled ? 'opacity-30' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={!disabled ? onClick : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
        style={{
          filter: interactive && !disabled
            ? `drop-shadow(0 3px 4px ${scheme.shadow}88)`
            : `drop-shadow(0 2px 2px ${scheme.shadow}66)`,
        }}
      >
        <defs>
          {/* Main face radial gradient */}
          <radialGradient id={`face-${value}-${size}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={scheme.highlight} stopOpacity={0.4} />
            <stop offset="30%" stopColor={scheme.face} />
            <stop offset="100%" stopColor={scheme.faceEnd} />
          </radialGradient>

          {/* Subtle texture pattern */}
          <pattern id={`tex-${value}-${size}`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="transparent" />
            <circle cx="1" cy="1" r="0.3" fill={scheme.highlight} opacity={0.06} />
            <circle cx="3" cy="3" r="0.3" fill={scheme.shadow} opacity={0.06} />
          </pattern>
        </defs>

        {/* Outer edge ring (the thick border) */}
        <circle cx={r} cy={r} r={r - 1} fill={scheme.edge} />

        {/* Edge notches */}
        {notches}

        {/* Main face circle */}
        <circle cx={r} cy={r} r={r - notchDepth} fill={`url(#face-${value}-${size})`} />

        {/* Texture overlay */}
        <circle cx={r} cy={r} r={r - notchDepth} fill={`url(#tex-${value}-${size})`} />

        {/* Outer decorative ring */}
        <circle cx={r} cy={r} r={innerR1} fill="none" stroke={scheme.ring} strokeWidth={1.2} opacity={0.5} />

        {/* Inner decorative ring */}
        <circle cx={r} cy={r} r={innerR2} fill="none" stroke={scheme.ring} strokeWidth={0.8} opacity={0.35} />

        {/* Dashed accent ring between outer and inner */}
        <circle
          cx={r} cy={r}
          r={(innerR1 + innerR2) / 2}
          fill="none"
          stroke={scheme.edgeAlt}
          strokeWidth={0.6}
          strokeDasharray="3 3"
          opacity={0.2}
        />

        {/* Center circle background */}
        <circle cx={r} cy={r} r={innerR3} fill={scheme.faceEnd} opacity={0.3} />
        <circle cx={r} cy={r} r={innerR3} fill="none" stroke={scheme.ring} strokeWidth={0.8} opacity={0.4} />

        {/* Denomination text */}
        <text
          x={r}
          y={r}
          textAnchor="middle"
          dominantBaseline="central"
          fill={scheme.text}
          fontSize={size * (value >= 100 ? 0.22 : 0.26)}
          fontWeight="bold"
          fontFamily="Georgia, serif"
          style={{ textShadow: `0 1px 1px ${scheme.shadow}44` }}
        >
          ${value}
        </text>

        {/* Top-left highlight arc for 3D illusion */}
        <path
          d={`M ${r * 0.45} ${r * 0.3} A ${r * 0.75} ${r * 0.75} 0 0 1 ${r * 1.55} ${r * 0.45}`}
          fill="none"
          stroke={scheme.highlight}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.15}
        />
      </svg>
    </div>
  );
}

// ─── Thin "stacked" chip for the balance pile ─────────────────────────────────
// Renders a chip as a thin disc seen from slight perspective

export function ChipDisc({ value, width = 40 }: { value: ChipValue; width?: number }) {
  const scheme = CHIP_SCHEMES[value];
  const height = 6;

  return (
    <svg width={width} height={height + 2} viewBox={`0 0 ${width} ${height + 2}`} className="block">
      {/* Bottom shadow edge */}
      <ellipse
        cx={width / 2}
        cy={height + 1}
        rx={width / 2}
        ry={2.5}
        fill={scheme.shadow}
        opacity={0.4}
      />
      {/* Side/thickness */}
      <rect
        x={0}
        y={2}
        width={width}
        height={height - 2}
        rx={1}
        fill={scheme.faceEnd}
      />
      {/* Notch marks on the side */}
      {[0.15, 0.35, 0.55, 0.75, 0.85].map((pct, i) => (
        <rect
          key={i}
          x={width * pct}
          y={2}
          width={2}
          height={height - 2}
          fill={scheme.edgeAlt}
          opacity={0.5}
          rx={0.5}
        />
      ))}
      {/* Top face ellipse */}
      <ellipse
        cx={width / 2}
        cy={2}
        rx={width / 2}
        ry={2.5}
        fill={scheme.face}
      />
      {/* Inner ring on top face */}
      <ellipse
        cx={width / 2}
        cy={2}
        rx={width / 2 - 4}
        ry={1.5}
        fill="none"
        stroke={scheme.ring}
        strokeWidth={0.5}
        opacity={0.5}
      />
      {/* Highlight */}
      <ellipse
        cx={width / 2 - 3}
        cy={1.5}
        rx={width / 4}
        ry={1}
        fill={scheme.highlight}
        opacity={0.15}
      />
    </svg>
  );
}
