import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { theme, getScoreColor } from '../../theme';

interface Props {
  score: number;    // 0-100
  maxScore?: number;
  size?: number;
  label?: string;
}

export default function ScoreGauge({ score, maxScore = 100, size = 100, label }: Props) {
  const pct = Math.min(Math.max(score / maxScore, 0), 1);
  const r = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - pct);
  const color = getScoreColor(score);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={theme.colors.border}
          strokeWidth={8}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
        {/* Score text */}
        <SvgText
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="700">
          {Math.round(score)}
        </SvgText>
      </Svg>
      {label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: {
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.semibold,
    marginTop: 2,
  },
});
