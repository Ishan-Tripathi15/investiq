import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { buildScenarioEngine, calculateFinancialQuality, calculateStockStats, financialTrends, valuationFlags, type FinancialPeriodInput, type PricePoint } from '@investiq/domain';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
type HistoryResponse = { available: boolean; points: PricePoint[]; source: { provider: string; retrievedAt: string } | null; message?: string };
type FundamentalsResponse = { available: boolean; data: { symbol: string; name?: string; currency?: string; exchange?: string; pe?: number; forwardPe?: number; priceToBook?: number; evToEbitda?: number; periods: FinancialPeriodInput[] } | null; source: { provider: string; retrievedAt: string } | null; message?: string };

function pct(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function money(value: number, currency = 'INR') { try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); } catch { return value.toLocaleString('en-IN', { maximumFractionDigits: 0 }); } }
function Metric({ label, value, meta }: { label: string; value: string; meta: string }) { return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricMeta}>{meta}</Text></View>; }

export default function Intelligence() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [investment, setInvestment] = useState('100000');
  const [years, setYears] = useState('3');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Load verified market and financial data to build the research view.');
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [fundamentals, setFundamentals] = useState<FundamentalsResponse['data']>(null);
  const [source, setSource] = useState<string | null>(null);
  const [financialMessage, setFinancialMessage] = useState<string | null>(null);

  const stats = useMemo(() => points.length > 1 ? calculateStockStats(points) : null, [points]);
  const quality = useMemo(() => fundamentals?.periods?.length ? calculateFinancialQuality(fundamentals.periods) : null, [fundamentals]);
  const trends = useMemo(() => fundamentals?.periods?.length ? financialTrends(fundamentals.periods) : [], [fundamentals]);
  const flags = useMemo(() => valuationFlags({ pe: fundamentals?.pe, forwardPe: fundamentals?.forwardPe, priceToBook: fundamentals?.priceToBook, evToEbitda: fundamentals?.evToEbitda }), [fundamentals]);
  const scenarios = useMemo(() => buildScenarioEngine({ currentValue: Number(investment) || 0, years: Math.max(0, Number(years) || 0), stock: stats ?? undefined, financialPeriods: fundamentals?.periods, pe: fundamentals?.pe, forwardPe: fundamentals?.forwardPe, priceToBook: fundamentals?.priceToBook }), [investment, years, stats, fundamentals]);

  async function analyze() {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) return;
    setLoading(true);
    setMessage('Fetching verified price history and fundamentals…');
    setFinancialMessage(null);
    try {
      const [historyResponse, fundamentalsResponse] = await Promise.all([
        fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(ticker)}/history?from=${new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`),
        fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(ticker)}/fundamentals`),
      ]);
      const history = await historyResponse.json() as HistoryResponse;
      const financial = await fundamentalsResponse.json() as FundamentalsResponse;
      if (!historyResponse.ok || !history.available) throw new Error(history.message ?? 'Verified price history unavailable.');
      setPoints(history.points);
      setFundamentals(financial.available ? financial.data : null);
      setFinancialMessage(financial.message ?? null);
      setSource(history.source ? `${history.source.provider} · ${new Date(history.source.retrievedAt).toLocaleString()}` : null);
      setMessage(financial.available ? `${history.points.length.toLocaleString('en-IN')} price observations + verified financial data loaded.` : `${history.points.length.toLocaleString('en-IN')} price observations loaded; financial data is currently unavailable.`);
    } catch (error) {
      setPoints([]); setFundamentals(null); setSource(null); setFinancialMessage(null);
      setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.');
    } finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Link href="/stocks" style={styles.back}>‹ Stocks</Link><Text style={styles.eyebrow}>INVESTIQ INTELLIGENCE</Text></View>
    <Text style={styles.title}>Investment Intelligence</Text>
    <Text style={styles.subtitle}>One research view combining verified price history, financial quality, valuation signals and transparent scenarios.</Text>

    <View style={styles.card}><Text style={styles.label}>RESEARCH INPUT</Text><TextInput value={symbol} autoCapitalize="characters" onChangeText={setSymbol} placeholder="Stock symbol" placeholderTextColor={colors.muted} style={styles.input}/><View style={styles.inputRow}><TextInput value={investment} onChangeText={setInvestment} keyboardType="numeric" placeholder="Investment" placeholderTextColor={colors.muted} style={styles.input}/><TextInput value={years} onChangeText={setYears} keyboardType="numeric" placeholder="Years" placeholderTextColor={colors.muted} style={[styles.input, styles.smallInput]}/></View><TouchableOpacity onPress={analyze} style={styles.button} disabled={loading}>{loading ? <ActivityIndicator color={colors.background}/> : <Text style={styles.buttonText}>Build research view</Text>}</TouchableOpacity><Text style={styles.muted}>{message}</Text>{source && <Text style={styles.source}>{source}</Text>}{financialMessage && <Text style={styles.warning}>{financialMessage}</Text>}</View>

    <Text style={styles.section}>Market profile</Text><View style={styles.grid}><Metric label="5Y CAGR" value={stats ? pct(stats.cagrPct) : '—'} meta="Historical observation"/><Metric label="Total return" value={stats ? pct(stats.absoluteReturnPct) : '—'} meta="5Y start to end"/><Metric label="Max drawdown" value={stats ? pct(stats.maxDrawdownPct) : '—'} meta="Historical peak to trough"/><Metric label="Volatility" value={stats ? pct(stats.annualizedVolatilityPct) : '—'} meta="Annualized daily-return volatility"/></View>

    <Text style={styles.section}>Financial quality</Text><View style={styles.card}>{quality ? <><View style={styles.scoreRow}><View><Text style={styles.muted}>QUALITY SCORE</Text><Text style={styles.score}>{quality.score}<Text style={styles.scoreSmall}>/100</Text></Text></View><Text style={styles.badge}>{quality.label.toUpperCase()}</Text></View><View style={styles.componentGrid}>{Object.entries(quality.components).map(([key, value]) => <View key={key} style={styles.component}><Text style={styles.muted}>{key}</Text><Text style={styles.componentValue}>{value}</Text></View>)}</View><Text style={styles.label}>EVIDENCE</Text>{quality.evidence.map(item => <Text key={item} style={styles.evidence}>• {item}</Text>)}</> : <Text style={styles.muted}>Verified financial periods are unavailable, so no quality score is manufactured.</Text>}</View>

    <Text style={styles.section}>Financial growth</Text><View style={styles.card}>{trends.length ? trends.map(item => <View key={item.metric} style={styles.trendRow}><View style={styles.trendLeft}><Text style={styles.trendName}>{item.metric}</Text><Text style={styles.muted}>{item.first != null && item.latest != null ? `${item.first.toLocaleString('en-IN', { maximumFractionDigits: 0 })} → ${item.latest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Insufficient verified observations'}</Text></View><View style={styles.trendRight}><Text style={styles.trendDirection}>{item.direction.toUpperCase()}</Text><Text style={styles.trendCagr}>{item.cagrPct != null ? pct(item.cagrPct) : '—'}</Text></View></View>) : <Text style={styles.muted}>No verified multi-period financial history is available.</Text>}</View>

    <Text style={styles.section}>Valuation snapshot</Text><View style={styles.grid}><Metric label="P/E" value={fundamentals?.pe != null ? fundamentals.pe.toFixed(2) : '—'} meta="Provider-reported"/><Metric label="Forward P/E" value={fundamentals?.forwardPe != null ? fundamentals.forwardPe.toFixed(2) : '—'} meta="Provider-reported"/><Metric label="P/B" value={fundamentals?.priceToBook != null ? fundamentals.priceToBook.toFixed(2) : '—'} meta="Provider-reported"/><Metric label="EV / EBITDA" value={fundamentals?.evToEbitda != null ? fundamentals.evToEbitda.toFixed(2) : '—'} meta="Provider-reported"/></View><View style={styles.card}>{flags.length ? <>{flags.map(flag => <Text key={flag} style={styles.warning}>• {flag}</Text>)}<Text style={styles.muted}>These are simple valuation flags, not buy/sell signals.</Text></> : <Text style={styles.muted}>No threshold-based valuation flags were triggered, or valuation inputs are unavailable.</Text>}</View>

    <Text style={styles.section}>Scenario range</Text><View style={styles.card}><Text style={styles.muted}>These are assumption-driven projections. They are not forecasts, recommendations or guarantees.</Text>{scenarios.scenarios.map(item => <View key={item.name} style={styles.scenario}><View style={styles.scenarioLeft}><Text style={styles.scenarioName}>{item.name.toUpperCase()}</Text><Text style={styles.muted}>{item.annualReturnPct.toFixed(2)}% annual assumption · {item.confidence} confidence</Text></View><Text style={styles.scenarioValue}>{money(item.projectedValue, fundamentals?.currency ?? 'INR')}</Text></View>)}{scenarios.warnings.map(warning => <Text key={warning} style={styles.warning}>• {warning}</Text>)}</View>

    <View style={styles.note}><Text style={styles.noteTitle}>Research integrity</Text><Text style={styles.noteText}>InvestIQ keeps verified observations separate from assumptions. Missing provider data remains unavailable. Scenario math never creates market prices, financial results or future certainty.</Text></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:70,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{color:colors.accent,fontSize:13,fontWeight:'800'},eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4},title:{color:colors.text,fontSize:30,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:14,lineHeight:20,marginTop:-9},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:spacing.md},label:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2},inputRow:{flexDirection:'row',gap:8},input:{flex:1,color:colors.text,backgroundColor:colors.surfaceElevated,borderRadius:radius.sm,padding:12,fontSize:14},smallInput:{maxWidth:'35%'},button:{backgroundColor:colors.accent,paddingVertical:13,borderRadius:radius.sm,alignItems:'center'},buttonText:{color:colors.background,fontSize:11,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:16},source:{color:colors.accent,fontSize:9},section:{color:colors.text,fontSize:18,fontWeight:'900',marginBottom:-7},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},metric:{width:'47%',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,minHeight:86},metricValue:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:4},metricMeta:{color:colors.muted,fontSize:8,lineHeight:13,marginTop:3},scoreRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},score:{color:colors.text,fontSize:42,fontWeight:'900',marginTop:3},scoreSmall:{fontSize:15,color:colors.muted},badge:{color:colors.background,backgroundColor:colors.accent,paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill,fontSize:9,fontWeight:'900'},componentGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},component:{width:'30%',backgroundColor:colors.surfaceElevated,borderRadius:radius.sm,padding:9},componentValue:{color:colors.text,fontSize:16,fontWeight:'900',marginTop:3},evidence:{color:colors.text,fontSize:10,lineHeight:16},trendRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderTopWidth:1,borderColor:colors.border},trendLeft:{flex:1,paddingRight:8},trendName:{color:colors.text,fontSize:11,fontWeight:'800'},trendRight:{alignItems:'flex-end'},trendDirection:{color:colors.accent,fontSize:8,fontWeight:'900'},trendCagr:{color:colors.text,fontSize:13,fontWeight:'900',marginTop:2},scenario:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderTopWidth:1,borderColor:colors.border},scenarioLeft:{flex:1,paddingRight:8},scenarioName:{color:colors.accent,fontSize:10,fontWeight:'900'},scenarioValue:{color:colors.text,fontSize:16,fontWeight:'900'},warning:{color:colors.muted,fontSize:9,lineHeight:15},note:{backgroundColor:colors.accentSoft,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,padding:spacing.md},noteTitle:{color:colors.accent,fontSize:10,fontWeight:'900'},noteText:{color:colors.muted,fontSize:9,lineHeight:15,marginTop:5}});
