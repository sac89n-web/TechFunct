import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { theme } from '../../theme';
import type { HeatmapItem } from '../../types';

interface Props {
  data: HeatmapItem[];
  onPress?: (item: HeatmapItem) => void;
}

const COLOR_MAP: Record<string, string> = {
  DARK_GREEN: '#065F46',
  GREEN: '#047857',
  LIGHT_GREEN: '#10B981',
  SLIGHT_GREEN: '#34D399',
  FLAT: '#334155',
  SLIGHT_RED: '#FCA5A5',
  LIGHT_RED: '#EF4444',
  RED: '#DC2626',
  DARK_RED: '#991B1B',
};

export default function HeatmapGrid({ data, onPress }: Props) {
  return (
    <FlatList
      data={data}
      numColumns={4}
      keyExtractor={item => item.symbol}
      scrollEnabled={false}
      renderItem={({ item }) => {
        const bg = COLOR_MAP[item.colorCode] ?? theme.colors.card;
        const isPositive = item.changePercent >= 0;
        return (
          <TouchableOpacity
            style={[styles.cell, { backgroundColor: bg }]}
            onPress={() => onPress?.(item)}
            activeOpacity={0.75}>
            <Text style={styles.symbol} numberOfLines={1}>
              {item.symbol}
            </Text>
            <Text style={[styles.change, { color: isPositive ? '#A7F3D0' : '#FCA5A5' }]}>
              {isPositive ? '+' : ''}
              {item.changePercent.toFixed(2)}%
            </Text>
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={styles.grid}
    />
  );
}

const styles = StyleSheet.create({
  grid: { gap: 3, padding: 2 },
  cell: {
    flex: 1,
    margin: 2,
    padding: 6,
    borderRadius: theme.radius.sm,
    minWidth: '22%',
    aspectRatio: 1.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbol: {
    color: '#fff',
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.semibold,
    textAlign: 'center',
  },
  change: {
    fontSize: 10,
    fontWeight: theme.typography.medium,
    marginTop: 2,
  },
});
