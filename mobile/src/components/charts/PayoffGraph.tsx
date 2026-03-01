import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, ClipPath, Rect } from 'react-native-svg';
import { theme } from '../../theme';
import type { PayoffPoint } from '../../types';

interface Props {
  data: PayoffPoint[];
  width?: number;
  height?: number;
}

export default function PayoffGraph({ data, width = 300, height = 120 }: Props) {
  const { pathD, zeroY } = useMemo(() => {
    if (!data || data.length < 2) return { pathD: '', zeroY: height / 2 };

    const prices = data.map(d => d.underlyingPrice);
    const pnls = data.map(d => d.pnL);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const minPnL = Math.min(...pnls);
    const maxPnL = Math.max(...pnls);
    const pad = { t: 12, b: 20, l: 8, r: 8 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;

    const scaleX = (p: number) => ((p - minP) / (maxP - minP || 1)) * w + pad.l;
    const range = maxPnL - minPnL || 1;
    const scaleY = (v: number) => pad.t + (1 - (v - minPnL) / range) * h;

    const zero = scaleY(0);
    const segments = data.map((d, i) => {
      const x = scaleX(d.underlyingPrice);
      const y = scaleY(d.pnL);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });

    return { pathD: segments.join(' '), zeroY: zero };
  }, [data, width, height]);

  if (!pathD) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id="profitClip">
          <Rect x={0} y={0} width={width} height={zeroY} />
        </ClipPath>
        <ClipPath id="lossClip">
          <Rect x={0} y={zeroY} width={width} height={height - zeroY} />
        </ClipPath>
      </Defs>

      {/* Zero line */}
      <Line
        x1={0}
        y1={zeroY}
        x2={width}
        y2={zeroY}
        stroke={theme.colors.border}
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Profit area (green) */}
      <Path d={pathD} stroke={theme.colors.success} strokeWidth={2} fill="none" clipPath="url(#profitClip)" />

      {/* Loss area (red) */}
      <Path d={pathD} stroke={theme.colors.danger} strokeWidth={2} fill="none" clipPath="url(#lossClip)" />

      {/* Axis labels */}
      <SvgText x={8} y={height - 4} fill={theme.colors.textMuted} fontSize={9}>
        ←Price Range→
      </SvgText>
    </Svg>
  );
}
