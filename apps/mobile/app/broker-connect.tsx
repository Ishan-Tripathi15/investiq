import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
type Connection = { connected: boolean; provider: string; brokerUserId?: string; connectedAt?: string; updatedAt?: string };

export default function BrokerConnectScreen() {
  const [status, setStatus] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in before connecting a broker.');
      const response = await fetch(`${API_URL}/trading/broker/connection`, { headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? 'Unable to retrieve broker connection status.');
      setStatus(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to retrieve broker connection status.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    setBusy(true); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in before connecting a broker.');
      const response = await fetch(`${API_URL}/trading/broker/zerodha/connect`, { headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data?.loginUrl) throw new Error(data?.message ?? 'Unable to start Zerodha authentication.');
      await Linking.openURL(data.loginUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start Zerodha authentication.'); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in before disconnecting a broker.');
      const response = await fetch(`${API_URL}/trading/broker/connection`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? 'Unable to disconnect broker.');
      setStatus(data); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to disconnect broker.'); }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} />}>
    <Text style={styles.eyebrow}>INVESTIQ / BROKER</Text>
    <Text style={styles.title}>Connect your broker.</Text>
    <Text style={styles.subtitle}>Authenticate directly with Zerodha. InvestIQ never asks for or stores your Zerodha password.</Text>
    {error ? <View style={styles.error}><Text style={styles.errorTitle}>Connection unavailable</Text><Text style={styles.muted}>{error}</Text></View> : null}
    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.label}>Execution provider</Text><Text style={styles.provider}>Zerodha · Kite</Text></View><View style={[styles.pill, status?.connected ? styles.live : styles.off]}><Text style={styles.pillText}>{status?.connected ? 'CONNECTED' : 'NOT CONNECTED'}</Text></View></View>
      <Text style={styles.muted}>{status?.connected ? `Connected broker account: ${status.brokerUserId ?? 'verified'}` : 'A broker connection is required before InvestIQ can place live orders.'}</Text>
      {status?.connected ? <Text style={styles.sync}>Last connection update · {status.updatedAt ? new Date(status.updatedAt).toLocaleString() : 'available'}</Text> : null}
    </View>
    <View style={styles.card}><Text style={styles.section}>Secure authentication</Text><Bullet text="You are redirected to Zerodha for authentication."/><Bullet text="InvestIQ receives a short-lived request token through the registered callback."/><Bullet text="The server exchanges it for the broker session."/><Bullet text="The broker access token is encrypted before storage."/><Bullet text="Live execution remains blocked unless the authenticated broker session is active."/></View>
    {!status?.connected ? <TouchableOpacity style={styles.button} onPress={()=>void connect()} disabled={busy}>{busy?<ActivityIndicator/>:<Text style={styles.buttonText}>Connect Zerodha</Text>}</TouchableOpacity> : <TouchableOpacity style={styles.secondary} onPress={()=>void disconnect()} disabled={busy}>{busy?<ActivityIndicator/>:<Text style={styles.secondaryText}>Disconnect broker</Text>}</TouchableOpacity>}
    <View style={styles.note}><Text style={styles.noteTitle}>Before going live</Text><Text style={styles.muted}>Your deployment must have the Kite API key, API secret and registered redirect URL configured as server-side environment variables. Never commit these credentials to GitHub or the mobile bundle.</Text></View>
  </ScrollView></SafeAreaView>;
}
function Bullet({text}:{text:string}){return <View style={styles.bullet}><Text style={styles.dot}>•</Text><Text style={styles.muted}>{text}</Text></View>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:48,gap:spacing.lg},eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.6},title:{color:colors.text,fontSize:30,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:-8},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:12},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},label:{color:colors.muted,fontSize:10,fontWeight:'800'},provider:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:4},pill:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill},live:{backgroundColor:colors.accentSoft},off:{backgroundColor:colors.surfaceElevated},pillText:{color:colors.text,fontSize:8,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:16},sync:{color:colors.accent,fontSize:9,fontWeight:'800'},section:{color:colors.text,fontSize:16,fontWeight:'900'},bullet:{flexDirection:'row',gap:8},dot:{color:colors.accent,fontSize:14},button:{backgroundColor:colors.accent,borderRadius:radius.md,paddingVertical:14,alignItems:'center'},buttonText:{color:colors.background,fontSize:12,fontWeight:'900'},secondary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingVertical:14,alignItems:'center'},secondaryText:{color:colors.text,fontSize:12,fontWeight:'900'},error:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:5},errorTitle:{color:colors.text,fontSize:13,fontWeight:'900'},note:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md,gap:5},noteTitle:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1}});