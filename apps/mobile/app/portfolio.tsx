import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

type BrokerHealth = {
  configured: boolean;
  connected: boolean;
  broker: string;
  message: string;
};

type TradingAccount = {
  availableCash?: number;
  totalEquity?: number;
  currency: string;
};

type Position = {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

type Order = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  filledQuantity: number;
  averageFillPrice?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function formatMoney(value?: number, currency = 'INR') {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <View style={[styles.statusPill, connected ? styles.statusConnected : styles.statusUnavailable]}>
      <View style={[styles.statusDot, connected ? styles.dotConnected : styles.dotUnavailable]} />
      <Text style={[styles.statusText, connected ? styles.textConnected : styles.textUnavailable]}>{connected ? 'CONNECTED' : 'NOT CONNECTED'}</Text>
    </View>
  );
}

export default function PortfolioScreen() {
  const [health, setHealth] = useState<BrokerHealth | null>(null);
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [healthResponse, accountResponse, positionsResponse, ordersResponse] = await Promise.all([
        fetch(`${API_URL}/trading/status`),
        fetch(`${API_URL}/trading/account`),
        fetch(`${API_URL}/trading/positions`),
        fetch(`${API_URL}/trading/orders`),
      ]);
      if (!healthResponse.ok || !accountResponse.ok || !positionsResponse.ok || !ordersResponse.ok) throw new Error('Trading service returned an unavailable response');
      const [healthData, accountData, positionsData, ordersData] = await Promise.all([
        healthResponse.json() as Promise<BrokerHealth>,
        accountResponse.json() as Promise<TradingAccount>,
        accountResponse.ok ? positionsResponse.json() as Promise<Position[]> : Promise.resolve([]),
        ordersResponse.json() as Promise<Order[]>,
      ]);
      setHealth(healthData);
      setAccount(accountData);
      setPositions(Array.isArray(positionsData) ? positionsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load trading portfolio');
      setHealth(null);
      setAccount(null);
      setPositions([]);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => positions.reduce((result, position) => ({
    invested: result.invested + position.investedValue,
    market: result.market + position.marketValue,
    pnl: result.pnl + position.unrealizedPnl,
  }), { invested: 0, market: 0, pnl: 0 }), [positions]);

  const pnlPct = totals.invested === 0 ? 0 : totals.pnl / totals.invested * 100;
  const currency = account?.currency ?? 'INR';

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Loading portfolio…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PORTFOLIO</Text>
            <Text style={styles.title}>Your positions.</Text>
          </View>
          <Link href="/trading" asChild>
            <TouchableOpacity style={styles.tradeButton} activeOpacity={0.8}><Text style={styles.tradeButtonText}>Trade</Text></TouchableOpacity>
          </Link>
        </View>

        {error && <View style={styles.errorCard}><Text style={styles.errorTitle}>Portfolio unavailable</Text><Text style={styles.errorText}>{error}</Text></View>}

        <View style={styles.connectionCard}>
          <View style={styles.connectionTop}>
            <View><Text style={styles.cardLabel}>Execution account</Text><Text style={styles.broker}>{health?.broker ?? 'Unavailable'}</Text></View>
            <StatusPill connected={Boolean(health?.configured && health?.connected)} />
          </View>
          <Text style={styles.muted}>{health?.message ?? 'Trading account status could not be retrieved.'}</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.cardLabel}>Market value</Text>
          <Text style={styles.heroValue}>{positions.length ? formatMoney(totals.market, currency) : '—'}</Text>
          <View style={styles.heroRow}>
            <View><Text style={styles.muted}>Invested</Text><Text style={styles.metric}>{positions.length ? formatMoney(totals.invested, currency) : '—'}</Text></View>
            <View><Text style={styles.muted}>Unrealized P&L</Text><Text style={[styles.metric, totals.pnl >= 0 ? styles.positive : styles.negative]}>{positions.length ? formatMoney(totals.pnl, currency) : '—'}</Text></View>
            <View><Text style={styles.muted}>P&L %</Text><Text style={[styles.metric, pnlPct >= 0 ? styles.positive : styles.negative]}>{positions.length ? formatPct(pnlPct) : '—'}</Text></View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.muted}>Cash</Text><Text style={styles.statValue}>{formatMoney(account?.availableCash, currency)}</Text></View>
          <View style={styles.stat}><Text style={styles.muted}>Equity</Text><Text style={styles.statValue}>{formatMoney(account?.totalEquity, currency)}</Text></View>
          <View style={styles.stat}><Text style={styles.muted}>Positions</Text><Text style={styles.statValue}>{positions.length}</Text></View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Open positions</Text><Text style={styles.link}>{positions.length} tracked</Text></View>
        <View style={styles.card}>
          {positions.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyIcon}>◎</Text><Text style={styles.emptyTitle}>No broker positions</Text><Text style={styles.muted}>Positions appear here only after a connected broker returns verified account data. InvestIQ does not simulate holdings.</Text></View>
          ) : positions.map((position, index) => (
            <View key={`${position.symbol}-${index}`} style={[styles.positionRow, index === positions.length - 1 && styles.noBorder]}>
              <View style={styles.positionMain}><Text style={styles.symbol}>{position.symbol}</Text><Text style={styles.muted}>{position.quantity} shares · avg {formatMoney(position.averagePrice, currency)}</Text></View>
              <View style={styles.positionRight}><Text style={styles.positionValue}>{formatMoney(position.marketValue, currency)}</Text><Text style={[styles.pnl, position.unrealizedPnl >= 0 ? styles.positive : styles.negative]}>{formatMoney(position.unrealizedPnl, currency)} · {formatPct(position.unrealizedPnlPct)}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent orders</Text><Link href="/trading" style={styles.link}>Open terminal</Link></View>
        <View style={styles.card}>
          {orders.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>No broker orders</Text><Text style={styles.muted}>Order history will appear after a supported execution broker is connected.</Text></View>
          ) : orders.slice(0, 10).map((order, index) => (
            <View key={order.id} style={[styles.orderRow, index === Math.min(orders.length, 10) - 1 && styles.noBorder]}>
              <View><Text style={styles.symbol}>{order.side.toUpperCase()} · {order.symbol}</Text><Text style={styles.muted}>{order.type.replace('_', ' ')} · {order.filledQuantity}/{order.quantity} filled</Text></View>
              <View style={styles.orderRight}><Text style={styles.orderStatus}>{order.status.replace('_', ' ')}</Text>{order.averageFillPrice !== undefined && <Text style={styles.muted}>{formatMoney(order.averageFillPrice, currency)}</Text>}</View>
            </View>
          ))}
        </View>

        <View style={styles.disclaimer}><Text style={styles.disclaimerText}>Portfolio values, positions and order history are sourced from the connected execution broker. When no broker is configured, InvestIQ shows unavailable/empty states rather than simulated balances or fills.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', marginTop: 4 },
  tradeButton: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  tradeButtonText: { color: colors.background, fontSize: 12, fontWeight: '900' },
  connectionCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 9 },
  connectionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  broker: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 },
  statusConnected: { backgroundColor: colors.accentSoft },
  statusUnavailable: { backgroundColor: colors.surfaceElevated },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotConnected: { backgroundColor: colors.positive },
  dotUnavailable: { backgroundColor: colors.muted },
  statusText: { fontSize: 9, fontWeight: '900' },
  textConnected: { color: colors.positive },
  textUnavailable: { color: colors.muted },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  heroValue: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 6 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  metric: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  positive: { color: colors.positive },
  negative: { color: colors.negative },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 7 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  link: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  positionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, gap: spacing.md },
  positionMain: { flex: 1 },
  positionRight: { alignItems: 'flex-end' },
  symbol: { color: colors.text, fontSize: 13, fontWeight: '900' },
  positionValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  pnl: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  orderRight: { alignItems: 'flex-end', gap: 3 },
  orderStatus: { color: colors.text, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  noBorder: { borderBottomWidth: 0 },
  empty: { paddingVertical: 24, alignItems: 'center', gap: 7 },
  emptyIcon: { color: colors.accent, fontSize: 25 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  errorCard: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  errorTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  errorText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  disclaimer: { padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radius.md },
  disclaimerText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
