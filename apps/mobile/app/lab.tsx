import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

type Mode = 'sip' | 'lumpsum' | 'goal';

type Scenario = { label: string; rate: number; value: number; tone: 'low' | 'base' | 'high' };

const money = (value: number) => `₹${Math.max(0, Math.round(value)).toLocaleString('en-IN')}`;
const numberValue = (text: string, fallback: number) => {
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

function lumpsumValue(principal: number, rate: number, years: number) {
  return principal * Math.pow(1 + rate / 100, years);
}

function sipValue(monthly: number, rate: number, years: number, stepUp: number) {
  const months = Math.round(years * 12);
  const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
  let corpus = 0;
  let contribution = monthly;
  for (let month = 1; month <= months; month += 1) {
    corpus = corpus * (1 + monthlyRate) + contribution;
    if (month % 12 === 0) contribution *= 1 + stepUp / 100;
  }
  return corpus;
}

export default function InvestmentLab() {
  const [mode, setMode] = useState<Mode>('sip');
  const [amount, setAmount] = useState('10000');
  const [years, setYears] = useState('10');
  const [stepUp, setStepUp] = useState('10');
  const [target, setTarget] = useState('2500000');

  const inputAmount = numberValue(amount, 10000);
  const horizon = numberValue(years, 10);
  const annualStepUp = numberValue(stepUp, 10);
  const goal = numberValue(target, 2500000);

  const scenarios = useMemo<Scenario[]>(() => {
    const rates = [8, 12, 15];
    return rates.map((rate, index) => ({
      label: index === 0 ? 'Conservative' : index === 1 ? 'Base case' : 'Optimistic',
      rate,
      value: mode === 'sip' ? sipValue(inputAmount, rate, horizon, annualStepUp) : lumpsumValue(inputAmount, rate, horizon),
      tone: index === 0 ? 'low' : index === 1 ? 'base' : 'high',
    }));
  }, [annualStepUp, horizon, inputAmount, mode]);

  const base = scenarios[1]?.value ?? 0;
  const invested = mode === 'sip'
    ? inputAmount * 12 * horizon * Math.pow(1 + annualStepUp / 100, Math.max(0, horizon - 1) / 2)
    : inputAmount;
  const requiredLumpsum = horizon > 0 ? goal / Math.pow(1.12, horizon) : goal;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Link href="/" style={styles.back}>‹  Home</Link>
          <Text style={styles.eyebrow}>INVESTIQ / LAB</Text>
        </View>

        <Text style={styles.title}>Investment Lab</Text>
        <Text style={styles.subtitle}>Model wealth before you commit capital.</Text>

        <View style={styles.tabs}>
          {([['sip', 'SIP'], ['lumpsum', 'Lumpsum'], ['goal', 'Goal']] as const).map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setMode(key)} style={[styles.tab, mode === key && styles.activeTab]}>
              <Text style={[styles.tabText, mode === key && styles.activeTabText]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          {mode === 'goal' ? (
            <>
              <Field label="Target corpus" value={target} onChangeText={setTarget} prefix="₹" />
              <Field label="Time horizon" value={years} onChangeText={setYears} suffix="years" />
              <View style={styles.goalBox}>
                <Text style={styles.muted}>Required lumpsum at 12% assumed return</Text>
                <Text style={styles.goalValue}>{money(requiredLumpsum)}</Text>
              </View>
            </>
          ) : (
            <>
              <Field label={mode === 'sip' ? 'Monthly SIP' : 'Initial investment'} value={amount} onChangeText={setAmount} prefix="₹" />
              <Field label="Time horizon" value={years} onChangeText={setYears} suffix="years" />
              {mode === 'sip' && <Field label="Annual SIP step-up" value={stepUp} onChangeText={setStepUp} suffix="%" />}
            </>
          )}
        </View>

        <View style={styles.resultHero}>
          <Text style={styles.muted}>Base-case projected value</Text>
          <Text style={styles.resultValue}>{money(mode === 'goal' ? goal : base)}</Text>
          {mode !== 'goal' && <Text style={styles.resultMeta}>12% annual assumption · {horizon} years</Text>}
        </View>

        {mode !== 'goal' && (
          <View style={styles.breakdown}>
            <View><Text style={styles.muted}>Capital modelled</Text><Text style={styles.breakdownValue}>{money(invested)}</Text></View>
            <View><Text style={styles.muted}>Potential gain</Text><Text style={styles.breakdownValue}>{money(Math.max(0, base - invested))}</Text></View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Scenario range</Text>
        <View style={styles.scenarioCard}>
          {scenarios.map((scenario) => (
            <View key={scenario.label} style={styles.scenarioRow}>
              <View style={styles.scenarioName}><View style={[styles.scenarioDot, scenario.tone === 'base' && styles.baseDot]} /><View><Text style={styles.rowTitle}>{scenario.label}</Text><Text style={styles.muted}>{scenario.rate}% annual assumption</Text></View></View>
              <Text style={styles.rowValue}>{money(scenario.value)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.insight}>
          <Text style={styles.insightKicker}>ANALYSIS NOTE</Text>
          <Text style={styles.insightText}>Scenarios are mathematical projections, not forecasts. Actual returns vary and can be negative. When connected to verified fund data, this module will separate historical performance from forward assumptions.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, prefix, suffix }: { label: string; value: string; onChangeText: (value: string) => void; prefix?: string; suffix?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix && <Text style={styles.inputAffix}>{prefix}</Text>}
        <TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" style={styles.input} />
        {suffix && <Text style={styles.inputAffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 52, gap: spacing.lg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: -8 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 11, borderRadius: radius.sm, alignItems: 'center' },
  activeTab: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  activeTabText: { color: colors.background },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: 14 },
  fieldWrap: { gap: 7 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: 13 },
  inputAffix: { color: colors.muted, fontWeight: '700' },
  input: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '800', paddingVertical: 13, paddingHorizontal: 8 },
  goalBox: { marginTop: 4, padding: 14, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  goalValue: { color: colors.accent, fontSize: 25, fontWeight: '900', marginTop: 5 },
  resultHero: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  muted: { color: colors.muted, fontSize: 11 },
  resultValue: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 7 },
  resultMeta: { color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 4 },
  breakdown: { flexDirection: 'row', gap: spacing.sm },
  breakdownValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 5 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  scenarioCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  scenarioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: colors.border },
  scenarioName: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scenarioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  baseDot: { backgroundColor: colors.accent },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  insight: { padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  insightKicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  insightText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
});
