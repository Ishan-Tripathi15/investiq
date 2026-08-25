import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const cards = [
  { href: '/sip-calculator', icon: '₹', title: 'SIP Calculator', subtitle: 'Model monthly investing, step-up and inflation scenarios.' },
  { href: '/goal-planner', icon: '◎', title: 'Goal Planner', subtitle: 'Work backwards from a target corpus and time horizon.' },
  { href: '/investment-plan', icon: '△', title: 'Investment Plan', subtitle: 'Explore transparent allocation frameworks by risk profile.' },
  { href: '/lab', icon: '◈', title: 'Investment Lab', subtitle: 'Use the broader SIP, lumpsum and scenario toolkit.' },
] as const;

export default function PlanningHub() {
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <View style={s.top}><Link href="/" style={s.back}>‹ Home</Link><Text style={s.eyebrow}>INVESTIQ / PLANNING</Text></View>
    <Text style={s.title}>Financial Planning</Text>
    <Text style={s.subtitle}>One place for the tools that turn goals, contributions and assumptions into transparent planning scenarios.</Text>
    <View style={s.disclosure}><Text style={s.disclosureTitle}>PLANNING, NOT PROMISES</Text><Text style={s.disclosureText}>All projections use assumptions supplied by you. They are mathematical scenarios, not forecasts, guarantees or personalized investment advice.</Text></View>
    <View style={s.grid}>{cards.map(card => <Link key={card.href} href={card.href} asChild><TouchableOpacity style={s.card}><Text style={s.icon}>{card.icon}</Text><Text style={s.cardTitle}>{card.title}</Text><Text style={s.cardSubtitle}>{card.subtitle}</Text><Text style={s.open}>Open ›</Text></TouchableOpacity></Link>)}</View>
    <View style={s.note}><Text style={s.noteTitle}>Suggested flow</Text><Text style={s.noteText}>Start with a goal, test the required contribution, compare SIP scenarios, then review an illustrative allocation framework. Real investment decisions require current product, tax, liquidity and suitability information.</Text></View>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, content:{padding:spacing.lg,paddingBottom:52,gap:spacing.lg},
  top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, back:{color:colors.accent,fontSize:13,fontWeight:'800'}, eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4},
  title:{color:colors.text,fontSize:32,fontWeight:'900'}, subtitle:{color:colors.muted,fontSize:13,lineHeight:19,marginTop:-8},
  disclosure:{backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:6}, disclosureTitle:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2}, disclosureText:{color:colors.muted,fontSize:11,lineHeight:17},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}, card:{width:'48%',minHeight:172,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg}, icon:{color:colors.accent,fontSize:23,fontWeight:'900'}, cardTitle:{color:colors.text,fontSize:15,fontWeight:'900',marginTop:17}, cardSubtitle:{color:colors.muted,fontSize:10,lineHeight:15,marginTop:6}, open:{color:colors.accent,fontSize:10,fontWeight:'900',marginTop:16},
  note:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:6}, noteTitle:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2}, noteText:{color:colors.muted,fontSize:10,lineHeight:16}
});