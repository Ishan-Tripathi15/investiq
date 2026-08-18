import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
type Period = { fiscalDate: string; revenue?: number; grossProfit?: number; ebit?: number; ebitda?: number; netIncome?: number; eps?: number; operatingCashFlow?: number; freeCashFlow?: number; totalDebt?: number; totalCash?: number; grossMarginPct?: number; operatingMarginPct?: number; netMarginPct?: number };
type Fundamentals = { symbol: string; name?: string; currency?: string; exchange?: string; marketCap?: number; enterpriseValue?: number; pe?: number; forwardPe?: number; peg?: number; priceToSales?: number; priceToBook?: number; evToRevenue?: number; evToEbitda?: number; revenue?: number; ebitda?: number; netIncome?: number; eps?: number; operatingCashFlow?: number; freeCashFlow?: number; totalDebt?: number; totalCash?: number; roe?: number; roa?: number; grossMarginPct?: number; operatingMarginPct?: number; netMarginPct?: number; insiderOwnershipPct?: number; institutionalOwnershipPct?: number; periods: Period[] };
type Response = { available: boolean; data: Fundamentals | null; source: { provider: string; retrievedAt: string } | null; message?: string };

function money(value?: number) { if (value == null || !Number.isFinite(value)) return '—'; const abs = Math.abs(value); const sign = value < 0 ? '-' : ''; if (abs >= 1e12) return `${sign}₹${(abs / 1e12).toFixed(2)}T`; if (abs >= 1e9) return `${sign}₹${(abs / 1e9).toFixed(2)}B`; if (abs >= 1e6) return `${sign}₹${(abs / 1e6).toFixed(2)}M`; return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function pct(value?: number) { return value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function cagr(first?: number, last?: number, years = 1) { return first == null || last == null || first <= 0 || last <= 0 || years <= 0 ? undefined : (Math.pow(last / first, 1 / years) - 1) * 100; }
function Metric({ label, value, meta }: { label: string; value: string; meta: string }) { return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.value}>{value}</Text><Text style={styles.meta}>{meta}</Text></View>; }

export default function FinancialLab() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [data, setData] = useState<Fundamentals | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState('Load verified company fundamentals.');
  const [loading, setLoading] = useState(false);

  async function load() {
    const ticker = symbol.trim().toUpperCase(); if (!ticker) return;
    setLoading(true); setMessage('Fetching verified financial statements…');
    try {
      const response = await fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(ticker)}/fundamentals`);
      const body = await response.json() as Response;
      if (!response.ok || !body.available || !body.data) throw new Error(body.message ?? 'Verified fundamentals are unavailable.');
      setData(body.data); setSource(body.source ? `${body.source.provider} · ${new Date(body.source.retrievedAt).toLocaleString()}` : null); setMessage(`${body.data.periods.length} annual financial periods loaded.`);
    } catch (error) { setData(null); setSource(null); setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.'); }
    finally { setLoading(false); }
  }

  const periods = useMemo(() => [...(data?.periods ?? [])].sort((a, b) => a.fiscalDate.localeCompare(b.fiscalDate)), [data]);
  const first = periods[0]; const last = periods[periods.length - 1];
  const years = first && last ? Math.max(1, (new Date(last.fiscalDate).getTime() - new Date(first.fiscalDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 1;
  const revenueGrowth = first && last ? cagr(first.revenue, last.revenue, years) : undefined;
  const profitGrowth = first && last ? cagr(first.netIncome, last.netIncome, years) : undefined;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Link href="/stock-lab" style={styles.back}>‹ Stock Lab</Link><Text style={styles.eyebrow}>FINANCIAL INTELLIGENCE</Text></View>
    <Text style={styles.title}>Financial Intelligence</Text><Text style={styles.subtitle}>Read company fundamentals separately from price action.</Text>
    <View style={styles.search}><TextInput value={symbol} autoCapitalize="characters" onChangeText={setSymbol} onSubmitEditing={load} placeholder="Stock symbol" placeholderTextColor={colors.muted} style={styles.input}/><TouchableOpacity onPress={load} disabled={loading} style={styles.button}>{loading ? <ActivityIndicator color={colors.background}/> : <Text style={styles.buttonText}>Analyze</Text>}</TouchableOpacity></View>
    <Text style={styles.muted}>{message}</Text>{source && <Text style={styles.source}>{source}</Text>}
    {data && <>
      <View style={styles.identity}><View><Text style={styles.company}>{data.name ?? data.symbol}</Text><Text style={styles.muted}>{data.symbol} · {data.exchange ?? 'Exchange unavailable'} · {data.currency ?? 'Currency unavailable'}</Text></View><Text style={styles.badge}>VERIFIED</Text></View>
      <Text style={styles.section}>Current financial snapshot</Text>
      <View style={styles.grid}><Metric label="Revenue" value={money(data.revenue)} meta="TTM"/><Metric label="EBITDA" value={money(data.ebitda)} meta="TTM"/><Metric label="Net income" value={money(data.netIncome)} meta="TTM"/><Metric label="Free cash flow" value={money(data.freeCashFlow)} meta="TTM / provider"/><Metric label="Total debt" value={money(data.totalDebt)} meta="Most recent quarter"/><Metric label="Cash" value={money(data.totalCash)} meta="Most recent quarter"/><Metric label="ROE" value={pct(data.roe)} meta="Provider metric"/><Metric label="ROA" value={pct(data.roa)} meta="Provider metric"/></View>
      <Text style={styles.section}>Valuation</Text><View style={styles.grid}><Metric label="P/E" value={data.pe?.toFixed(2) ?? '—'} meta="Trailing"/><Metric label="Forward P/E" value={data.forwardPe?.toFixed(2) ?? '—'} meta="Provider"/><Metric label="P/B" value={data.priceToBook?.toFixed(2) ?? '—'} meta="MRQ"/><Metric label="P/S" value={data.priceToSales?.toFixed(2) ?? '—'} meta="TTM"/><Metric label="EV / EBITDA" value={data.evToEbitda?.toFixed(2) ?? '—'} meta="Provider"/><Metric label="EV / Revenue" value={data.evToRevenue?.toFixed(2) ?? '—'} meta="Provider"/></View>
      <Text style={styles.section}>10-year financial trajectory</Text>
      <View style={styles.card}><Text style={styles.muted}>Annual reported periods returned by the verified provider.</Text><View style={styles.tableHead}><Text style={styles.head}>YEAR</Text><Text style={styles.head}>REVENUE</Text><Text style={styles.head}>EBITDA</Text><Text style={styles.head}>NET PROFIT</Text></View>{periods.slice(-10).reverse().map(period => <View key={period.fiscalDate} style={styles.row}><Text style={styles.cell}>{period.fiscalDate.slice(0, 4)}</Text><Text style={styles.cell}>{money(period.revenue)}</Text><Text style={styles.cell}>{money(period.ebitda)}</Text><Text style={styles.cell}>{money(period.netIncome)}</Text></View>)}</View>
      <View style={styles.grid}><Metric label="Revenue CAGR" value={pct(revenueGrowth)} meta="First to latest reported period"/><Metric label="Profit CAGR" value={pct(profitGrowth)} meta="First to latest reported period"/><Metric label="Latest operating margin" value={pct(last?.operatingMarginPct)} meta="Latest reported period"/><Metric label="Latest net margin" value={pct(last?.netMarginPct)} meta="Latest reported period"/></View>
      <View style={styles.note}><Text style={styles.noteTitle}>Important data note</Text><Text style={styles.noteText}>Financial statements are reported-company data, not analyst forecasts. Missing metrics remain unavailable. InvestIQ does not infer a value when the provider does not return one.</Text></View>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:60,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{color:colors.accent,fontSize:13,fontWeight:'800'},eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.3},title:{color:colors.text,fontSize:30,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:14,lineHeight:20,marginTop:-9},search:{flexDirection:'row',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingLeft:12,alignItems:'center'},input:{flex:1,color:colors.text,paddingVertical:13,fontSize:14},button:{backgroundColor:colors.accent,paddingVertical:11,paddingHorizontal:16,borderRadius:radius.sm,marginRight:5,minWidth:72,alignItems:'center'},buttonText:{color:colors.background,fontSize:11,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:16},source:{color:colors.accent,fontSize:9},identity:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,flexDirection:'row',justifyContent:'space-between'},company:{color:colors.text,fontSize:18,fontWeight:'900'},badge:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:1},section:{color:colors.text,fontSize:18,fontWeight:'900',marginBottom:-7},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},metric:{width:'47%',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,minHeight:82},value:{color:colors.text,fontSize:17,fontWeight:'900',marginTop:4},meta:{color:colors.muted,fontSize:8,marginTop:3,lineHeight:13},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md},tableHead:{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:1,borderColor:colors.border,paddingVertical:10},head:{color:colors.muted,fontSize:8,fontWeight:'900',width:'24%'},row:{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:1,borderColor:colors.border,paddingVertical:10},cell:{color:colors.text,fontSize:9,width:'24%'},note:{backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md},noteTitle:{color:colors.accent,fontSize:10,fontWeight:'900'},noteText:{color:colors.muted,fontSize:9,lineHeight:15,marginTop:5}});
