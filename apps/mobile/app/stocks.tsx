import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const ranges = ['1M', '6M', '1Y', '3Y', '5Y', '10Y', 'MAX'];
const tools = [
  ['Historical Simulator', 'Model what an investment could have done historically.'],
  ['Drawdown Analyzer', 'Study historical peak-to-trough declines.'],
  ['Event Analyzer', 'Compare outcomes after similar historical moves.'],
  ['Financial Growth', 'Track revenue, profit, EPS and cash-flow trends.'],
  ['Valuation History', 'Compare valuation metrics across history.'],
  ['Scenario Engine', 'Build explicit bull, base and bear assumptions.'],
];

export default function StocksScreen() {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('1Y');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Link href="/" style={styles.back}>‹  Home</Link><Text style={styles.eyebrow}>STOCK INTELLIGENCE</Text></View>
        <Text style={styles.title}>Stocks</Text>
        <Text style={styles.subtitle}>Analyze history, risk and scenarios before you trade.</Text>

        <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search a stock" placeholderTextColor={colors.muted} style={styles.input} /></View>

        <View style={styles.provider}><View style={styles.providerDot} /><View style={styles.providerCopy}><Text style={styles.providerTitle}>Verified market feed</Text><Text style={styles.muted}>Connect a licensed/verified provider to unlock live and historical prices.</Text></View></View>

        <View style={styles.card}>
          <View style={styles.cardHead}><View><Text style={styles.cardTitle}>{query.trim() || 'Select a stock'}</Text><Text style={styles.muted}>Price history</Text></View><Text style={styles.pending}>DATA PENDING</Text></View>
          <View style={styles.chart}><View style={styles.chartGuide} /><View style={styles.chartGuideTwo} /><Text style={styles.chartText}>Historical series will render here</Text></View>
          <View style={styles.rangeRow}>{ranges.map((item) => <TouchableOpacity key={item} onPress={() => setRange(item)} style={[styles.range, range === item && styles.rangeActive]}><Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text></TouchableOpacity>)}</View>
        </View>

        <Text style={styles.sectionTitle}>Intelligence modules</Text>
        <View style={styles.grid}>{tools.map(([title, subtitle], index) => <View key={title} style={styles.tool}><Text style={styles.toolNumber}>0{index + 1}</Text><Text style={styles.toolTitle}>{title}</Text><Text style={styles.toolSubtitle}>{subtitle}</Text></View>)}</View>

        <View style={styles.metrics}><Text style={styles.sectionTitle}>Core metrics</Text><Metric label="CAGR" /><Metric label="Max drawdown" /><Metric label="Volatility" /><Metric label="P/E history" /><Metric label="Revenue trend" /><Metric label="ROCE trend" /></View>

        <View style={styles.note}><Text style={styles.noteTitle}>No invented numbers</Text><Text style={styles.noteText}>InvestIQ will not display a made-up price, return, financial metric or historical event. Every production value will carry its source and timestamp.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label }: { label: string }) { return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue}>—</Text><Text style={styles.metricMeta}>Provider pending</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 52, gap: spacing.lg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '900' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -9 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13 },
  searchIcon: { color: colors.accent, fontSize: 24 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14, paddingHorizontal: 9 },
  provider: { flexDirection: 'row', gap: 11, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  providerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning, marginTop: 3 },
  providerCopy: { flex: 1, gap: 3 },
  providerTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  pending: { color: colors.warning, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  chart: { height: 190, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  chartGuide: { position: 'absolute', left: 0, right: 0, top: '38%', borderTopWidth: 1, borderColor: colors.border },
  chartGuideTwo: { position: 'absolute', left: 0, right: 0, top: '68%', borderTopWidth: 1, borderColor: colors.border },
  chartText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  range: { paddingVertical: 7, paddingHorizontal: 8, borderRadius: radius.pill },
  rangeActive: { backgroundColor: colors.accent },
  rangeText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  rangeTextActive: { color: colors.background },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tool: { width: '48%', minHeight: 142, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  toolNumber: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  toolTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 15 },
  toolSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  metrics: { gap: spacing.sm },
  metric: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  metricMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  noteTitle: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  noteText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
});
