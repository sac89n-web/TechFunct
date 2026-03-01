import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { marketService } from '../api/marketService';
import { theme, getChangeColor } from '../theme';
import HeatmapGrid from '../components/charts/HeatmapGrid';
import SkeletonLoader, { SkeletonCard } from '../components/common/SkeletonLoader';
import ErrorState from '../components/common/ErrorState';
import { SignalBadge } from '../components/common/Badge';
import type { HeatmapItem, MomentumItem } from '../types';

const INDICES = ['NIFTY50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO', 'NIFTY FMCG'];

export default function MarketRadarScreen() {
  const [selectedIndex, setSelectedIndex] = useState('NIFTY50');
  const [activeTab, setActiveTab] = useState<'heatmap' | 'momentum'>('heatmap');
  const [refreshing, setRefreshing] = useState(false);

  const heatmapQuery = useQuery({
    queryKey: ['heatmap', selectedIndex],
    queryFn: () => marketService.getHeatmap(selectedIndex),
    refetchInterval: 60_000,
  });

  const momentumQuery = useQuery({
    queryKey: ['momentum', selectedIndex],
    queryFn: () => marketService.getMomentum(selectedIndex),
    refetchInterval: 30_000,
  });

  const breadthQuery = useQuery({
    queryKey: ['breadth', selectedIndex],
    queryFn: () => marketService.getBreadth(selectedIndex),
    refetchInterval: 60_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      heatmapQuery.refetch(),
      momentumQuery.refetch(),
      breadthQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Index selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indexBar}>
        {INDICES.map(idx => (
          <TouchableOpacity
            key={idx}
            style={[styles.indexChip, selectedIndex === idx && styles.indexChipActive]}
            onPress={() => setSelectedIndex(idx)}>
            <Text
              style={[
                styles.indexChipText,
                selectedIndex === idx && styles.indexChipTextActive,
              ]}>
              {idx.replace('NIFTY ', '')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab selector */}
      <View style={styles.tabs}>
        {(['heatmap', 'momentum'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'heatmap' ? 'Heatmap' : 'Momentum'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* Breadth bar */}
        {breadthQuery.data && (
          <View style={styles.breadthStrip}>
            <View style={styles.breadthItem}>
              <Text style={[styles.breadthVal, { color: theme.colors.success }]}>
                ▲ {breadthQuery.data.advances}
              </Text>
            </View>
            <View style={styles.breadthItem}>
              <Text style={[styles.breadthVal, { color: theme.colors.danger }]}>
                ▼ {breadthQuery.data.declines}
              </Text>
            </View>
            <View style={styles.breadthItem}>
              <Text style={[styles.breadthVal, { color: theme.colors.textMuted }]}>
                — {breadthQuery.data.unchanged}
              </Text>
            </View>
            <View style={styles.breadthItem}>
              <Text style={[styles.breadthVal,
                { color: breadthQuery.data.advanceDeclineRatio > 1 ? theme.colors.success : theme.colors.danger }]}>
                A/D {breadthQuery.data.advanceDeclineRatio.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Main content */}
        {activeTab === 'heatmap' ? (
          <View style={styles.heatmapContainer}>
            {heatmapQuery.isLoading ? (
              <View style={{ padding: theme.spacing.lg }}>
                {[...Array(5)].map((_, i) => (
                  <SkeletonLoader key={i} height={40} style={{ marginBottom: 6 }} />
                ))}
              </View>
            ) : heatmapQuery.error ? (
              <ErrorState message="Failed to load heatmap" onRetry={heatmapQuery.refetch} />
            ) : (
              <HeatmapGrid
                data={heatmapQuery.data ?? []}
                onPress={item => {
                  // navigate to stock analyzer — future
                }}
              />
            )}
          </View>
        ) : (
          <View style={{ padding: theme.spacing.md }}>
            {momentumQuery.isLoading ? (
              [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)
            ) : momentumQuery.error ? (
              <ErrorState message="Failed to load momentum" onRetry={momentumQuery.refetch} />
            ) : (
              (momentumQuery.data ?? []).map(item => (
                <MomentumRow key={item.symbol} item={item} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MomentumRow({ item }: { item: MomentumItem }) {
  const changeColor = getChangeColor(item.changePercent);
  const scorePct = item.momentumScore;
  const barColor =
    scorePct >= 65 ? theme.colors.success : scorePct >= 40 ? theme.colors.warning : theme.colors.danger;

  return (
    <View style={styles.momentumRow}>
      <View style={styles.momentumLeft}>
        <Text style={styles.momentumSymbol}>{item.symbol}</Text>
        <View style={styles.momentumBar}>
          <View
            style={[
              styles.momentumFill,
              { width: `${scorePct}%` as any, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>
      <View style={styles.momentumMid}>
        <Text style={styles.momentumPrice}>
          ₹{item.ltp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={[styles.momentumChange, { color: changeColor }]}>
          {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
        </Text>
      </View>
      <View style={styles.momentumRight}>
        <SignalBadge signal={item.signal} />
        <Text style={[styles.momentumScore, { color: barColor }]}>
          {Math.round(scorePct)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  indexBar: {
    flexGrow: 0,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  indexChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    backgroundColor: theme.colors.card,
  },
  indexChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  indexChipText: { color: theme.colors.textSecondary, fontSize: theme.typography.sm, fontWeight: '500' },
  indexChipTextActive: { color: '#fff', fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontSize: theme.typography.base },
  tabTextActive: { color: theme.colors.primary, fontWeight: '700' },
  breadthStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    justifyContent: 'space-around',
  },
  breadthItem: {},
  breadthVal: { fontSize: theme.typography.sm, fontWeight: '600' },
  heatmapContainer: { padding: theme.spacing.sm },
  momentumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  momentumLeft: { flex: 1 },
  momentumSymbol: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: theme.typography.base },
  momentumBar: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  momentumFill: { height: 4, borderRadius: 2 },
  momentumMid: { alignItems: 'flex-end', width: 80 },
  momentumPrice: { color: theme.colors.textPrimary, fontSize: theme.typography.sm, fontWeight: '600' },
  momentumChange: { fontSize: theme.typography.xs },
  momentumRight: { alignItems: 'center', gap: 4, width: 70 },
  momentumScore: { fontSize: theme.typography.xl, fontWeight: '800' },
});
