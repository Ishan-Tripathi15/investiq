import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API_URL=process.env.EXPO_PUBLIC_API_URL??'http://localhost:3000/api/v1';
type Point={date:string;value:number};
type History={connected?:boolean;history?:Point[];message?:string};
type Analytics={connected?:boolean;source?:string;observations?:number;timeWeightedReturn?:number|null;annualizedReturn?:number|null;maxDrawdown?:number|null;message?:string};
const pct=(v?:number|null)=>v==null?'—':`${(v*100).toFixed(2)}%`;
const money=(v?:number)=>v==null?'—':`₹${Math.round(v).toLocaleString('en-IN')}`;

export default function PortfolioAnalytics(){
 const[data,setData]=useState<Analytics|null>(null); const[history,setHistory]=useState<History|null>(null); const[loading,setLoading]=useState(true); const[error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);setError(null);try{const token=await getAccessToken();if(!token)throw new Error('Please sign in to view portfolio analytics.');const headers={authorization:`Bearer ${token}`};const [analyticsResponse,historyResponse]=await Promise.all([fetch(`${API_URL}/trading/portfolio/analytics`,{headers}),fetch(`${API_URL}/trading/portfolio/history`,{headers})]);const analytics=await analyticsResponse.json() as Analytics;const verifiedHistory=await historyResponse.json() as History;if(!analyticsResponse.ok)throw new Error(analytics.message??'Verified portfolio analytics are unavailable.');if(!historyResponse.ok)throw new Error(verifiedHistory.message??'Verified portfolio history is unavailable.');setData(analytics);setHistory(verifiedHistory)}catch(e){setError(e instanceof Error?e.message:'Verified portfolio analytics are unavailable.')}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const points=history?.history??[]; const first=points[0]?.value; const latest=points.at(-1)?.value;
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/> }>
  <View style={s.top}><Text style={s.eyebrow}>INVESTIQ / ANALYTICS</Text><Text style={s.live}>{data?.connected?'VERIFIED BROKER':'NO BROKER'}</Text></View>
  <Text style={s.title}>Portfolio analytics</Text><Text style={s.subtitle}>Performance metrics returned by the authenticated analytics service from broker-confirmed history.</Text>
  {loading?<View style={s.center}><ActivityIndicator color={colors.accent}/><Text style={s.muted}>Loading verified analytics…</Text></View>:error?<View style={s.card}><Text style={s.heading}>Analytics unavailable</Text><Text style={s.muted}>{error}</Text></View>:<>
   <View style={s.hero}><Text style={s.label}>Latest portfolio value</Text><Text style={s.heroValue}>{money(latest)}</Text><View style={s.grid}><Metric label="Total return" value={pct(data?.timeWeightedReturn)}/><Metric label="Annualized" value={pct(data?.annualizedReturn)}/><Metric label="Max drawdown" value={pct(data?.maxDrawdown)}/></View></View>
   <Text style={s.section}>Verified performance</Text><View style={s.card}><Metric label="First observation" value={money(first)}/><Metric label="Latest observation" value={money(latest)}/><Text style={s.muted}>{data?.message??`${data?.observations??points.length} verified observations supplied by the analytics service.`}</Text></View>
   <Text style={s.section}>Risk</Text><View style={s.card}><Metric label="Maximum observed drawdown" value={pct(data?.maxDrawdown)}/><Text style={s.muted}>{data?.maxDrawdown==null?'Insufficient verified history.':'Peak-to-trough decline calculated by the server analytics engine.'}</Text></View>
  </>}
  <View style={s.note}><Text style={s.noteTitle}>Analytics integrity</Text><Text style={s.muted}>The mobile app does not independently calculate performance metrics. Values come from the authenticated server analytics endpoint and verified broker history. No synthetic prices, benchmark returns, alpha, sector exposure or risk metrics are generated when verified source data is missing.</Text></View>
 </ScrollView></SafeAreaView>;
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:55,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4},live:{color:colors.accent,fontSize:8,fontWeight:'900'},title:{color:colors.text,fontSize:31,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:-8},center:{alignItems:'center',padding:30,gap:10},hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:8},label:{color:colors.muted,fontSize:9,fontWeight:'800'},heroValue:{color:colors.text,fontSize:30,fontWeight:'900'},grid:{flexDirection:'row',gap:9,marginTop:12},metric:{flex:1,backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:11,gap:4},value:{color:colors.text,fontSize:13,fontWeight:'900'},section:{color:colors.text,fontSize:19,fontWeight:'900'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:13},heading:{color:colors.text,fontSize:15,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:16},note:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md,gap:5},noteTitle:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1}});