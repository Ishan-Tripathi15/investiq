import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API_URL=process.env.EXPO_PUBLIC_API_URL??'http://localhost:3000/api/v1';
type Point={date?:string;value?:number};
type Data={connected?:boolean;history?:Point[];message?:string};
const pct=(v:number|null)=>v==null?'—':`${(v*100).toFixed(2)}%`;
const money=(v:number)=>`₹${Math.round(v).toLocaleString('en-IN')}`;

function analytics(points:Point[]){
 const ordered=points.filter(x=>x.date&&Number.isFinite(x.value)&&x.value!>=0).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(ordered.length<2)return {tw:null,annual:null,drawdown:null,start:null,end:null};
 const start=ordered[0].value!; const end=ordered.at(-1)!.value!;
 const startMs=new Date(ordered[0].date!).getTime(); const endMs=new Date(ordered.at(-1)!.date!).getTime();
 const years=(endMs-startMs)/(365.25*24*60*60*1000);
 let peak=start; let worst=0;
 for(const p of ordered){peak=Math.max(peak,p.value!);if(peak>0)worst=Math.min(worst,p.value!/peak-1)}
 return {tw:start>0?end/start-1:null,annual:years>0&&start>0?Math.pow(end/start,1/years)-1:null,drawdown:worst,start,end};
}

export default function PortfolioAnalytics(){
 const[data,setData]=useState<Data|null>(null); const[loading,setLoading]=useState(true); const[error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);setError(null);try{const token=await getAccessToken();if(!token)throw new Error('Please sign in to view portfolio analytics.');const r=await fetch(`${API_URL}/trading/portfolio/history`,{headers:{authorization:`Bearer ${token}`}});const j=await r.json() as Data;if(!r.ok)throw new Error(j.message??'Verified portfolio history is unavailable.');setData(j)}catch(e){setError(e instanceof Error?e.message:'Verified portfolio history is unavailable.')}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const a=useMemo(()=>analytics(data?.history??[]),[data?.history]);
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/> }>
  <View style={s.top}><Text style={s.eyebrow}>INVESTIQ / ANALYTICS</Text><Text style={s.live}>{data?.connected?'VERIFIED BROKER':'NO BROKER'}</Text></View>
  <Text style={s.title}>Portfolio analytics</Text><Text style={s.subtitle}>Performance metrics calculated only from broker-confirmed portfolio history.</Text>
  {loading?<View style={s.center}><ActivityIndicator color={colors.accent}/><Text style={s.muted}>Loading verified history…</Text></View>:error?<View style={s.card}><Text style={s.heading}>Analytics unavailable</Text><Text style={s.muted}>{error}</Text></View>:<>
   <View style={s.hero}><Text style={s.label}>Latest portfolio value</Text><Text style={s.heroValue}>{a.end!=null?money(a.end):'—'}</Text><View style={s.grid}><Metric label="Total return" value={pct(a.tw)}/><Metric label="Annualized" value={pct(a.annual)}/><Metric label="Max drawdown" value={pct(a.drawdown)}/></View></View>
   <Text style={s.section}>Verified performance</Text><View style={s.card}><Metric label="First observation" value={a.start!=null?money(a.start):'—'}/><Metric label="Latest observation" value={a.end!=null?money(a.end):'—'}/><Text style={s.muted}>{a.tw==null?'At least two valid broker observations are required before a return series is shown.':'Returns are calculated from the verified observation series; deposits and withdrawals are not yet attributed at the observation level.'}</Text></View>
   <Text style={s.section}>Risk</Text><View style={s.card}><Metric label="Maximum observed drawdown" value={pct(a.drawdown)}/><Text style={s.muted}>{a.drawdown==null?'Insufficient verified history.':'Peak-to-trough decline across the available verified observations.'}</Text></View>
  </>}
  <View style={s.note}><Text style={s.noteTitle}>Analytics integrity</Text><Text style={s.muted}>No synthetic prices, benchmark returns, alpha, sector exposure or risk metrics are generated when verified source data is missing. Cash-flow-aware attribution remains separate until broker cash-flow records are available.</Text></View>
 </ScrollView></SafeAreaView>;
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:55,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4},live:{color:colors.accent,fontSize:8,fontWeight:'900'},title:{color:colors.text,fontSize:31,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:-8},center:{alignItems:'center',padding:30,gap:10},hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:8},label:{color:colors.muted,fontSize:9,fontWeight:'800'},heroValue:{color:colors.text,fontSize:30,fontWeight:'900'},grid:{flexDirection:'row',gap:9,marginTop:12},metric:{flex:1,backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:11,gap:4},value:{color:colors.text,fontSize:13,fontWeight:'900'},section:{color:colors.text,fontSize:19,fontWeight:'900'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:13},heading:{color:colors.text,fontSize:15,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:16},note:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md,gap:5},noteTitle:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1}});