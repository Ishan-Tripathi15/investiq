import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { getAccessToken } from '@/auth';

type Item = { symbol: string; addedAt: string };
type Quote = { price: number; change?: number; changePercent?: number; currency?: string };
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function money(value?: number, currency = 'INR') { if (value == null) return '—'; return currency === 'INR' ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
function pct(value?: number) { return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }

export default function WatchlistScreen() {
  const [items, setItems] = useState<Item[]>([]); const [quotes, setQuotes] = useState<Record<string, Quote>>({}); const [loading, setLoading] = useState(true); const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) { setItems([]); setMessage('Sign in to use your personal watchlist.'); return; }
      const response = await fetch(`${API_URL}/watchlist`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to load your watchlist.');
      const data = await response.json() as Item[]; setItems(data);
      const entries = await Promise.all(data.map(async item => { try { const r = await fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(item.symbol)}/quote`); const q = await r.json() as { available?: boolean; quote?: Quote }; return q.available && q.quote ? [item.symbol, q.quote] as const : null; } catch { return null; } }));
      setQuotes(Object.fromEntries(entries.filter((x): x is readonly [string, Quote] => Boolean(x))));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function remove(symbol: string) { const token = await getAccessToken(); if (!token) return; await fetch(`${API_URL}/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); setItems(current => current.filter(item => item.symbol !== symbol)); setQuotes(current => { const next = { ...current }; delete next[symbol]; return next; }); }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.top}><Link href="/" style={styles.back}>‹ Home</Link><Text style={styles.eyebrow}>PERSONAL MARKET LIST</Text></View>
    <Text style={styles.title}>Watchlist</Text><Text style={styles.subtitle}>Your saved Indian-market instruments with verified quote refresh.</Text>
    {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent}/></View> : message ? <View style={styles.empty}><Text style={styles.emptyTitle}>{message}</Text><Link href="/login" style={styles.link}>Sign in</Link></View> : items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Your watchlist is empty</Text><Text style={styles.muted}>Open a stock and add it to keep it here.</Text></View> : <View style={styles.list}>{items.map(item => { const q=quotes[item.symbol]; return <View key={item.symbol} style={styles.row}><Link href={`/stock/${encodeURIComponent(item.symbol)}`} style={styles.rowMain}><Text style={styles.symbol}>{item.symbol}</Text><Text style={styles.muted}>Saved {new Date(item.addedAt).toLocaleDateString()}</Text></Link><View style={styles.quote}><Text style={styles.price}>{money(q?.price,q?.currency)}</Text><Text style={[styles.change,(q?.changePercent ?? 0)<0&&styles.negative]}>{pct(q?.changePercent)}</Text></View><TouchableOpacity onPress={()=>void remove(item.symbol)}><Text style={styles.remove}>×</Text></TouchableOpacity></View>; })}</View>}
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:50,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between'},back:{color:colors.accent,fontSize:13,fontWeight:'800'},eyebrow:{color:colors.muted,fontSize:9,letterSpacing:1.3,fontWeight:'900'},title:{color:colors.text,fontSize:32,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:13,lineHeight:19},list:{gap:spacing.sm},row:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:10},rowMain:{flex:1},symbol:{color:colors.text,fontSize:15,fontWeight:'900'},quote:{alignItems:'flex-end'},price:{color:colors.text,fontSize:13,fontWeight:'900'},change:{color:colors.positive,fontSize:10,fontWeight:'800',marginTop:2},negative:{color:colors.negative},remove:{color:colors.muted,fontSize:24,paddingHorizontal:5},muted:{color:colors.muted,fontSize:9,lineHeight:15},empty:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:8},emptyTitle:{color:colors.text,fontSize:15,fontWeight:'900'},link:{color:colors.accent,fontWeight:'900'},loading:{paddingVertical:80,alignItems:'center'}});
