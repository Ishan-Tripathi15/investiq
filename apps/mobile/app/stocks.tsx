import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const ranges = ['1M', '6M', '1Y', '3Y', '5Y', '10Y', 'MAX'] as const;
type Range = typeof ranges[number];

type Point = { timestamp: string; close: number; volume?: number };
type HistoryResponse = { symbol: string; available: boolean; points: Point[]; source: { provider: string; retrievedAt: string } | null; message?: string };
type ProviderStatus = { status: string; provider: string; live: boolean; historical: boolean; message: string };

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function fromDate(range: Range): string | undefined {
  if (range === 'MAX') return undefined;
  const date = new Date();
  const days = range === '1M' ? 31 : range === '6M' ? 183 : range === '1Y' ? 365 : range === '3Y' ? 1095 : range === '5Y' ? 1825 : 3650;
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function pct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function calculateMetrics(points: Point[]) {
  if (points.length < 2) return { cagr: null, returnPct: null, drawdown: null, volatility: null };
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const years = Math.max(1 / 365, (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const cagr = (Math.pow(last.close / first.close, 1 / years) - 1) * 100;
  const returnPct = ((last.close / first.close) - 1) * 100;
  let peak = first.close;
  let maxDrawdown = 0;
  const dailyReturns: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!;
    peak = Math.max(peak, point.close);
    maxDrawdown = Math.min(maxDrawdown, ((point.close / peak) - 1) * 100);
    if (i > 0) {
      const previous = points[i - 1]!.close;
      dailyReturns.push((point.close / previous) - 1);
    }
  }
  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / Math.max(1, dailyReturns.length);
  const variance = dailyReturns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(1, dailyReturns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  return { cagr, returnPct, drawdown: maxDrawdown, volatility };
}

export default function StocksScreen() {
  const [query, setQuery] = useState('RELIANCE');
  const [range, setRange] = useState<Range>('1Y');
  const [points, setPoints] = useState<Point[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Enter a symbol and tap Analyze.');

  const metrics = useMemo(() => calculateMetrics(points), [points]);
  const chartPoints = useMemo(() => {
    if (points.length <= 80) return points;
    const step = Math.ceil(points.length / 80);
    return points.filter((_, index) => index % step === 0 || index === points.length - 1);
  }, [points]);

  async function loadStock() {
    const symbol = query.trim().toUpperCase();
    if (!symbol) return;
    setLoading(true);
    setMessage('Fetching verified historical data…');
    try {
      const from = fromDate(range);
      const queryParams = from ? `?from=${from}` : '';
      const [historyResponse, statusResponse] = await Promise.all([
        fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(symbol)}/history${queryParams}`),
        fetch(`${API_URL}/market-data/status`),
      ]);
      const history = await historyResponse.json() as HistoryResponse;
      const provider = await statusResponse.json() as ProviderStatus;
      setStatus(provider);
      if (!historyResponse.ok || !history.available) {
        setPoints([]);
        setSource(null);
        setMessage(history.message ?? provider.message ?? 'Historical data is unavailable.');
        return;
      }
      setPoints(history.points);
      setSource(history.source ? `${history.source.provider} · ${new Date(history.source.retrievedAt).toLocaleString()}` : null);
      setMessage(`${history.points.length.toLocaleString('en-IN')} verified observations loaded.`);
    } catch (error) {
      setPoints([]);
      setSource(null);
      setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.');
    } finally {
      setLoading(false);
    }
  }

  const maxClose = Math.max(...chartPoints.map((point) => point.close), 0);
  const minClose = Math.min(...chartPoints.map((point) => point.close), maxClose);
  const span = Math.max(0.000001, maxClose - minClose);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Link href="/" style={styles.back}>‹  Home</Link><Text style={styles.eyebrow}>STOCK INTELLIGENCE</Text></View>
        <Text style={styles.title}>Stocks</Text>
        <Text style={styles.subtitle}>Analyze verified history, risk and scenarios before you trade.</Text>

        <View style={styles.search}>
          <TextInput value={query} autoCapitalize="characters" onChangeText={setQuery} onSubmitEditing={loadStock} placeholder="Search NSE/BSE symbol" placeholderTextColor={colors.muted} style={styles.input} />
          <TouchableOpacity onPress={loadStock} style={styles.analyzeButton} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.analyzeText}>Analyze</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.provider}>
          <View style={[styles.providerDot, status?.historical && styles.providerLive]} />
          <View style={styles.providerCopy}>
            <Text style={styles.providerTitle}>{status?.historical ? `Historical feed · ${status.provider}` : 'Verified market feed'}</Text>
            <Text style={styles.muted}>{message}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View><Text style={styles.cardTitle}>{query.trim().toUpperCase() || 'Select a stock'}</Text><Text style={styles.muted}>{points.length ? `${money(points[points.length - 1]!.close)} last close` : 'Price history'}</Text></View>
            <Text style={styles.pending}>{points.length ? 'VERIFIED' : 'DATA PENDING'}</Text>
          </View>
          <View style={styles.chart}>
            {chartPoints.length > 1 ? chartPoints.map((point, index) => {
              const x = (index / (chartPoints.length - 1)) * 94 + 3;
              const y = 94 - ((point.close - minClose) / span) * 82;
              return <View key={`${point.timestamp}-${index}`} style={[styles.chartPoint, { left: `${x}%`, top: `${y}%` }]} />;
            }) : <Text style={styles.chartText}>Load verified history to render the series</Text>}
            <View style={styles.chartGuide} /><View style={styles.chartGuideTwo} />
          </View>
          <View style={styles.rangeRow}>{ranges.map((item) => <TouchableOpacity key={item} onPress={() => { setRange(item); }} style={[styles.range, range === item && styles.rangeActive]}><Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text></TouchableOpacity>)}</View>
          <TouchableOpacity onPress={loadStock} style={styles.refresh}><Text style={styles.refreshText}>Refresh {range} history</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historical intelligence</Text>
        <View style={styles.metrics}>
          <Metric label="Period return" value={metrics.returnPct == null ? '—' : pct(metrics.returnPct)} meta={source ?? 'Provider pending'} />
          <Metric label="CAGR" value={metrics.cagr == null ? '—' : pct(metrics.cagr)} meta="Annualized historical growth" />
          <Metric label="Max drawdown" value={metrics.drawdown == null ? '—' : pct(metrics.drawdown)} meta="Peak-to-trough observed" />
          <Metric label="Annualized volatility" value={metrics.volatility == null ? '—' : `${metrics.volatility.toFixed(2)}%`} meta="Based on daily observations" />
        </View>

        <View style={styles.note}><Text style={styles.noteTitle}>Historical ≠ forecast</Text><Text style={styles.noteText}>These metrics describe observed market history only. InvestIQ will keep future scenarios separate and will never turn historical returns into a guaranteed prediction.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricMeta}>{meta}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 52, gap: spacing.lg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '900' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -9 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingLeft: 13 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14, paddingRight: 9 },
  analyzeButton: { backgroundColor: colors.accent, paddingHorizontal: 15, paddingVertical: 12, marginRight: 5, borderRadius: radius.sm, minWidth: 72, alignItems: 'center' },
  analyzeText: { color: colors.background, fontSize: 11, fontWeight: '900' },
  provider: { flexDirection: 'row', gap: 11, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  providerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning, marginTop: 3 },
  providerLive: { backgroundColor: colors.accent },
  providerCopy: { flex: 1, gap: 3 },
  providerTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  pending: { color: colors.warning, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  chart: { height: 190, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  chartGuide: { position: 'absolute', left: 0, right: 0, top: '38%', borderTopWidth: 1, borderColor: colors.border },
  chartGuideTwo: { position: 'absolute', left: 0, right: 0, top: '68%', borderTopWidth: 1, borderColor: colors.border },
  chartPoint: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  chartText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  range: { paddingVertical: 7, paddingHorizontal: 8, borderRadius: radius.pill },
  rangeActive: { backgroundColor: colors.accent },
  rangeText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  rangeTextActive: { color: colors.background },
  refresh: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, alignItems: 'center' },
  refreshText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  metrics: { gap: spacing.sm },
  metric: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  metricMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  noteTitle: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  noteText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
});
