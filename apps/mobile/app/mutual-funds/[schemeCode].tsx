import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
type Fund = { schemeCode: string; schemeName: string; nav?: number; date?: string; category?: string; isinGrowth?: string; isinReinvestment?: string };
type Response = { available: boolean; scheme: Fund | null; source: { provider: string; retrievedAt: string } | null; message?: string };

export default function MutualFundDetail() {
  const { schemeCode } = useLocalSearchParams<{ schemeCode: string }>();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/mutual-funds/detail?schemeCode=${encodeURIComponent(schemeCode ?? '')}`);
      const json = await response.json() as Response;
      if (!response.ok) throw new Error(json.message ?? 'Unable to load mutual-fund details.');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load mutual-fund details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schemeCode]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <SafeAreaView style={s.safe}><View style={s.state}><ActivityIndicator color={colors.accent} /><Text style={s.muted}>Loading verified fund details…</Text></View></SafeAreaView>;
  if (error) return <SafeAreaView style={s.safe}><View style={s.state}><Text style={s.stateTitle}>Fund details unavailable</Text><Text style={s.muted}>{error}</Text></View></SafeAreaView>;

  const fund = data?.scheme;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
    <Text style={s.eyebrow}>MUTUAL FUND</Text>
    <Text style={s.title}>{fund?.schemeName ?? 'Fund unavailable'}</Text>
    <Text style={s.subtitle}>{fund?.category ?? 'Category unavailable'} · Scheme {fund?.schemeCode ?? schemeCode}</Text>
    <View style={s.hero}><Text style={s.label}>Latest verified NAV</Text><Text style={s.nav}>{fund?.nav == null ? 'NAV unavailable' : `₹${fund.nav.toFixed(4)}`}</Text><Text style={s.muted}>{fund?.date ? `As of ${fund.date}` : 'NAV date unavailable'}</Text></View>
    <View style={s.card}><Row label="Scheme code" value={fund?.schemeCode ?? '—'} /><Row label="Category" value={fund?.category ?? '—'} /><Row label="Growth ISIN" value={fund?.isinGrowth ?? '—'} /><Row label="Reinvestment ISIN" value={fund?.isinReinvestment ?? '—'} /><Row label="Data provider" value={data?.source?.provider ?? 'Unavailable'} /></View>
    {!fund ? <View style={s.empty}><Text style={s.stateTitle}>Verified scheme not found</Text><Text style={s.muted}>{data?.message ?? 'The configured provider did not return this scheme.'}</Text></View> : null}
  </ScrollView></SafeAreaView>;
}
function Row({ label, value }: { label: string; value: string }) { return <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:colors.background}, content:{padding:spacing.lg,gap:spacing.md}, eyebrow:{color:colors.accent,fontSize:11,fontWeight:'900',letterSpacing:2}, title:{color:colors.text,fontSize:25,fontWeight:'900',lineHeight:32}, subtitle:{color:colors.muted,fontSize:11,lineHeight:17}, hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:6}, label:{color:colors.muted,fontSize:10,fontWeight:'800'}, nav:{color:colors.text,fontSize:32,fontWeight:'900'}, card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md}, row:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border}, value:{color:colors.text,fontSize:10,fontWeight:'800',maxWidth:'62%',textAlign:'right'}, muted:{color:colors.muted,fontSize:10,lineHeight:15}, state:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:spacing.lg}, stateTitle:{color:colors.text,fontSize:14,fontWeight:'900'}, empty:{padding:spacing.lg,backgroundColor:colors.surface,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,gap:6} });