import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'stop_loss' | 'stop_limit';
type HistoryPoint = { timestamp: string; close: number };
type HistoryResponse = { available: boolean; points: HistoryPoint[]; source: { provider: string; retrievedAt: string } | null; message?: string };
type BrokerHealth = { configured: boolean; connected: boolean; broker: string; message: string };
type Preview = { valid: boolean; estimatedValue?: number; execution: string; message: string; errors?: string[] };

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const orderTypes: { key: OrderType; label: string; hint: string }[] = [
  { key: 'market', label: 'Market', hint: 'Execute at the best available broker price' },
  { key: 'limit', label: 'Limit', hint: 'Only execute at your limit price or better' },
  { key: 'stop_loss', label: 'Stop-loss', hint: 'Trigger when the stop price is reached' },
  { key: 'stop_limit', label: 'Stop-limit', hint: 'Trigger first, then submit a limit order' },
];

function money(value: number | undefined) {
  return value === undefined ? '—' : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function positiveNumber(value: string) {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function TradingScreen() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [referencePrice, setReferencePrice] = useState<number | undefined>();
  const [source, setSource] = useState<string | null>(null);
  const [broker, setBroker] = useState<BrokerHealth | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('Build an order, then review it before execution.');

  const numericQuantity = positiveNumber(quantity);
  const numericPrice = positiveNumber(price);
  const numericStop = positiveNumber(stopPrice);
  const referenceValue = referencePrice ? referencePrice * numericQuantity : undefined;
  const orderValue = type === 'market' ? referenceValue : numericPrice * numericQuantity;

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!symbol.trim()) errors.push('Enter a stock symbol.');
    if (numericQuantity <= 0) errors.push('Quantity must be greater than zero.');
    if ((type === 'limit' || type === 'stop_limit') && numericPrice <= 0) errors.push('Enter a positive limit price.');
    if ((type === 'stop_loss' || type === 'stop_limit') && numericStop <= 0) errors.push('Enter a positive stop price.');
    return errors;
  }, [symbol, numericQuantity, type, numericPrice, numericStop]);

  async function loadReference() {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) return;
    setLoading(true);
    setMessage('Fetching the latest verified historical close…');
    try {
      const [historyResponse, brokerResponse] = await Promise.all([
        fetch(`${API_URL}/market-data/stocks/${encodeURIComponent(ticker)}/history?from=${new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)}`),
        fetch(`${API_URL}/trading/status`),
      ]);
      const history = await historyResponse.json() as HistoryResponse;
      const health = await brokerResponse.json() as BrokerHealth;
      setBroker(health);
      if (!historyResponse.ok || !history.available || !history.points.length) {
        setReferencePrice(undefined);
        setSource(null);
        setMessage(history.message ?? 'Verified market reference is unavailable.');
        return;
      }
      const last = history.points[history.points.length - 1];
      if (!last) throw new Error('No verified observation returned.');
      setReferencePrice(last.close);
      setSource(history.source ? `${history.source.provider} · ${new Date(history.source.retrievedAt).toLocaleString()}` : null);
      setMessage(`Reference price loaded from the latest available verified observation.`);
    } catch (error) {
      setReferencePrice(undefined);
      setSource(null);
      setBroker(null);
      setMessage(error instanceof Error ? error.message : 'Unable to reach the InvestIQ API.');
    } finally {
      setLoading(false);
    }
  }

  async function buildPreview() {
    if (validation.length) {
      setPreview({ valid: false, execution: 'blocked', message: 'Fix the highlighted order fields before preview.', errors: validation });
      return;
    }
    setLoading(true);
    setMessage('Running server-side order validation…');
    try {
      const body = {
        symbol: symbol.trim().toUpperCase(),
        side,
        type,
        quantity: numericQuantity,
        ...(type === 'limit' || type === 'stop_limit' ? { price: numericPrice } : {}),
        ...(type === 'stop_loss' || type === 'stop_limit' ? { stopPrice: numericStop } : {}),
        timeInForce: 'day' as const,
      };
      const response = await fetch(`${API_URL}/trading/orders/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as Preview & { message?: string | string[]; errors?: string[] };
      if (!response.ok) {
        const errors = data.errors ?? (Array.isArray(data.message) ? data.message : [data.message ?? 'Order preview failed.']);
        setPreview({ valid: false, execution: 'blocked', message: 'Server rejected the preview.', errors });
        return;
      }
      setPreview(data);
      setMessage('Order validated. Review every field before submitting.');
    } catch (error) {
      setPreview({ valid: false, execution: 'unavailable', message: error instanceof Error ? error.message : 'Unable to preview order.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitOrder() {
    if (validation.length || !preview?.valid) {
      await buildPreview();
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        symbol: symbol.trim().toUpperCase(), side, type, quantity: numericQuantity,
        ...(type === 'limit' || type === 'stop_limit' ? { price: numericPrice } : {}),
        ...(type === 'stop_loss' || type === 'stop_limit' ? { stopPrice: numericStop } : {}),
        timeInForce: 'day' as const,
      };
      const response = await fetch(`${API_URL}/trading/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as { message?: string | string[]; status?: string };
      if (!response.ok) {
        const text = Array.isArray(data.message) ? data.message.join(' · ') : data.message;
        setMessage(text ?? 'Broker execution is unavailable. No order was simulated.');
        return;
      }
      setMessage(`Order accepted by broker: ${data.status ?? 'submitted'}.`);
      setPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.top}><Link href="/" style={styles.back}>‹ Home</Link><Text style={styles.eyebrow}>TRADING TERMINAL</Text></View>
        <Text style={styles.title}>Trade</Text>
        <Text style={styles.subtitle}>A broker-connected execution surface with server-side validation and no simulated fills.</Text>

        <View style={styles.connection}>
          <View style={[styles.dot, broker?.connected && styles.dotOn]} />
          <View style={styles.connectionCopy}>
            <Text style={styles.connectionTitle}>{broker?.connected ? `Connected · ${broker.broker}` : 'Execution broker not connected'}</Text>
            <Text style={styles.muted}>{broker?.message ?? 'Connect a supported broker before submitting a live order.'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>INSTRUMENT</Text>
          <View style={styles.symbolRow}>
            <TextInput value={symbol} autoCapitalize="characters" onChangeText={setSymbol} onSubmitEditing={loadReference} style={styles.symbolInput} placeholder="NSE/BSE symbol" placeholderTextColor={colors.muted} />
            <TouchableOpacity onPress={loadReference} style={styles.lookup} disabled={loading}><Text style={styles.lookupText}>{loading ? '…' : 'Quote'}</Text></TouchableOpacity>
          </View>
          <View style={styles.quoteRow}><View><Text style={styles.muted}>Latest available reference</Text><Text style={styles.quote}>{money(referencePrice)}</Text></View><Text style={styles.quoteSource}>{source ? 'VERIFIED' : 'NO QUOTE'}</Text></View>
          <Text style={styles.disclaimer}>This is the latest available verified historical observation, not a live exchange quote. Market orders require a broker quote at execution.</Text>
        </View>

        <View style={styles.sideRow}>
          <TouchableOpacity onPress={() => setSide('buy')} style={[styles.sideButton, side === 'buy' && styles.buyActive]}><Text style={[styles.sideText, side === 'buy' && styles.sideActiveText]}>BUY</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSide('sell')} style={[styles.sideButton, side === 'sell' && styles.sellActive]}><Text style={[styles.sideText, side === 'sell' && styles.sideActiveText]}>SELL</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>ORDER TYPE</Text>
          <View style={styles.typeGrid}>{orderTypes.map(item => <TouchableOpacity key={item.key} onPress={() => { setType(item.key); setPreview(null); }} style={[styles.typeButton, type === item.key && styles.typeActive]}><Text style={[styles.typeTitle, type === item.key && styles.typeActiveText]}>{item.label}</Text><Text style={styles.typeHint}>{item.hint}</Text></TouchableOpacity>)}</View>

          <Text style={styles.label}>QUANTITY</Text>
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={styles.field} placeholder="Quantity" placeholderTextColor={colors.muted} />

          {(type === 'limit' || type === 'stop_limit') && <><Text style={styles.label}>LIMIT PRICE</Text><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={styles.field} placeholder="₹ Limit price" placeholderTextColor={colors.muted} /></>}
          {(type === 'stop_loss' || type === 'stop_limit') && <><Text style={styles.label}>STOP PRICE</Text><TextInput value={stopPrice} onChangeText={setStopPrice} keyboardType="decimal-pad" style={styles.field} placeholder="₹ Trigger price" placeholderTextColor={colors.muted} /></>}

          {validation.length > 0 && <View style={styles.errorBox}>{validation.map(error => <Text key={error} style={styles.errorText}>• {error}</Text>)}</View>}
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewHeader}><Text style={styles.previewTitle}>Order preview</Text><Text style={styles.day}>DAY</Text></View>
          <Row label="Side" value={side.toUpperCase()} />
          <Row label="Instrument" value={symbol.trim().toUpperCase() || '—'} />
          <Row label="Type" value={orderTypes.find(item => item.key === type)?.label ?? type} />
          <Row label="Quantity" value={numericQuantity ? numericQuantity.toLocaleString('en-IN') : '—'} />
          {type !== 'market' && <Row label="Limit / trigger" value={type === 'stop_loss' ? money(numericStop) : type === 'stop_limit' ? `${money(numericStop)} / ${money(numericPrice)}` : money(numericPrice)} />}
          <Row label="Estimated value" value={money(preview?.estimatedValue ?? orderValue)} />
          {preview && <View style={styles.previewMessage}><Text style={preview.valid ? styles.success : styles.errorText}>{preview.message}</Text>{preview.errors?.map(error => <Text key={error} style={styles.errorText}>• {error}</Text>)}</View>}
          <TouchableOpacity onPress={buildPreview} style={styles.previewButton} disabled={loading}><Text style={styles.previewButtonText}>{loading ? 'VALIDATING…' : 'Validate & Preview'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={submitOrder} style={[styles.submitButton, !preview?.valid && styles.submitDisabled]} disabled={submitting || !preview?.valid}><Text style={styles.submitText}>{submitting ? 'SUBMITTING…' : 'Submit live order'}</Text></TouchableOpacity>
          <Text style={styles.executionNote}>Submitting sends the order to the configured broker only. If no broker is connected, InvestIQ blocks execution rather than simulating a fill.</Text>
        </View>

        <View style={styles.note}><Text style={styles.noteTitle}>Execution integrity</Text><Text style={styles.noteText}>{message}</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.muted}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,paddingBottom:60,gap:spacing.lg},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{color:colors.accent,fontSize:13,fontWeight:'800'},eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.4},title:{color:colors.text,fontSize:32,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:14,lineHeight:20,marginTop:-9},connection:{flexDirection:'row',gap:11,backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md},dot:{width:9,height:9,borderRadius:5,backgroundColor:colors.warning,marginTop:4},dotOn:{backgroundColor:colors.accent},connectionCopy:{flex:1,gap:3},connectionTitle:{color:colors.text,fontSize:12,fontWeight:'900'},muted:{color:colors.muted,fontSize:10,lineHeight:16},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:spacing.md},label:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2},symbolRow:{flexDirection:'row',gap:8},symbolInput:{flex:1,color:colors.text,backgroundColor:colors.surfaceElevated,borderRadius:radius.sm,padding:13,fontSize:16,fontWeight:'800'},lookup:{backgroundColor:colors.accentSoft,borderRadius:radius.sm,paddingHorizontal:18,justifyContent:'center'},lookupText:{color:colors.accent,fontSize:11,fontWeight:'900'},quoteRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},quote:{color:colors.text,fontSize:24,fontWeight:'900',marginTop:3},quoteSource:{color:referencePrice ? colors.accent : colors.warning,fontSize:9,fontWeight:'900'},disclaimer:{color:colors.muted,fontSize:9,lineHeight:14},sideRow:{flexDirection:'row',backgroundColor:colors.surface,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,padding:4,gap:4},sideButton:{flex:1,paddingVertical:14,borderRadius:radius.sm,alignItems:'center'},buyActive:{backgroundColor:colors.positive},sellActive:{backgroundColor:colors.negative},sideText:{color:colors.muted,fontSize:12,fontWeight:'900'},sideActiveText:{color:colors.background},typeGrid:{gap:8},typeButton:{padding:12,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceElevated},typeActive:{borderColor:colors.accent,backgroundColor:colors.accentSoft},typeTitle:{color:colors.text,fontSize:12,fontWeight:'900'},typeActiveText:{color:colors.accent},typeHint:{color:colors.muted,fontSize:9,lineHeight:13,marginTop:3},field:{color:colors.text,backgroundColor:colors.surfaceElevated,borderRadius:radius.sm,padding:13,fontSize:14},errorBox:{backgroundColor:'#321B1E',borderRadius:radius.sm,padding:11,gap:3},errorText:{color:colors.negative,fontSize:10,lineHeight:15},previewCard:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:10},previewHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},previewTitle:{color:colors.text,fontSize:18,fontWeight:'900'},day:{color:colors.accent,fontSize:9,fontWeight:'900'},row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderColor:colors.border},rowValue:{color:colors.text,fontSize:11,fontWeight:'800',maxWidth:'65%',textAlign:'right'},previewMessage:{backgroundColor:colors.surface,padding:10,borderRadius:radius.sm,gap:3},success:{color:colors.accent,fontSize:10,lineHeight:15},previewButton:{backgroundColor:colors.accent,paddingVertical:14,borderRadius:radius.sm,alignItems:'center',marginTop:4},previewButtonText:{color:colors.background,fontSize:11,fontWeight:'900'},submitButton:{backgroundColor:colors.text,paddingVertical:14,borderRadius:radius.sm,alignItems:'center'},submitDisabled:{opacity:0.35},submitText:{color:colors.background,fontSize:11,fontWeight:'900'},executionNote:{color:colors.muted,fontSize:9,lineHeight:14},note:{backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md},noteTitle:{color:colors.accent,fontSize:10,fontWeight:'900'},noteText:{color:colors.muted,fontSize:10,lineHeight:16,marginTop:4}
});