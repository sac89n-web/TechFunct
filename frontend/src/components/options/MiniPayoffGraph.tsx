import React, { useMemo } from 'react';
import type { PayoffPoint } from '../../types/options';

interface MiniPayoffGraphProps {
  data: PayoffPoint[];
  width?: number;
  height?: number;
}

const MiniPayoffGraph: React.FC<MiniPayoffGraphProps> = ({
  data,
  width  = 280,
  height = 80,
}) => {
  const { paths, zeroY } = useMemo(() => {
    if (!data || data.length < 2) return { paths: null, zeroY: height / 2 };

    const prices = data.map(d => d.underlyingPrice);
    const pnls   = data.map(d => d.pnL);

    const minP  = Math.min(...prices);
    const maxP  = Math.max(...prices);
    const minPnL = Math.min(...pnls);
    const maxPnL = Math.max(...pnls);
    const pnlRange = maxPnL - minPnL || 1;

    const pad = { t: 6, b: 6, l: 4, r: 4 };
    const w   = width  - pad.l - pad.r;
    const h   = height - pad.t - pad.b;

    const xScale = (p: number) => pad.l + ((p - minP) / (maxP - minP || 1)) * w;
    const yScale = (v: number) => pad.t + h - ((v - minPnL) / pnlRange) * h;

    const zeroY  = yScale(0);

    // Build two paths: profit (pnl >= 0) shaded green, loss shaded red
    let profitPath = '';
    let lossPath   = '';

    for (let i = 0; i < data.length; i++) {
      const x = xScale(data[i].underlyingPrice);
      const y = yScale(data[i].pnL);
      profitPath += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
      lossPath   += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
    }

    // Area paths (close to zero line)
    const profitArea = profitPath +
      `L${xScale(data[data.length-1].underlyingPrice).toFixed(1)},${zeroY.toFixed(1)}` +
      `L${xScale(data[0].underlyingPrice).toFixed(1)},${zeroY.toFixed(1)}Z`;

    const lossArea = lossPath +
      `L${xScale(data[data.length-1].underlyingPrice).toFixed(1)},${zeroY.toFixed(1)}` +
      `L${xScale(data[0].underlyingPrice).toFixed(1)},${zeroY.toFixed(1)}Z`;

    return { paths: { profitPath, lossPath, profitArea, lossArea, xScale, minP, maxP }, zeroY };
  }, [data, width, height]);

  if (!paths) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle"
              fill="#64748b" fontSize={10}>No payoff data</text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="clip-profit">
          <rect x={0} y={0} width={width} height={zeroY} />
        </clipPath>
        <clipPath id="clip-loss">
          <rect x={0} y={zeroY} width={width} height={height - zeroY} />
        </clipPath>
      </defs>

      {/* Zero line */}
      <line x1={0} y1={zeroY} x2={width} y2={zeroY}
            stroke="#475569" strokeWidth={1} strokeDasharray="3,3" />

      {/* Loss area (below zero) */}
      <path d={paths.lossArea} fill="rgba(239,68,68,0.15)"
            clipPath="url(#clip-loss)" />

      {/* Profit area (above zero) */}
      <path d={paths.profitArea} fill="rgba(34,197,94,0.15)"
            clipPath="url(#clip-profit)" />

      {/* Line: loss segment */}
      <path d={paths.lossPath} fill="none" stroke="#ef4444"
            strokeWidth={1.5} clipPath="url(#clip-loss)" />

      {/* Line: profit segment */}
      <path d={paths.profitPath} fill="none" stroke="#22c55e"
            strokeWidth={1.5} clipPath="url(#clip-profit)" />
    </svg>
  );
};

export default MiniPayoffGraph;
