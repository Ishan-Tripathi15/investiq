import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
type Item = { schemeCode: string; schemeName?: string; nav?: number; navDate?: string; category?: string };
type Response = { available: boolean; items: Item[] };

export default function MutualFundWatchlist() {
  const [code, setCode] = useState('');
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/mutual-fund-watchlist`, { credentials: 'include' });
      const json = (await response.json()) as Response & { message?: string };
      if (!response.ok) throw new Error(json.message ?? 'Unable to load watchlist.');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load watchlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/mutual-fund-watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ schemeCode: code }),
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(json.message ?? 'Unable to add fund.');
      setCode('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add fund.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (schemeCode: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/mutual-fund-watchlist/${encodeURIComponent(schemeCode)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const json = (await response.json()) as { message?: string };
        throw new Error(json.message ?? 'Unable to remove fund.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove fund.');
    } finally {
      setBusy(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text style={s.eyebrow}>INVESTIQ</Text>
        <Text style={s.title}>Fund Watchlist</Text>
        <Text style={s.subtitle}>Track mutual funds you want to research later.</Text>
        <View style={s.add}>
          <TextInput value={code} onChangeText={setCode} placeholder="Scheme code" placeholderTextColor={colors.muted} style={s.input} />
          <TouchableOpacity disabled={busy || !code.trim()} onPress={() => void add()} style={s.button}>
            <Text style={s.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {loading ? (
          <View style={s.state}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          items.map((item) => (
            <View key={item.schemeCode} style={s.card}>
              <View style={s.cardBody}>
                <Text style={s.name}>{item.schemeName ?? `Scheme ${item.schemeCode}`}</Text>
                <Text style={s.meta}>{item.category ?? 'Category unavailable'} · {item.schemeCode}</Text>
                <Text style={s.nav}>{item.nav == null ? 'NAV unavailable' : `₹${item.nav.toFixed(2)}`}</Text>
              </View>
              <TouchableOpacity onPress={() => void remove(item.schemeCode)} disabled={busy}>
                <Text style={s.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        {!loading && items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.name}>Your fund watchlist is empty</Text>
            <Text style={s.meta}>Add a scheme code from Mutual Funds search.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 }, title: { color: colors.text, fontSize: 29, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 }, add: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, paddingHorizontal: 12 },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' }, buttonText: { color: colors.background, fontWeight: '900', fontSize: 11 },
  error: { color: colors.warning, fontSize: 10 }, state: { padding: spacing.lg, alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardBody: { flex: 1 }, name: { color: colors.text, fontSize: 13, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 9, marginTop: 4 }, nav: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 9 },
  remove: { color: colors.warning, fontSize: 9, fontWeight: '900' }, empty: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});