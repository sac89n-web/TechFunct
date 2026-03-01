import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { marketService } from '../api/marketService';
import { strategyService } from '../api/strategyService';
import { theme, getChangeColor } from '../theme';
import SkeletonLoader, { SkeletonCard } from '../components/common/SkeletonLoader';
import ErrorState from '../components/common/ErrorState';
import IndexCard from '../components/market/IndexCard';
import type { RootStackParamList } from '../types/navigation';
import type { IndexQuote } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();

  const indexQuery = useQuery({
    queryKey: ['index-quotes'],
    queryFn: marketService.getIndexQuotes,
    refetchInterval: 30_000,
  });

  const breadthQuery = useQuery({
    queryKey: ['breadth', 'NIFTY50'],
    queryFn: () => marketService.getBreadth('NIFTY50'),
    refetchInterval: 60_000,
  });

  const strategiesQuery = useQuery({
    queryKey: ['top10', 'NIFTY50'],
    queryFn: () => strategyService.getTop10('NIFTY50'),
    staleTime: 120_000,
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      indexQuery.refetch(),
      breadthQuery.refetch(),
      strategiesQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const quotes = indexQuery.data ?? [];
  const nifty50 = quotes.find(q => q.name === 'NIFTY 50');
  const sensex = quotes.find(q => q.name === 'SENSEX');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSub}>Live Market Overview</Text>
      </View>

      {/* Hero indices */}
      <View style={styles.heroRow}>
        {indexQuery.isLoading ? (
          <>
            <SkeletonCard style={{ flex: 1 }} />
            <SkeletonCard style={{ flex: 1 }} />
          </>
        ) : (
          <>
            {nifty50 && <IndexCard quote={nifty50} />}
            {sensex && <IndexCard quote={sensex} />}
          </>
        )}
      </View>

      {/* Scrollable ticker bar */}
      <Text style={styles.sectionTitle}>All Indices</Text>
      <FlatList
        horizontal
        data={quotes}
        keyExtractor={q => q.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}
        renderItem={({ item }) => <IndexCard quote={item} compact />}
      />

      {/* Market Breadth widget */}
      <Text style={styles.sectionTitle}>Market Breadth — NIFTY 50</Text>
      {breadthQuery.isLoading ? (
        <SkeletonCard />
      ) : breadthQuery.data ? (
        <BreadthWidget breadth={breadthQuery.data} />
      ) : null}

      {/* Top 3 strategies quick view */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Picks Today</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Main')}>
          <Text style={styles.seeAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      {strategiesQuery.isLoading ? (
        [1, 2, 3].map(i => <SkeletonCard key={i} />)
      ) : (
        strategiesQuery.data?.slice(0, 3).map(s => (
          <TouchableOpacity
            key={s.symbol}
            style={styles.pickCard}
            onPress={() => navigation.navigate('AIAssistant', {
              context: { currentSymbol: s.symbol, compositeScore: s.scorePercent },
            })}>
            <View style={styles.pickLeft}>
              <Text style={styles.pickRank}>#{s.rank}</Text>
              <View>
                <Text style={styles.pickSymbol}>{s.symbol}</Text>
                <Text style={styles.pickSignal}>{s.signal}</Text>
              </View>
            </View>
            <View style={styles.pickRight}>
              <Text style={styles.pickPrice}>
                ₹{s.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.pickChange, { color: getChangeColor(s.changePercent) }]}>
                {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
              </Text>
            </View>
            <Text style={[styles.pickScore, { color: theme.colors.primary }]}>
              {Math.round(s.scorePercent)}
            </Text>
          </TouchableOpacity>
        ))
      )}

      {/* AI assistant CTA */}
      <TouchableOpacity
        style={styles.aiCta}
        onPress={() => navigation.navigate('AIAssistant', {})}
        activeOpacity={0.85}>
        <Text style={styles.aiCtaEmoji}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiCtaTitle}>Ask AI Trading Assistant</Text>
          <Text style={styles.aiCtaSub}>Get strategy analysis, explain signals, risk assessment</Text>
        </View>
        <Text style={styles.aiCtaArrow}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BreadthWidget({ breadth }: { breadth: ReturnType<typeof marketService.getBreadth> extends Promise<infer T> ? T : never }) {
  const total = breadth.advances + breadth.declines + breadth.unchanged;
  const advPct = total ? (breadth.advances / total) * 100 : 0;
  const decPct = total ? (breadth.declines / total) * 100 : 0;

  return (
    <View style={styles.breadthCard}>
      <View style={styles.breadthRow}>
        <BreadthStat label="Advances" value={breadth.advances} color={theme.colors.success} />
        <BreadthStat label="Declines" value={breadth.declines} color={theme.colors.danger} />
        <BreadthStat label="Unchanged" value={breadth.unchanged} color={theme.colors.textMuted} />
        <BreadthStat
          label="A/D Ratio"
          value={breadth.advanceDeclineRatio.toFixed(2)}
          color={breadth.advanceDeclineRatio > 1 ? theme.colors.success : theme.colors.danger}
        />
      </View>
      <View style={styles.breadthBar}>
        <View style={[styles.breadthFill, { flex: advPct, backgroundColor: theme.colors.success }]} />
        <View style={[styles.breadthFill, { flex: decPct, backgroundColor: theme.colors.danger }]} />
        <View style={[styles.breadthFill, { flex: 100 - advPct - decPct, backgroundColor: theme.colors.border }]} />
      </View>
    </View>
  );
}

function BreadthStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.breadthStat}>
      <Text style={[styles.breadthStatVal, { color }]}>{value}</Text>
      <Text style={styles.breadthStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 32 },
  header: { padding: theme.spacing.xl, paddingBottom: theme.spacing.md },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.xxxl,
    fontWeight: theme.typography.extrabold,
  },
  headerSub: { color: theme.colors.textSecondary, fontSize: theme.typography.base },
  heroRow: { paddingHorizontal: theme.spacing.lg },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  seeAll: { color: theme.colors.primary, fontSize: theme.typography.sm },
  breadthCard: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  breadthRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  breadthStat: { alignItems: 'center' },
  breadthStatVal: { fontSize: theme.typography.xl, fontWeight: theme.typography.bold },
  breadthStatLabel: { color: theme.colors.textMuted, fontSize: theme.typography.xs, marginTop: 2 },
  breadthBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  breadthFill: { height: 8 },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  pickLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
  pickRank: { color: theme.colors.primary, fontWeight: '700', fontSize: theme.typography.base, width: 24 },
  pickSymbol: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: theme.typography.base },
  pickSignal: { color: theme.colors.textMuted, fontSize: theme.typography.xs },
  pickRight: { alignItems: 'flex-end' },
  pickPrice: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: theme.typography.base },
  pickChange: { fontSize: theme.typography.sm },
  pickScore: { fontWeight: '800', fontSize: theme.typography.xl, width: 40, textAlign: 'right' },
  aiCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primary + '18',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  aiCtaEmoji: { fontSize: 28 },
  aiCtaTitle: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: theme.typography.base },
  aiCtaSub: { color: theme.colors.textSecondary, fontSize: theme.typography.sm, marginTop: 2 },
  aiCtaArrow: { color: theme.colors.primary, fontSize: 20, fontWeight: '700' },
});
