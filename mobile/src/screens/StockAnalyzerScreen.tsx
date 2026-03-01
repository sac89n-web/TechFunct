import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { analysisService } from '../api/analysisService';
import { theme, getChangeColor, getScoreColor } from '../theme';
import ScoreGauge from '../components/common/ScoreGauge';
import { SignalBadge } from '../components/common/Badge';
import SkeletonLoader, { SkeletonCard } from '../components/common/SkeletonLoader';
import ErrorState from '../components/common/ErrorState';
import type { StockAnalysis } from '../types';
import type { RootStackParamList } from '../types/navigation';

const INDICES = ['NIFTY50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO', 'NIFTY FMCG'];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function StockAnalyzerScreen() {
  const navigation = useNavigation<Nav>();
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('NIFTY50');
  const [searchResult, setSearchResult] = useState<StockAnalysis | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const indexQuery = useQuery({
    queryKey: ['analyze-index', selectedIndex],
    queryFn: () => analysisService.analyzeIndex(selectedIndex),
    staleTime: 120_000,
  });

  const handleSearch = async () => {
    const sym = searchText.trim().toUpperCase();
    if (!sym) return;
    setSearching(true);
    setSearchError('');
    try {
      const result = await analysisService.analyzeStock(sym);
      setSearchResult(result);
    } catch (e: any) {
      setSearchError(e?.response?.data?.error ?? 'Symbol not found');
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search symbol (e.g. RELIANCE)"
          placeholderTextColor={theme.colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          autoCapitalize="characters"
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={handleSearch}
          disabled={searching}>
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Analyze</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Single stock result */}
      {searchResult && (
        <View style={styles.searchResultCard}>
          <StockAnalysisCard
            item={searchResult}
            onAsk={() =>
              navigation.navigate('AIAssistant', {
                context: {
                  currentSymbol: searchResult.symbol,
                  compositeScore: searchResult.compositeScore,
                  technicalSummary: `RSI: ${searchResult.rsi?.toFixed(1)}, Signal: ${searchResult.tradeSignal}`,
                },
              })
            }
          />
        </View>
      )}
      {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}

      {/* Index selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indexBar}>
        {INDICES.map(idx => (
          <TouchableOpacity
            key={idx}
            style={[styles.indexChip, selectedIndex === idx && styles.indexChipActive]}
            onPress={() => setSelectedIndex(idx)}>
            <Text style={[styles.indexChipText, selectedIndex === idx && styles.indexChipTextActive]}>
              {idx.replace('NIFTY ', '')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Index analysis grid */}
      {indexQuery.isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5]}
          keyExtractor={i => String(i)}
          renderItem={() => <SkeletonCard style={{ marginHorizontal: theme.spacing.md }} />}
          contentContainerStyle={{ padding: theme.spacing.sm }}
        />
      ) : indexQuery.error ? (
        <ErrorState message="Failed to load analysis" onRetry={indexQuery.refetch} />
      ) : (
        <FlatList
          data={indexQuery.data ?? []}
          keyExtractor={item => item.symbol}
          renderItem={({ item }) => (
            <StockAnalysisCard
              item={item}
              onAsk={() =>
                navigation.navigate('AIAssistant', {
                  context: {
                    currentSymbol: item.symbol,
                    compositeScore: item.compositeScore,
                    technicalSummary: `RSI: ${item.rsi?.toFixed(1)}, Signal: ${item.tradeSignal}`,
                  },
                })
              }
            />
          )}
          contentContainerStyle={{ padding: theme.spacing.sm, paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

function StockAnalysisCard({ item, onAsk }: { item: StockAnalysis; onAsk: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const changeColor = getChangeColor(item.changePercent);
  const scoreColor = getScoreColor(item.compositeScore);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.price}>
            ₹{item.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            <Text style={[styles.change, { color: changeColor }]}>
              {'  '}{item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
            </Text>
          </Text>
        </View>
        <View style={styles.gaugeArea}>
          <ScoreGauge score={item.compositeScore} size={64} />
        </View>
      </View>

      <View style={styles.signalRow}>
        <SignalBadge signal={item.tradeSignal} />
        {item.goldenCross && <Text style={styles.crossBadge}>✦ Golden Cross</Text>}
        {item.deathCross && (
          <Text style={[styles.crossBadge, { color: theme.colors.danger }]}>✦ Death Cross</Text>
        )}
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.smaRow}>
            {item.sma20 && <SMAChip label="SMA20" value={item.sma20} current={item.currentPrice} />}
            {item.sma50 && <SMAChip label="SMA50" value={item.sma50} current={item.currentPrice} />}
            {item.sma200 && <SMAChip label="SMA200" value={item.sma200} current={item.currentPrice} />}
          </View>
          {item.rsi != null && (
            <View style={styles.rsiRow}>
              <Text style={styles.rsiLabel}>RSI (14)</Text>
              <View style={styles.rsiTrack}>
                <View style={[styles.rsiFill, { width: `${item.rsi}%` as any, backgroundColor: getRSIColor(item.rsi) }]} />
              </View>
              <Text style={[styles.rsiValue, { color: getRSIColor(item.rsi) }]}>
                {item.rsi.toFixed(1)}
              </Text>
            </View>
          )}
          <View style={styles.targetRow}>
            {item.stopLoss && <TargetChip label="SL" value={item.stopLoss} color={theme.colors.danger} />}
            {item.target1 && <TargetChip label="T1" value={item.target1} color={theme.colors.success} />}
            {item.target2 && <TargetChip label="T2" value={item.target2} color={theme.colors.success} />}
            {item.riskReward && (
              <TargetChip label="R:R" value={item.riskReward} color={theme.colors.info} format="ratio" />
            )}
          </View>
          <TouchableOpacity style={styles.askAiBtn} onPress={onAsk}>
            <Text style={styles.askAiBtnText}>🤖 Ask AI about {item.symbol}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.expandHint}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

function getRSIColor(rsi: number) {
  if (rsi > 70) return theme.colors.danger;
  if (rsi < 30) return theme.colors.success;
  return theme.colors.info;
}

function SMAChip({ label, value, current }: { label: string; value: number; current: number }) {
  const above = current > value;
  return (
    <View style={[styles.smaChip, { borderColor: above ? theme.colors.success + '55' : theme.colors.danger + '55' }]}>
      <Text style={styles.smaLabel}>{label}</Text>
      <Text style={[styles.smaValue, { color: above ? theme.colors.success : theme.colors.danger }]}>
        ₹{value.toFixed(0)}
      </Text>
      <Text style={[styles.smaDiff, { color: above ? theme.colors.success : theme.colors.danger }]}>
        {above ? '▲' : '▼'}{Math.abs(((current - value) / value) * 100).toFixed(1)}%
      </Text>
    </View>
  );
}

function TargetChip({ label, value, color, format = 'price' }: {
  label: string; value: number; color: string; format?: 'price' | 'ratio';
}) {
  return (
    <View style={styles.targetChip}>
      <Text style={styles.targetLabel}>{label}</Text>
      <Text style={[styles.targetValue, { color }]}>
        {format === 'ratio' ? value.toFixed(2) : `₹${value.toFixed(0)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchBar: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.typography.base },
  searchResultCard: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm },
  searchError: {
    color: theme.colors.danger,
    fontSize: theme.typography.sm,
    paddingHorizontal: theme.spacing.xl,
    marginTop: 4,
  },
  indexBar: {
    flexGrow: 0,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  indexChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
    backgroundColor: theme.colors.card,
  },
  indexChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  indexChipText: { color: theme.colors.textSecondary, fontSize: theme.typography.sm },
  indexChipTextActive: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  symbol: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: theme.typography.lg },
  price: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: theme.typography.base, marginTop: 2 },
  change: { fontWeight: '600' },
  gaugeArea: { alignItems: 'flex-end' },
  signalRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  crossBadge: { color: theme.colors.warning, fontSize: theme.typography.xs, fontWeight: '600' },
  expanded: { marginTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  smaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  smaChip: { borderWidth: 1, borderRadius: theme.radius.sm, padding: 6, alignItems: 'center', flex: 1, minWidth: 70 },
  smaLabel: { color: theme.colors.textMuted, fontSize: 10 },
  smaValue: { fontSize: theme.typography.sm, fontWeight: '600' },
  smaDiff: { fontSize: 10 },
  rsiRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm },
  rsiLabel: { color: theme.colors.textMuted, fontSize: theme.typography.xs, width: 52 },
  rsiTrack: { flex: 1, height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' },
  rsiFill: { height: 6, borderRadius: 3 },
  rsiValue: { fontWeight: '700', fontSize: theme.typography.sm, width: 36 },
  targetRow: { flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  targetChip: { alignItems: 'center', flex: 1, minWidth: 50 },
  targetLabel: { color: theme.colors.textMuted, fontSize: 10 },
  targetValue: { fontSize: theme.typography.base, fontWeight: '700' },
  askAiBtn: {
    backgroundColor: theme.colors.primary + '22',
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
    alignItems: 'center',
  },
  askAiBtnText: { color: theme.colors.primary, fontWeight: '600', fontSize: theme.typography.sm },
  expandHint: { color: theme.colors.textMuted, fontSize: theme.typography.xs, textAlign: 'center', marginTop: 4 },
});
