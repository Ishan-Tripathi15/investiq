import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

type Intelligence = {
  equity: number;
  investedValue: number;
  cashValue: number;
  cashPct: number;
  concentrationPct: number;
  largestPosition?: { symbol: string; weightPct: number };
  sectorExposure: Array<{ sector: string; marketValue: number; weightPct: number }>;
  betaWeighted?: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  warnings: string[];
  actions: string[];
};
type Scenario = { scenario: string; portfolioValueAfter: number; lossAmount: number; lossPct: number; breachedDailyLimit: boolean; breachedDrawdownLimit: boolean; warnings: string[] };
type Report = { generatedAt: string; source: { provider: string; verified: boolean }; intelligence: Intelligence; riskTwin: { cashPct: number; concentrationPct: number; scenarios: Scenario[]; warnings: string[] } };
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
function money(v: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v); }
function pct(v: number) { return `${v.toFixed(1)}%`; }
function RiskBadge({ level }: { level: Intelligence['riskLevel'] }) { return <View style={[styles.badge, level === 'low' ? styles.low : level === 'moderate' ? styles.moderate : level === 'high' ? styles.high : styles.critical]}><Text style={styles.badgeText}>{level.toUpperCase()}</Text></View>; }
export default function PortfolioIntelligenceScreen() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) { router.replace('/login'); return; }
      const response = await fetch(`${API_URL}/portfolio/intelligence`, { headers: { authorization: `Bearer ${token}` } });
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) throw new Error((await response.text()) || 'Portfolio intelligence is unavailable');
      setReport(await response.json() as Report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load portfolio intelligence'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Building verified portfolio intelligence…</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
    <View><Text style={styles.eyebrow}>AI PORTFOLIO INTELLIGENCE</Text><Text style={styles.title}>Know your risk.</Text><Text style={styles.subtitle}>Deterministic portfolio analytics first. AI explanations come after verified facts.</Text></View>
    {error ? <View style={styles.card}><Text style={styles.cardTitle}>Intelligence unavailable</Text><Text style={styles.muted}>{error}</Text></View> : report && <>
      <View style={styles.hero}><View style={styles.heroTop}><View><Text style={styles.label}>Portfolio health</Text><Text style={styles.heroValue}>{report.intelligence.riskLevel === 'low' ? 'Healthy' : report.intelligence.riskLevel === 'moderate' ? 'Watch' : report.intelligence.riskLevel === 'high' ? 'High risk' : 'Critical risk'}</Text></View><RiskBadge level={report.intelligence.riskLevel} /></View><Text style={styles.muted}>Verified equity · {money(report.intelligence.equity)} · {report.source.provider}</Text></View>
      <View style={styles.grid}><Metric title="Invested" value={money(report.intelligence.investedValue)} /><Metric title="Cash" value={pct(report.intelligence.cashPct)} /><Metric title="Largest position" value={report.intelligence.largestPosition ? `${report.intelligence.largestPosition.symbol} ${pct(report.intelligence.largestPosition.weightPct)}` : '—'} /><Metric title="Portfolio beta" value={report.intelligence.betaWeighted !== undefined ? report.intelligence.betaWeighted.toFixed(2) : '—'} /></View>
      <Section title="Risk signals"><View style={styles.card}>{report.intelligence.warnings.length ? report.intelligence.warnings.map((warning, i) => <View key={i} style={styles.row}><Text style={styles.warningDot}>!</Text><Text style={styles.rowText}>{warning}</Text></View>) : <Text style={styles.muted}>No material concentration, liquidity, or profile mismatch was detected from the supplied verified holdings.</Text>}</View></Section>
      <Section title="Recommended actions"><View style={styles.card}>{report.intelligence.actions.map((action, i) => <View key={i} style={styles.row}><Text style={styles.actionDot}>✓</Text><Text style={styles.rowText}>{action}</Text></View>)}</View></Section>
      <Section title="Sector exposure"><View style={styles.card}>{report.intelligence.sectorExposure.length ? report.intelligence.sectorExposure.map((item, i) => <View key={item.sector} style={[styles.exposure, i === report.intelligence.sectorExposure.length - 1 && styles.noBorder]}><View><Text style={styles.rowTitle}>{item.sector}</Text><Text style={styles.muted}>{money(item.marketValue)}</Text></View><Text style={styles.exposurePct}>{pct(item.weightPct)}</Text></View>) : <Text style={styles.muted}>No verified holdings returned by the broker.</Text>}</View></Section>
      <Section title="Risk Twin stress tests"><View style={styles.card}>{report.riskTwin.scenarios.map((scenario, i) => <View key={scenario.scenario} style={[styles.exposure, i === report.riskTwin.scenarios.length - 1 && styles.noBorder]}><View><Text style={styles.rowTitle}>{scenario.scenario.replaceAll('_', ' ')}</Text><Text style={styles.muted}>Portfolio after stress · {money(scenario.portfolioValueAfter)}</Text></View><Text style={[styles.loss, scenario.breachedDrawdownLimit ? styles.criticalText : styles.warningText]}>-{pct(scenario.lossPct)}</Text></View>)}</View></Section>
      <View style={styles.disclaimer}><Text style={styles.disclaimerText}>Risk Twin scenarios are deterministic stress tests, not forecasts. They use verified account/position values and do not create synthetic market prices or trading outcomes.</Text></View>
      <Text style={styles.sync}>Generated · {new Date(report.generatedAt).toLocaleString()}</Text>
    </>}
  </ScrollView></SafeAreaView>;
}
function Metric({ title, value }: { title: string; value: string }) { return <View style={styles.metric}><Text style={styles.muted}>{title}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:colors.background}, content:{padding:spacing.lg,paddingBottom:48,gap:spacing.lg}, loading:{flex:1,alignItems:'center',justifyContent:'center',gap:spacing.sm}, eyebrow:{color:colors.accent,fontSize:11,fontWeight:'900',letterSpacing:2}, title:{color:colors.text,fontSize:32,fontWeight:'900',marginTop:5}, subtitle:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:6,maxWidth:520}, hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:10}, heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, label:{color:colors.muted,fontSize:11,fontWeight:'700'}, heroValue:{color:colors.text,fontSize:27,fontWeight:'900',marginTop:4}, badge:{borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:6}, badgeText:{color:colors.text,fontSize:9,fontWeight:'900'}, low:{backgroundColor:colors.accentSoft}, moderate:{backgroundColor:colors.surfaceElevated}, high:{backgroundColor:colors.surfaceElevated}, critical:{backgroundColor:colors.surfaceElevated}, grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}, metric:{width:'48%',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md}, metricValue:{color:colors.text,fontSize:14,fontWeight:'900',marginTop:7}, section:{gap:spacing.sm}, sectionTitle:{color:colors.text,fontSize:19,fontWeight:'900'}, card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:13}, row:{flexDirection:'row',gap:10,alignItems:'flex-start'}, warningDot:{color:colors.negative,fontSize:13,fontWeight:'900',width:15,textAlign:'center'}, actionDot:{color:colors.positive,fontSize:13,fontWeight:'900',width:15,textAlign:'center'}, rowText:{color:colors.text,fontSize:12,lineHeight:18,flex:1}, exposure:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderColor:colors.border}, rowTitle:{color:colors.text,fontSize:12,fontWeight:'900',textTransform:'capitalize'}, exposurePct:{color:colors.accent,fontSize:13,fontWeight:'900'}, loss:{fontSize:13,fontWeight:'900'}, warningText:{color:colors.accent}, criticalText:{color:colors.negative}, muted:{color:colors.muted,fontSize:11,lineHeight:16}, noBorder:{borderBottomWidth:0}, disclaimer:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md}, disclaimerText:{color:colors.muted,fontSize:10,lineHeight:15}, sync:{color:colors.muted,fontSize:9}
});
