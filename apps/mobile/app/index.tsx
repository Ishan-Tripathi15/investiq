import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const watchlist = [
  { symbol: 'NIFTY 50', value: '25,012.40', change: '+0.72%', positive: true },
  { symbol: 'SENSEX', value: '81,902.11', change: '+0.54%', positive: true },
  { symbol: 'RELIANCE', value: '1,421.35', change: '-0.31%', positive: false },
];

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statDetail}>{detail}</Text>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>INVESTIQ</Text>
            <Text style={styles.title}>Good evening.</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>IT</Text></View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.muted}>Portfolio value</Text>
              <Text style={styles.heroValue}>₹8,42,650</Text>
            </View>
            <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
          </View>
          <Text style={styles.positive}>+₹12,480  ·  +1.50% today</Text>
          <View style={styles.chart}><View style={styles.chartLine} /></View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Invested" value="₹7.21L" detail="Principal" />
          <Stat label="Returns" value="₹1.21L" detail="+16.8%" />
          <Stat label="XIRR" value="18.4%" detail="Since start" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Investment Lab</Text>
          <Text style={styles.link}>Explore all</Text>
        </View>
        <View style={styles.labGrid}>
          {[
            ['SIP', 'Plan monthly investing', '₹'],
            ['Lumpsum', 'Project one-time wealth', '◈'],
            ['Goal Planner', 'Work backwards from a goal', '◎'],
            ['History', 'See what ₹1L could have done', '↗'],
          ].map(([title, subtitle, icon]) => (
            <TouchableOpacity key={title} style={styles.labCard} activeOpacity={0.8}>
              <Text style={styles.labIcon}>{icon}</Text>
              <Text style={styles.labTitle}>{title}</Text>
              <Text style={styles.labSubtitle}>{subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market pulse</Text>
          <Text style={styles.link}>View markets</Text>
        </View>
        <View style={styles.marketCard}>
          {watchlist.map((item, index) => (
            <View key={item.symbol} style={[styles.marketRow, index === watchlist.length - 1 && styles.noBorder]}>
              <View><Text style={styles.symbol}>{item.symbol}</Text><Text style={styles.muted}>Indian market</Text></View>
              <View style={styles.marketRight}><Text style={styles.price}>{item.value}</Text><Text style={item.positive ? styles.positive : styles.negative}>{item.change}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>Historical performance is not a guarantee of future returns. Market data will be supplied by verified providers in production.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  avatarText: { color: colors.accent, fontWeight: '800' },
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  muted: { color: colors.muted, fontSize: 12 },
  heroValue: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 5 },
  positive: { color: colors.positive, fontSize: 13, fontWeight: '700', marginTop: 7 },
  negative: { color: colors.negative, fontSize: 13, fontWeight: '700', marginTop: 7 },
  live: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  liveText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  chart: { height: 62, marginTop: 18, overflow: 'hidden', justifyContent: 'center' },
  chartLine: { height: 28, borderTopWidth: 2, borderColor: colors.accent, transform: [{ skewX: '-18deg' }], opacity: 0.9 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 7 },
  statDetail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  link: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  labGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  labCard: { width: '48%', minHeight: 128, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  labIcon: { color: colors.accent, fontSize: 21, fontWeight: '800' },
  labTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 14 },
  labSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  marketCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  marketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  noBorder: { borderBottomWidth: 0 },
  symbol: { color: colors.text, fontSize: 14, fontWeight: '800' },
  marketRight: { alignItems: 'flex-end' },
  price: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disclaimer: { padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radius.md },
  disclaimerText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
