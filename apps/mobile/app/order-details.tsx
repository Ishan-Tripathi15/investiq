import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

type Order = { orderId?: string; status?: string; symbol?: string; side?: string; type?: string; quantity?: number; filledQuantity?: number; price?: number; averagePrice?: number; stopPrice?: number; orderTimestamp?: string; exchange?: string; product?: string; message?: string };
type Event = { id?: number; type?: string; createdAt?: string; payload?: Record<string, unknown> };

const money = (value?: number) => value == null ? '—' : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const terminal = new Set(['filled', 'cancelled', 'rejected']);

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) { setError('Order id is missing.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in to view this order.');
      const headers = { authorization: `Bearer ${token}` };
      const [orderResponse, eventsResponse] = await Promise.all([
        fetch(`${API_URL}/trading/orders/${encodeURIComponent(id)}`, { headers }),
        fetch(`${API_URL}/trading/events?limit=100`, { headers }),
      ]);
      const orderData = await orderResponse.json() as Order & { message?: string };
      if (!orderResponse.ok) throw new Error(orderData.message ?? 'Unable to retrieve order.');
      const eventData = await eventsResponse.json() as { events?: Event[] };
      setOrder(orderData);
      setEvents((eventData.events ?? []).filter((event) => {
        const payload = event.payload ?? {};
        return payload.orderId === id || payload.order_id === id;
      }).sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to retrieve order.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const status = order?.status?.toLowerCase() ?? 'unknown';
  const filled = order?.filledQuantity ?? 0;
  const quantity = order?.quantity ?? 0;
  const progress = quantity > 0 ? Math.min(1, filled / quantity) : 0;
  const isTerminal = terminal.has(status);

  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <View style={s.top}><Link href="/orders" style={s.back}>‹ Orders</Link><Text style={s.eyebrow}>EXECUTION DETAIL</Text></View>
      {loading ? <View style={s.center}><ActivityIndicator color={colors.accent}/><Text style={s.muted}>Loading broker-confirmed order…</Text></View> : error ? <View style={s.card}><Text style={s.title}>Order unavailable</Text><Text style={s.muted}>{error}</Text><TouchableOpacity onPress={() => void load()} style={s.button}><Text style={s.buttonText}>Retry</Text></TouchableOpacity></View> : order ? <>
        <View style={s.hero}><View><Text style={s.symbol}>{order.symbol ?? '—'}</Text><Text style={s.muted}>{order.exchange ?? ''} · {order.type ?? '—'} · {order.product ?? '—'}</Text></View><Text style={[s.side, status === 'rejected' || status === 'cancelled' ? s.warning : s.success]}>{status.toUpperCase()}</Text></View>
        <View style={s.progressCard}><View style={s.row}><Text style={s.label}>EXECUTION PROGRESS</Text><Text style={s.value}>{filled.toLocaleString('en-IN')} / {quantity.toLocaleString('en-IN')}</Text></View><View style={s.track}><View style={[s.fill, { width: `${progress * 100}%` }]} /></View><View style={s.row}><Text style={s.muted}>Filled</Text><Text style={s.muted}>{Math.round(progress * 100)}%</Text></View></View>
        <View style={s.card}><Text style={s.label}>ORDER SUMMARY</Text><Row label="Side" value={(order.side ?? '—').toUpperCase()} /><Row label="Status" value={status.toUpperCase()} /><Row label="Quantity" value={quantity.toLocaleString('en-IN')} /><Row label="Filled" value={filled.toLocaleString('en-IN')} /><Row label="Limit price" value={money(order.price)} /><Row label="Stop price" value={money(order.stopPrice)} /><Row label="Average fill" value={money(order.averagePrice)} /><Row label="Order ID" value={order.orderId ?? id} /><Row label="Placed" value={order.orderTimestamp ? new Date(order.orderTimestamp).toLocaleString() : '—'} /></View>
        <View style={s.card}><View style={s.row}><Text style={s.label}>EXECUTION TIMELINE</Text><Text style={s.muted}>{events.length} events</Text></View>{events.length ? events.map((event, index) => <View key={`${event.id ?? 'event'}-${index}`} style={s.event}><View style={s.eventRail}><View style={s.eventDot}/>{index < events.length - 1 && <View style={s.eventLine}/>}</View><View style={s.eventCopy}><Text style={s.eventTitle}>{(event.type ?? 'ORDER_EVENT').replaceAll('_', ' ')}</Text><Text style={s.muted}>{event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Timestamp unavailable'}</Text></View></View>) : <Text style={s.muted}>{isTerminal ? 'No matching audit events were returned for this terminal order.' : 'No matching audit events have been returned yet.'}</Text>}</View>
        <View style={s.integrity}><Text style={s.label}>EXECUTION INTEGRITY</Text><Text style={s.muted}>This screen displays broker-confirmed order state and InvestIQ audit events. No fills or transitions are inferred when broker data is unavailable.</Text></View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}
function Row({ label, value }: { label: string; value: string }) { return <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:colors.background}, content:{padding:spacing.lg,paddingBottom:60,gap:spacing.lg}, top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, back:{color:colors.accent,fontSize:13,fontWeight:'800'}, eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4}, center:{alignItems:'center',padding:30,gap:10}, hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, symbol:{color:colors.text,fontSize:28,fontWeight:'900'}, side:{fontSize:11,fontWeight:'900'}, success:{color:colors.accent}, warning:{color:colors.warning}, card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:spacing.md}, progressCard:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:9}, label:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2}, value:{color:colors.text,fontSize:11,fontWeight:'900',maxWidth:'65%',textAlign:'right'}, muted:{color:colors.muted,fontSize:10,lineHeight:16}, row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}, track:{height:9,backgroundColor:colors.border,borderRadius:5,overflow:'hidden'}, fill:{height:9,backgroundColor:colors.accent,borderRadius:5}, event:{flexDirection:'row',gap:12,minHeight:52}, eventRail:{width:14,alignItems:'center'}, eventDot:{width:9,height:9,borderRadius:5,backgroundColor:colors.accent,marginTop:3}, eventLine:{width:1,flex:1,backgroundColor:colors.border,marginTop:4}, eventCopy:{flex:1,gap:3}, eventTitle:{color:colors.text,fontSize:11,fontWeight:'900',textTransform:'capitalize'}, integrity:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md,gap:6}, button:{alignSelf:'flex-start',backgroundColor:colors.accent,paddingHorizontal:18,paddingVertical:10,borderRadius:radius.sm}, buttonText:{color:colors.background,fontWeight:'900',fontSize:10} });
