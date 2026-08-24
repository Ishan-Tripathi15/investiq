import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const PERIODS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'] as const;
type Period = typeof PERIODS[number];
type Point = { timestamp: string; nav: number };
type Response = { available: boolean; points: Point[]; startNav?: number; endNav?: number; returnPercent?: number; message?: string };

export default function MutualFundPerformance({ schemeId }: { schemeId: string }) {
  const [period, setPeriod] = useState<Period>('1Y');
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(null);
    try { const r = await fetch(`${API_URL}/mutual-funds/performance?schemeId=${encodeURIComponent(schemeId)}&period=${period}`); const j = await r.json() as Response; if (!r.ok) throw new Error(j.message ?? 'Unable to load fund performance.'); setData(j); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load fund performance.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [schemeId, period]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.wrap}>
    <View style={styles.header}><Text style={styles.title}>Performance</Text><Text style={styles.muted}>Verified NAV history</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>{PERIODS.map(item => <TouchableOpacity key={item} onPress={() => setPeriod(item)} style={[styles.period, period === item && styles.periodActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>
    {loading ? <View style={styles.state}><ActivityIndicator color={colors.accent}/><Text style={styles.muted}>Loading NAV history…</Text></View> : error ? <View style={styles.state}><Text style={styles.stateTitle}>Performance unavailable</Text><Text style={styles.muted}>{error}</Text><TouchableOpacity onPress={() => void load(true)} style={styles.retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : data?.available ? <View style={styles.card}><View style={styles.metrics}><View><Text style={styles.label}>Start NAV</Text><Text style={styles.value}>₹{data.startNav?.toFixed(2)}</Text></View><View><Text style={styles.label}>End NAV</Text><Text style={styles.value}>₹{data.endNav?.toFixed(2)}</Text></View><View><Text style={styles.label}>Return</Text><Text style={styles.value}>{data.returnPercent == null ? '—' : `${data.returnPercent >= 0 ? '+' : ''}${data.returnPercent.toFixed(2)}%`}</Text></View></View><View style={styles.chart}><Text style={styles.chartTitle}>{data.points.length} verified NAV observations</Text>{data.points.slice(-12).map((point, index) => <View key={`${point.timestamp}-${index}`} style={styles.bar}><Text style={styles.date}>{new Date(point.timestamp).toLocaleDateString()}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, Math.min(100, ((point.nav - Math.min(...data.points.map(x => x.nav))) / Math.max(0.0001, Math.max(...data.points.map(x => x.nav)) - Math.min(...data.points.map(x => x.nav)))) * 100))}%` }]} /></View><Text style={styles.nav}>₹{point.nav.toFixed(2)}</Text></View>)}</View> : <View style={styles.state}><Text style={styles.stateTitle}>No verified performance</Text><Text style={styles.muted}>{data?.message ?? 'The provider returned insufficient NAV history for this period.'}</Text></View>}
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} />
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:spacing.md},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{color:colors.text,fontSize:19,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:15},periods:{gap:6},period:{borderWidth:1,borderColor:colors.border,borderRadius:radius.sm,paddingHorizontal:12,paddingVertical:8,backgroundColor:colors.surface},periodActive:{backgroundColor:colors.accent},periodText:{color:colors.muted,fontSize:9,fontWeight:'900'},periodTextActive:{color:colors.background},state:{padding:spacing.lg,alignItems:'center',gap:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},stateTitle:{color:colors.text,fontSize:14,fontWeight:'900'},retry:{backgroundColor:colors.accent,paddingHorizontal:16,paddingVertical:9,borderRadius:radius.sm},retryText:{color:colors.background,fontSize:10,fontWeight:'900'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:12},metrics:{flexDirection:'row',justifyContent:'space-between'},label:{color:colors.muted,fontSize:8},value:{color:colors.text,fontSize:14,fontWeight:'900',marginTop:3},chart:{gap:8},chartTitle:{color:colors.muted,fontSize:9,fontWeight:'800'},bar:{flexDirection:'row',alignItems:'center',gap:6},date:{color:colors.muted,fontSize:7,width:65},barTrack:{flex:1,height:7,borderRadius:5,backgroundColor:colors.surfaceElevated,overflow:'hidden'},barFill:{height:'100%',backgroundColor:colors.accent,borderRadius:5},nav:{color:colors.text,fontSize:8,width:55,textAlign:'right'}});
