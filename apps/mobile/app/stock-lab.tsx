import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { calculateStockStats, compareAgainstBenchmark, historicalEventOutcomes, projectScenarios, type PricePoint } from '@investiq/domain';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const ranges = ['1Y', '3Y', '5Y', '10Y', 'MAX'] as const;
type Range = typeof ranges[number];
type HistoryResponse = { available: boolean; points: PricePoint[]; source: { provider: string; retrievedAt: string } | null; message?: string };

function fromDate(range: Range): string | undefined {
  if (range === 'MAX') return undefined;
  const days = range === '1Y' ? 365 : range === '3Y' ? 1095 : range === '5Y' ? 1825 : 3650;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
function pct(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function money(value: number) { return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function Metric({ label, value, meta }: { label: string; value: string; meta: string }) { return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricMeta}>{meta}</Text></View>; }

export default function StockLab() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [benchmark, setBenchmark] = useState('NIFTY');
  const [range, setRange] = useState<Range>('5Y');
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [benchmarkPoints, setBenchmarkPoints] = useState<PricePoint[]>([]);
  const [trigger, setTrigger] = useState('-8');
  const [investment, setInvestment] = useState('100000');
  const [years, setYears] = useState('3');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Load verified history to unlock the intelligence modules.');
  const [source, setSource] = useState<string | null>(null);

  const stats = useMemo(() => points.length > 1 ? calculateStockStats(points) : null, [points]);
  const events = useMemo(() => points.length > 1 ? historicalEventOutcomes(points, Number(trigger), [5, 20, 60, 252]) : [], [points, trigger]);
  const relative = useMemo(() => points.length > 1 && benchmarkPoints.length > 1 ? compareAgainstBenchmark(points, benchmarkPoints) : null, [points, benchmarkPoints]);
  const scenarios = useMemo(() => stats && Number(investment) > 0 ? projectScenarios(Number(investment), Math.max(0, Number(years)), { bear: Math.max(-50, stats.cagrPct - 10), base: stats.cagrPct, bull: stats.cagrPct + 10 }) : [], [stats, investment, years]);

  async function fetchHistory(ticker: string) {
    const from = fromDate(range);
    const suffix = from ? `?from=${from}` : '';
    const response = await fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(ticker)}/history${suffix}`);
    const data = await response.json() as HistoryResponse;
    if (!response.ok || !data.available) throw new Error(data.message ?? `${ticker}: verified history unavailable`);
    return data;
  }

  async function analyze() {
    const stock = symbol.trim().toUpperCase();
    const index = benchmark.trim().toUpperCase();
    if (!stock) return;
    setLoading(true);
    setMessage('Fetching verified stock and benchmark history…');
    try {
      const [stockData, benchmarkData] = await Promise.all([fetchHistory(stock), index ? fetchHistory(index) : Promise.resolve(null)]);
      setPoints(stockData.points);
      setBenchmarkPoints(benchmarkData?.points ?? []);
      setSource(stockData.source ? `${stockData.source.provider} · ${new Date(stockData.source.retrievedAt).toLocaleString()}` : null);
      setMessage(`${stockData.points.length.toLocaleString('en-IN')} stock observations loaded${benchmarkData ? ` · ${benchmarkData.points.length.toLocaleString('en-IN')} benchmark observations` : ''}.`);
    } catch (error) {
      setPoints([]); setBenchmarkPoints([]); setSource(null);
      setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.');
    } finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Link href="/stocks" style={styles.back}>‹ Stocks</Link><Text style={styles.eyebrow}>INVESTMENT LAB</Text></View>
    <Text style={styles.title}>Stock Intelligence Lab</Text>
    <Text style={styles.subtitle}>Event studies, benchmark-relative performance, drawdowns and assumption-driven scenarios.</Text>

    <View style={styles.card}>
      <Text style={styles.label}>VERIFIED MARKET INPUTS</Text>
      <View style={styles.inputRow}><TextInput value={symbol} autoCapitalize="characters" onChangeText={setSymbol} placeholder="Stock symbol" placeholderTextColor={colors.muted} style={styles.input}/><TextInput value={benchmark} autoCapitalize="characters" onChangeText={setBenchmark} placeholder="Benchmark" placeholderTextColor={colors.muted} style={[styles.input, styles.smallInput]}/></View>
      <View style={styles.rangeRow}>{ranges.map(item => <TouchableOpacity key={item} onPress={() => setRange(item)} style={[styles.range, range === item && styles.rangeActive]}><Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity onPress={analyze} style={styles.button} disabled={loading}>{loading ? <ActivityIndicator color={colors.background}/> : <Text style={styles.buttonText}>Run intelligence analysis</Text>}</TouchableOpacity>
      <Text style={styles.muted}>{message}</Text>{source && <Text style={styles.source}>{source}</Text>}
    </View>

    <Text style={styles.section}>Historical risk profile</Text>
    <View style={styles.grid}>
      <Metric label="CAGR" value={stats ? pct(stats.cagrPct) : '—'} meta="Observed historical growth"/>
      <Metric label="Return" value={stats ? pct(stats.absoluteReturnPct) : '—'} meta="Start to end"/>
      <Metric label="Max drawdown" value={stats ? pct(stats.maxDrawdownPct) : '—'} meta="Peak to trough"/>
      <Metric label="Volatility" value={stats ? pct(stats.annualizedVolatilityPct) : '—'} meta="Annualized from daily returns"/>
    </View>

    <Text style={styles.section}>After a {trigger}% daily fall</Text>
    <View style={styles.card}><Text style={styles.muted}>Historical analogues only. Each row measures what happened after qualifying observed declines.</Text><View style={styles.eventHead}><Text style={styles.eventLabel}>HORIZON</Text><Text style={styles.eventLabel}>OBS.</Text><Text style={styles.eventLabel}>POSITIVE</Text><Text style={styles.eventLabel}>MEDIAN</Text></View>{events.length ? events.map(event => <View key={event.horizonDays} style={styles.eventRow}><Text style={styles.eventText}>{event.horizonDays}D</Text><Text style={styles.eventText}>{event.observations}</Text><Text style={styles.eventText}>{pct(event.positivePct)}</Text><Text style={styles.eventText}>{pct(event.medianReturnPct)}</Text></View>) : <Text style={styles.muted}>Load sufficient history and set a negative trigger such as -8.</Text>}<TextInput value={trigger} onChangeText={setTrigger} keyboardType="numbers-and-punctuation" style={styles.triggerInput} placeholder="Trigger % e.g. -8" placeholderTextColor={colors.muted}/></View>

    <Text style={styles.section}>Stock vs benchmark</Text>
    <View style={styles.grid}><Metric label="Stock return" value={relative ? pct(relative.stockReturnPct) : '—'} meta={symbol.toUpperCase()}/><Metric label="Benchmark" value={relative ? pct(relative.benchmarkReturnPct) : '—'} meta={benchmark.toUpperCase()}/><Metric label="Excess return" value={relative ? pct(relative.excessReturnPct) : '—'} meta="Stock minus benchmark"/><Metric label="CAGR spread" value={relative ? pct(relative.stockCagrPct - relative.benchmarkCagrPct) : '—'} meta="Historical annualized gap"/></View>

    <Text style={styles.section}>Historical-return scenario simulator</Text>
    <View style={styles.card}><Text style={styles.muted}>Scenarios are mathematical assumptions, not AI forecasts. The base case uses observed historical CAGR; bear/bull are ±10 percentage points.</Text><View style={styles.inputRow}><TextInput value={investment} onChangeText={setInvestment} keyboardType="numeric" style={styles.input} placeholder="Investment" placeholderTextColor={colors.muted}/><TextInput value={years} onChangeText={setYears} keyboardType="numeric" style={[styles.input, styles.smallInput]} placeholder="Years" placeholderTextColor={colors.muted}/></View>{scenarios.map(scenario => <View key={scenario.name} style={styles.scenario}><View><Text style={styles.scenarioName}>{scenario.name.toUpperCase()}</Text><Text style={styles.muted}>{scenario.assumption}</Text></View><Text style={styles.scenarioValue}>{money(scenario.projectedValue)}</Text></View>)}</View>

    <View style={styles.note}><Text style={styles.noteTitle}>Data integrity rule</Text><Text style={styles.noteText}>Every calculation above is derived from verified historical observations returned by the market-data provider. Missing data remains unavailable; InvestIQ does not manufacture prices, benchmark returns or forecasts.</Text></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, content:{padding:spacing.lg,paddingBottom:60,gap:spacing.lg}, top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, back:{color:colors.accent,fontSize:13,fontWeight:'800'}, eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4}, title:{color:colors.text,fontSize:30,fontWeight:'900'}, subtitle:{color:colors.muted,fontSize:14,lineHeight:20,marginTop:-9}, card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:spacing.md}, label:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2}, inputRow:{flexDirection:'row',gap:8}, input:{flex:1,color:colors.text,backgroundColor:colors.surfaceElevated,borderRadius:radius.sm,padding:12,fontSize:14}, smallInput:{maxWidth:'42%'}, rangeRow:{flexDirection:'row',justifyContent:'space-between'}, range:{paddingVertical:7,paddingHorizontal:9,borderRadius:radius.pill}, rangeActive:{backgroundColor:colors.accent}, rangeText:{color:colors.muted,fontSize:10,fontWeight:'800'}, rangeTextActive:{color:colors.background}, button:{backgroundColor:colors.accent,paddingVertical:13,borderRadius:radius.sm,alignItems:'center'}, buttonText:{color:colors.background,fontSize:11,fontWeight:'900'}, muted:{color:colors.muted,fontSize:10,lineHeight:16}, source:{color:colors.accent,fontSize:9}, section:{color:colors.text,fontSize:18,fontWeight:'900',marginBottom:-7}, grid:{flexDirection:'row',flexWrap:'wrap',gap:8}, metric:{width:'47%',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,minHeight:86}, metricValue:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:4}, metricMeta:{color:colors.muted,fontSize:8,lineHeight:13,marginTop:3}, eventHead:{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:1,borderColor:colors.border,paddingBottom:7}, eventLabel:{color:colors.muted,fontSize:8,fontWeight:'900',width:'22%'}, eventRow:{flexDirection:'row',justifyContent:'space-between,paddingVertical:9,borderBottomWidth:1,borderColor:colors.border'}, eventText:{color:colors.text,fontSize:10,width:'22%',fontWeight:'700'}, triggerInput:{color:colors.text,backgroundColor:colors.surfaceElevated,borderRadius:radius.sm,padding:10,fontSize:12}, scenario:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderTopWidth:1,borderColor:colors.border}, scenarioName:{color:colors.accent,fontSize:10,fontWeight:'900'}, scenarioValue:{color:colors.text,fontSize:17,fontWeight:'900'}, note:{backgroundColor:colors.accentSoft,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,padding:spacing.md}, noteTitle:{color:colors.accent,fontSize:10,fontWeight:'900'}, noteText:{color:colors.muted,fontSize:9,lineHeight:15,marginTop:5}
});
