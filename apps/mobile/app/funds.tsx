import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const ranges = ['1Y', '3Y', '5Y', '10Y', 'MAX'] as const;
type Range = typeof ranges[number];
type Point = { timestamp: string; nav: number };
type HistoryResponse = { schemeId: string; available: boolean; points: Point[]; source: { provider: string; retrievedAt: string } | null; message?: string };
type ProviderStatus = { status: string; provider: string; mutualFundProvider: string; mutualFundHistorical: boolean; message: string };

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function fromDate(range: Range): string | undefined {
  if (range === 'MAX') return undefined;
  const date = new Date();
  const days = range === '1Y' ? 365 : range === '3Y' ? 1095 : range === '5Y' ? 1825 : 3650;
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function pct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function metrics(points: Point[]) {
  if (points.length < 2) return { cagr: null, returnPct: null, drawdown: null, volatility: null };
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const years = Math.max(1 / 365, (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const returnPct = (last.nav / first.nav - 1) * 100;
  const cagr = (Math.pow(last.nav / first.nav, 1 / years) - 1) * 100;
  let peak = first.nav;
  let drawdown = 0;
  const returns: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const nav = points[i]!.nav;
    peak = Math.max(peak, nav);
    drawdown = Math.min(drawdown, (nav / peak - 1) * 100);
    if (i > 0) returns.push(nav / points[i - 1]!.nav - 1);
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length);
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(1, returns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  return { cagr, returnPct, drawdown, volatility };
}

export default function FundsScreen() {
  const [schemeId, setSchemeId] = useState('');
  const [range, setRange] = useState<Range>('1Y');
  const [points, setPoints] = useState<Point[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [amount, setAmount] = useState('100000');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Enter an AMFI scheme key and tap Analyze.');

  const stats = useMemo(() => metrics(points), [points]);
  const simulation = useMemo(() => {
    const principal = Number(amount.replace(/,/g, ''));
    if (!points.length || !Number.isFinite(principal) || principal < 0) return null;
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const units = principal / first.nav;
    const finalValue = units * last.nav;
    return { principal, finalValue, profit: finalValue - principal, units };
  }, [amount, points]);

  const chartPoints = useMemo(() => {
    if (points.length <= 90) return points;
    const step = Math.ceil(points.length / 90);
    return points.filter((_, index) => index % step === 0 || index === points.length - 1);
  }, [points]);

  async function loadFund() {
    const key = schemeId.trim();
    if (!/^\d+:\d+$/.test(key)) {
      setMessage('Use the AMFI key format AMC code:scheme code, for example 22:119598.');
      return;
    }
    setLoading(true);
    setMessage('Fetching verified AMFI NAV history…');
    try {
      const from = fromDate(range);
      const queryParams = from ? `?from=${from}` : '';
      const [historyResponse, statusResponse] = await Promise.all([
        fetch(`${API_URL}/market-data/funds/${encodeURIComponent(key)}/history${queryParams}`),
        fetch(`${API_URL}/market-data/status`),
      ]);
      const history = await historyResponse.json() as HistoryResponse;
      const provider = await statusResponse.json() as ProviderStatus;
      setStatus(provider);
      if (!historyResponse.ok || !history.available) {
        setPoints([]);
        setSource(null);
        setMessage(history.message ?? 'No verified NAV history is available for this scheme.');
        return;
      }
      setPoints(history.points);
      setSource(history.source ? `${history.source.provider} · ${new Date(history.source.retrievedAt).toLocaleString()}` : null);
      setMessage(`${history.points.length.toLocaleString('en-IN')} verified NAV observations loaded.`);
    } catch (error) {
      setPoints([]);
      setSource(null);
      setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.');
    } finally {
      setLoading(false);
    }
  }

  const maxNav = Math.max(...chartPoints.map((point) => point.nav), 0);
  const minNav = Math.min(...chartPoints.map((point) => point.nav), maxNav);
  const span = Math.max(0.000001, maxNav - minNav);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Link href="/" style={styles.back}>‹  Home</Link><Text style={styles.eyebrow}>MUTUAL FUND INTELLIGENCE</Text></View>
        <Text style={styles.title}>Mutual Funds</Text>
        <Text style={styles.subtitle}>Research verified NAV history, risk and historical investment outcomes.</Text>

        <Link href="/lab" asChild><TouchableOpacity style={styles.hero} activeOpacity={0.85}>
          <View style={styles.heroTop}><View><Text style={styles.kicker}>INVESTMENT LAB</Text><Text style={styles.heroTitle}>SIP + Lumpsum calculators</Text></View><Text style={styles.arrow}>↗</Text></View>
          <Text style={styles.heroText}>Project goals and contributions separately from historical fund performance.</Text>
        </TouchableOpacity></Link>

        <View style={styles.search}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>AMFI scheme key</Text>
            <TextInput value={schemeId} onChangeText={setSchemeId} onSubmitEditing={loadFund} placeholder="AMC code:scheme code" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
          </View>
          <TouchableOpacity onPress={loadFund} style={styles.analyzeButton} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.analyzeText}>Analyze</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.provider}>
          <View style={[styles.providerDot, status?.mutualFundHistorical && styles.providerLive]} />
          <View style={styles.providerCopy}>
            <Text style={styles.providerTitle}>{status?.mutualFundHistorical ? 'AMFI historical NAV feed' : 'Verified NAV feed'}</Text>
            <Text style={styles.muted}>{message}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View><Text style={styles.cardTitle}>{schemeId.trim() || 'Select a scheme'}</Text><Text style={styles.muted}>{points.length ? `${money(points[points.length - 1]!.nav)} latest loaded NAV` : 'NAV history'}</Text></View>
            <Text style={styles.pending}>{points.length ? 'VERIFIED' : 'DATA PENDING'}</Text>
          </View>
          <View style={styles.chart}>
            {chartPoints.length > 1 ? chartPoints.map((point, index) => {
              const x = (index / (chartPoints.length - 1)) * 94 + 3;
              const y = 94 - ((point.nav - minNav) / span) * 82;
              return <View key={`${point.timestamp}-${index}`} style={[styles.chartPoint, { left: `${x}%`, top: `${y}%` }]} />;
            }) : <Text style={styles.chartText}>Load verified NAV history to render the series</Text>}
            <View style={styles.chartGuide} /><View style={styles.chartGuideTwo} />
          </View>
          <View style={styles.rangeRow}>{ranges.map((item) => <TouchableOpacity key={item} onPress={() => setRange(item)} style={[styles.range, range === item && styles.rangeActive]}><Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text></TouchableOpacity>)}</View>
          <TouchableOpacity onPress={loadFund} style={styles.refresh}><Text style={styles.refreshText}>Refresh {range} history</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historical intelligence</Text>
        <View style={styles.metrics}>
          <Metric label="Period return" value={stats.returnPct == null ? '—' : pct(stats.returnPct)} meta={source ?? 'Provider pending'} />
          <Metric label="CAGR" value={stats.cagr == null ? '—' : pct(stats.cagr)} meta="Annualized historical growth" />
          <Metric label="Max drawdown" value={stats.drawdown == null ? '—' : pct(stats.drawdown)} meta="Peak-to-trough observed" />
          <Metric label="Annualized volatility" value={stats.volatility == null ? '—' : `${stats.volatility.toFixed(2)}%`} meta="Based on NAV observations" />
        </View>

        <View style={styles.simulator}>
          <Text style={styles.sectionTitle}>Historical investment simulator</Text>
          <Text style={styles.muted}>If the selected scheme's first loaded NAV had been used for a one-time investment, what would the units be worth at the last loaded NAV?</Text>
          <View style={styles.amountRow}><Text style={styles.amountPrefix}>₹</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={styles.amountInput} /></View>
          {simulation ? <View style={styles.simGrid}>
            <Metric label="Ending value" value={money(simulation.finalValue)} meta={`${simulation.units.toFixed(4)} units`} />
            <Metric label="Historical profit" value={money(simulation.profit)} meta={pct((simulation.finalValue / simulation.principal - 1) * 100)} />
          </View> : <Text style={styles.muted}>Load verified history to run the simulation.</Text>}
          <Text style={styles.disclaimer}>This is a historical what-if calculation, not a promise of future returns. It also excludes taxes, exit loads and transaction costs.</Text>
        </View>

        <View style={styles.note}><Text style={styles.noteTitle}>Source integrity</Text><Text style={styles.noteText}>AMFI provides NAV history and limits historical NAV downloads to a maximum period per request. InvestIQ chunks longer requests and labels the provider and retrieval time rather than fabricating missing observations.</Text></View>
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
  eyebrow: { color: colors.muted, fontSize: 8, letterSpacing: 1.3, fontWeight: '900' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -9 },
  hero: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 5 },
  arrow: { color: colors.accent, fontSize: 22, fontWeight: '900' },
  heroText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingLeft: 13 },
  inputWrap: { flex: 1 },
  inputLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 5 },
  input: { color: colors.text, fontSize: 14, paddingVertical: 9, paddingRight: 8 },
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
  range: { paddingVertical: 7, paddingHorizontal: 9, borderRadius: radius.pill },
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
  simulator: { gap: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  amountPrefix: { color: colors.muted, fontSize: 16, fontWeight: '800' },
  amountInput: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800', paddingVertical: 12, paddingLeft: 6 },
  simGrid: { gap: spacing.sm },
  disclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  noteTitle: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  noteText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
});
