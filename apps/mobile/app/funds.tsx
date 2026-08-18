import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const modules = [
  ['Fund X-Ray', 'Portfolio overlap, concentration and category exposure.'],
  ['Historical Simulator', 'Model a one-time investment across available history.'],
  ['Fund Comparison', 'Compare returns, volatility, drawdown and consistency.'],
  ['SIP Intelligence', 'Study contribution growth, step-up and target paths.'],
  ['Rolling Returns', 'Evaluate consistency across multiple rolling windows.'],
  ['Risk Lens', 'Surface volatility, drawdowns and risk-adjusted measures.'],
];

export default function FundsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Link href="/" style={styles.back}>‹  Home</Link><Text style={styles.eyebrow}>MUTUAL FUND INTELLIGENCE</Text></View>
        <Text style={styles.title}>Mutual Funds</Text>
        <Text style={styles.subtitle}>Research funds with history, risk and goal context.</Text>

        <Link href="/lab" asChild><TouchableOpacity style={styles.hero} activeOpacity={0.85}>
          <View style={styles.heroTop}><View><Text style={styles.kicker}>INVESTMENT LAB</Text><Text style={styles.heroTitle}>SIP + Lumpsum calculators</Text></View><Text style={styles.arrow}>↗</Text></View>
          <Text style={styles.heroText}>Project a goal, model step-ups, reverse-calculate a required investment and compare scenarios.</Text>
        </TouchableOpacity></Link>

        <View style={styles.provider}><View style={styles.providerDot} /><View style={styles.providerCopy}><Text style={styles.providerTitle}>Fund data connection required</Text><Text style={styles.muted}>NAV history, benchmark data and scheme metadata will appear only after a verified provider is configured.</Text></View></View>

        <View style={styles.selector}><Text style={styles.muted}>Selected fund</Text><View style={styles.selectorRow}><Text style={styles.selectorTitle}>Choose a scheme</Text><Text style={styles.chevron}>⌄</Text></View></View>

        <View style={styles.performance}><View><Text style={styles.muted}>Historical CAGR</Text><Text style={styles.big}>—</Text></View><View><Text style={styles.muted}>Max drawdown</Text><Text style={styles.big}>—</Text></View><View><Text style={styles.muted}>Volatility</Text><Text style={styles.big}>—</Text></View></View>

        <Text style={styles.sectionTitle}>Fund intelligence</Text>
        <View style={styles.grid}>{modules.map(([title, subtitle], index) => <View key={title} style={styles.tool}><Text style={styles.toolNumber}>0{index + 1}</Text><Text style={styles.toolTitle}>{title}</Text><Text style={styles.toolSubtitle}>{subtitle}</Text></View>)}</View>

        <View style={styles.note}><Text style={styles.noteTitle}>Historical ≠ forecast</Text><Text style={styles.noteText}>Historical returns and simulated outcomes will be clearly separated from forward-looking assumptions. No future return will be presented as guaranteed.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 52, gap: spacing.lg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 8, letterSpacing: 1.3, fontWeight: '900' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -9 },
  hero: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 5 },
  arrow: { color: colors.accent, fontSize: 22, fontWeight: '900' },
  heroText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  provider: { flexDirection: 'row', gap: 11, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  providerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning, marginTop: 3 },
  providerCopy: { flex: 1, gap: 3 },
  providerTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  selector: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  selectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  selectorTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  chevron: { color: colors.accent, fontSize: 20 },
  performance: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  big: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tool: { width: '48%', minHeight: 142, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  toolNumber: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  toolTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 15 },
  toolSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  note: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  noteTitle: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  noteText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
});
