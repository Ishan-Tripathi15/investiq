import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

type Scenario = { label: string; rate: number; value: number };
const money = (v: number) => `₹${Math.max(0, Math.round(v)).toLocaleString('en-IN')}`;
const num = (v: string, fallback: number) => { const n = Number(v.replace(/,/g, '')); return Number.isFinite(n) && n >= 0 ? n : fallback; };
const calc = (monthly: number, annualRate: number, years: number, stepUpPct: number) => {
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = annualRate / 100 / 12;
  let balance = 0;
  let contribution = monthly;
  let invested = 0;
  for (let month = 1; month <= months; month += 1) {
    balance = balance * (1 + monthlyRate) + contribution;
    invested += contribution;
    if (month % 12 === 0) contribution *= 1 + stepUpPct / 100;
  }
  return { value: balance, invested, profit: balance - invested };
};

export default function SipCalculator() {
  const [monthly, setMonthly] = useState('10000');
  const [years, setYears] = useState('10');
  const [stepUp, setStepUp] = useState('10');
  const [inflation, setInflation] = useState('6');
  const [target, setTarget] = useState('2500000');
  const m = num(monthly, 10000); const y = num(years, 10); const s = num(stepUp, 10); const inf = num(inflation, 6); const goal = num(target, 2500000);
  const scenarios = useMemo<Scenario[]>(() => [8, 12, 15].map((rate, i) => ({ label: i === 0 ? 'Conservative' : i === 1 ? 'Base case' : 'Optimistic', rate, value: calc(m, rate, y, s).value })), [m, s, y]);
  const base = calc(m, 12, y, s); const futureGoal = goal * Math.pow(1 + inf / 100, y); const goalGap = Math.max(0, futureGoal - base.value);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Link href="/funds" style={styles.back}>‹ Mutual Funds</Link><Text style={styles.eyebrow}>INVESTIQ / CALCULATOR</Text></View>
    <Text style={styles.title}>SIP Calculator</Text><Text style={styles.subtitle}>Model recurring contributions with annual step-up and inflation-aware goals.</Text>
    <View style={styles.card}><Field label="Monthly SIP" value={monthly} onChangeText={setMonthly} prefix="₹"/><Field label="Time horizon" value={years} onChangeText={setYears} suffix="years"/><Field label="Annual SIP step-up" value={stepUp} onChangeText={setStepUp} suffix="%"/><Field label="Inflation assumption" value={inflation} onChangeText={setInflation} suffix="%"/></View>
    <View style={styles.hero}><Text style={styles.muted}>Base-case projected corpus</Text><Text style={styles.heroValue}>{money(base.value)}</Text><Text style={styles.heroMeta}>12% annual return assumption · {y} years</Text><View style={styles.heroRow}><View><Text style={styles.muted}>Invested</Text><Text style={styles.smallValue}>{money(base.invested)}</Text></View><View><Text style={styles.muted}>Projected gain</Text><Text style={styles.smallValue}>{money(base.profit)}</Text></View></View></View>
    <Text style={styles.section}>Scenario range</Text><View style={styles.card}>{scenarios.map(x => <View key={x.label} style={styles.row}><View><Text style={styles.rowTitle}>{x.label}</Text><Text style={styles.muted}>{x.rate}% annual assumption</Text></View><Text style={styles.rowValue}>{money(x.value)}</Text></View>)}</View>
    <Text style={styles.section}>Inflation-aware goal check</Text><View style={styles.card}><Field label="Goal in today's money" value={target} onChangeText={setTarget} prefix="₹"/><Text style={styles.muted}>At {inf}% inflation, the goal becomes approximately:</Text><Text style={styles.goal}>{money(futureGoal)}</Text><Text style={styles.muted}>{goalGap === 0 ? 'Your base-case projection covers this inflation-adjusted goal.' : `Projected shortfall under the base case: ${money(goalGap)}.`}</Text></View>
    <View style={styles.note}><Text style={styles.noteTitle}>Important</Text><Text style={styles.noteText}>These are mathematical scenarios, not forecasts or personalized investment advice. Actual mutual-fund returns can be higher, lower, or negative. Inflation is an assumption and is not a prediction.</Text></View>
  </ScrollView></SafeAreaView>;
}
function Field({ label, value, onChangeText, prefix, suffix }: { label: string; value: string; onChangeText: (value: string) => void; prefix?: string; suffix?: string }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputRow}>{prefix ? <Text style={styles.affix}>{prefix}</Text> : null}<TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" style={styles.input}/>{suffix ? <Text style={styles.affix}>{suffix}</Text> : null}</View></View>; }
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:52,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{color:colors.accent,fontSize:13,fontWeight:'700'},eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4},title:{color:colors.text,fontSize:32,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:13,lineHeight:19,marginTop:-8},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:14},field:{gap:7},label:{color:colors.muted,fontSize:10,fontWeight:'800'},inputRow:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:12},affix:{color:colors.muted,fontWeight:'800'},input:{flex:1,color:colors.text,fontSize:17,fontWeight:'800',paddingVertical:12,paddingHorizontal:7},hero:{backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:6},muted:{color:colors.muted,fontSize:10,lineHeight:16},heroValue:{color:colors.text,fontSize:34,fontWeight:'900'},heroMeta:{color:colors.accent,fontSize:10,fontWeight:'800'},heroRow:{flexDirection:'row',gap:40,marginTop:8},smallValue:{color:colors.text,fontSize:15,fontWeight:'900',marginTop:3},section:{color:colors.text,fontSize:19,fontWeight:'900'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderColor:colors.border},rowTitle:{color:colors.text,fontSize:12,fontWeight:'900'},rowValue:{color:colors.text,fontSize:14,fontWeight:'900'},goal:{color:colors.accent,fontSize:25,fontWeight:'900',marginTop:-4},note:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:6},noteTitle:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2},noteText:{color:colors.muted,fontSize:10,lineHeight:16}});