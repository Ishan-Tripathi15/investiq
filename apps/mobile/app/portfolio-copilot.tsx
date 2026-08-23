import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const STARTERS = ['How concentrated is my portfolio?', 'What is the biggest risk in my portfolio?', 'How much cash do I currently have?', 'Which stress scenario is most severe?'];
const LOADING_STAGES = ['Preparing your verified portfolio context…', 'Generating a grounded Copilot response…', 'Validating evidence and risk signals…'];

type Evidence = { id: string; label: string; value: string; source: 'portfolio' | 'risk_twin' | 'knowledge' | 'memory' };
type MemoryUsed = { id: number; createdAt: string; question: string };
type CopilotResponse = { answer: string; confidence: 'low' | 'medium' | 'high'; riskLevel: 'low' | 'moderate' | 'high' | 'critical' | 'unknown'; evidenceIds: string[]; limitations: string[]; requiresHumanReview: boolean };
type CopilotContext = { asOf: string; answerability: 'grounded' | 'insufficient_data'; evidence: Evidence[]; memoryUsed: MemoryUsed[] };
type ApiResult = { generatedAt: string; source: { configured: boolean; provider: string; model?: string; message: string }; context: CopilotContext; response: CopilotResponse };

function confidenceLabel(value: CopilotResponse['confidence']) { return value === 'high' ? 'High confidence' : value === 'medium' ? 'Moderate confidence' : 'Low confidence'; }
function riskLabel(value: CopilotResponse['riskLevel']) { return value === 'unknown' ? 'Unknown risk' : `${value.charAt(0).toUpperCase()}${value.slice(1)} risk`; }
function evidenceSourceLabel(source: Evidence['source']) { return source === 'risk_twin' ? 'Risk Twin' : source === 'knowledge' ? 'Knowledge reference' : source === 'memory' ? 'Historical Copilot memory' : 'Verified portfolio'; }
function renderAnswer(answer: string, evidence: Evidence[]) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  return answer.split(/(\[[a-z0-9:_-]+\])/gi).map((part, index) => {
    const match = /^\[([a-z0-9:_-]+)\]$/i.exec(part);
    const item = match?.[1] ? byId.get(match[1]) : undefined;
    return item ? <Text key={index} style={styles.citation}> {item.label} </Text> : <Text key={index}>{part}</Text>;
  });
}

export default function PortfolioCopilotScreen() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<ApiResult | null>(null);
  const [context, setContext] = useState<CopilotContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) { router.replace('/login'); return; }
      const response = await fetch(`${API_URL}/portfolio/copilot/health`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Portfolio Copilot health check failed');
      const health = await response.json() as { configured: boolean; message: string };
      if (!health.configured) setError('Portfolio Copilot is not connected to an AI provider yet. Configure AI_API_URL, AI_API_KEY and AI_MODEL on the API before asking questions.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to check Copilot availability'); }
    finally { setInitializing(false); }
  }, []);

  useEffect(() => { void checkHealth(); }, [checkHealth]);
  useEffect(() => { if (!loading) return; setLoadingStage(0); const timer = setInterval(() => setLoadingStage((current) => Math.min(current + 1, LOADING_STAGES.length - 1)), 1400); return () => clearInterval(timer); }, [loading]);

  const ask = useCallback(async (value = question) => {
    const normalized = value.trim();
    if (!normalized || loading || contextLoading) return;
    setQuestion(normalized); setLoading(true); setContextLoading(true); setError(null); setResult(null); setContext(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const token = await getAccessToken();
      if (!token) { router.replace('/login'); return; }
      const contextResponse = await fetch(`${API_URL}/portfolio/copilot/context`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ question: normalized }), signal: controller.signal });
      if (contextResponse.status === 401) { router.replace('/login'); return; }
      const contextPayload = await contextResponse.json().catch(() => null) as CopilotContext | { message?: string } | null;
      if (!contextResponse.ok) throw new Error(contextPayload && 'message' in contextPayload && typeof contextPayload.message === 'string' ? contextPayload.message : 'Unable to prepare verified Copilot context');
      setContext(contextPayload as CopilotContext); setContextLoading(false);
      const response = await fetch(`${API_URL}/portfolio/copilot`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ question: normalized }), signal: controller.signal });
      if (response.status === 401) { router.replace('/login'); return; }
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Portfolio Copilot is unavailable');
      setResult(payload as unknown as ApiResult);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') setError('Copilot took too long to respond. Please retry; your question was not submitted for trading or execution.');
      else setError(cause instanceof Error ? cause.message : 'Unable to get a grounded Copilot response');
    } finally { clearTimeout(timeout); setLoading(false); setContextLoading(false); }
  }, [contextLoading, loading, question]);

  const clearMemory = useCallback(async () => {
    try { const token = await getAccessToken(); if (!token) { router.replace('/login'); return; } const response = await fetch(`${API_URL}/portfolio/copilot/memory`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Unable to clear Copilot memory'); setResult(null); setContext(null); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to clear Copilot memory'); }
  }, []);

  if (initializing) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Checking Portfolio Copilot…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View><Text style={styles.eyebrow}>INVESTIQ AI</Text><Text style={styles.title}>Portfolio Copilot</Text><Text style={styles.subtitle}>Ask about your verified portfolio. Copilot can now use relevant historical interactions while keeping current verified data authoritative.</Text></View>
    {error && <View style={styles.alert}><Text style={styles.alertTitle}>Copilot unavailable</Text><Text style={styles.muted}>{error}</Text>{question.trim() && <Pressable onPress={() => void ask()} disabled={loading} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>}</View>}
    <View style={styles.card}><Text style={styles.label}>Try a question</Text><TextInput value={question} onChangeText={setQuestion} placeholder="Ask about concentration, cash, risk…" placeholderTextColor={colors.muted} multiline maxLength={1000} style={styles.input} editable={!loading} /><Pressable onPress={() => void ask()} disabled={!question.trim() || loading} style={({ pressed }) => [styles.ask, (!question.trim() || loading) && styles.disabled, pressed && styles.pressed]}>{loading ? <View style={styles.askLoading}><ActivityIndicator /><Text style={styles.askLoadingText}>{contextLoading ? 'Preparing verified context…' : LOADING_STAGES[loadingStage]}</Text></View> : <Text style={styles.askText}>Ask Copilot</Text>}</Pressable>{loading && <View style={styles.progressRow}>{LOADING_STAGES.map((stage, index) => <View key={stage} style={[styles.progressDot, index <= loadingStage && styles.progressDotActive]} />)}</View>}</View>

    {context && !result && <View style={styles.transparency}><View style={styles.transparencyHeader}><View><Text style={styles.transparencyEyebrow}>COPILOT TRANSPARENCY</Text><Text style={styles.transparencyTitle}>What Copilot is using</Text></View><View style={styles.verifiedPill}><Text style={styles.verifiedText}>{context.answerability === 'grounded' ? 'Verified' : 'Limited'}</Text></View></View><Text style={styles.transparencySubtitle}>Current verified data remains authoritative. Historical memory is supplementary context, not a replacement for live portfolio data.</Text><View style={styles.sourceGrid}>{context.evidence.map((item) => <View key={item.id} style={styles.sourceItem}><View style={styles.sourceIcon}><Text style={styles.sourceIconText}>✓</Text></View><View style={styles.sourceBody}><Text style={styles.sourceTitle}>{item.label}</Text><Text style={styles.sourceValue}>{item.value}</Text><Text style={styles.sourceType}>{evidenceSourceLabel(item.source)}</Text></View></View>)}</View>{context.memoryUsed.length > 0 && <View style={styles.memorySummary}><Text style={styles.memorySummaryTitle}>🧠 {context.memoryUsed.length} relevant historical interaction{context.memoryUsed.length === 1 ? '' : 's'} available</Text><Text style={styles.muted}>Memory can help maintain continuity, but it does not override verified portfolio facts.</Text></View>}<Text style={styles.contextTime}>Context prepared {new Date(context.asOf).toLocaleString()}</Text></View>}

    {!result && !loading && !context && <View style={styles.section}><Text style={styles.sectionTitle}>Suggested questions</Text>{STARTERS.map((starter) => <Pressable key={starter} onPress={() => void ask(starter)} disabled={loading} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Text style={styles.suggestionText}>{starter}</Text><Text style={styles.arrow}>›</Text></Pressable>)}</View>}

    {result && <><View style={styles.answerCard}><View style={styles.answerHeader}><Text style={styles.answerLabel}>GROUNDED ANSWER</Text><View style={styles.chip}><Text style={styles.chipText}>{confidenceLabel(result.response.confidence)}</Text></View></View><Text style={styles.answer}>{renderAnswer(result.response.answer, result.context.evidence)}</Text><View style={styles.metaRow}><Text style={styles.muted}>{riskLabel(result.response.riskLevel)}</Text><Text style={styles.muted}>{result.context.answerability === 'grounded' ? 'Verified context' : 'Limited context'}</Text></View></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>What informed this answer</Text><View style={styles.card}>{result.context.evidence.filter((item) => result.response.evidenceIds.includes(item.id)).map((item) => <View key={item.id} style={styles.evidence}><View style={styles.evidenceIcon}><Text style={styles.evidenceIconText}>✓</Text></View><View style={styles.evidenceBody}><Text style={styles.evidenceTitle}>{item.label}</Text><Text style={styles.evidenceValue}>{item.value}</Text><Text style={styles.evidenceSource}>{evidenceSourceLabel(item.source)}</Text></View></View>)}</View></View>
      {result.context.memoryUsed.length > 0 && <View style={styles.section}><View style={styles.memoryHeader}><Text style={styles.sectionTitle}>Conversation continuity</Text><Text style={styles.memoryCount}>{result.context.memoryUsed.length} used</Text></View><View style={styles.card}>{result.context.memoryUsed.map((item) => <View key={item.id} style={styles.memoryItem}><Text style={styles.memoryDate}>{new Date(item.createdAt).toLocaleString()}</Text><Text style={styles.memoryQuestion}>{item.question}</Text></View>)}<Pressable onPress={() => void clearMemory()} style={styles.clearMemory}><Text style={styles.clearMemoryText}>Clear Copilot memory</Text></Pressable></View></View>}
      {result.response.requiresHumanReview && <View style={styles.review}><Text style={styles.reviewTitle}>Human review recommended</Text><Text style={styles.muted}>The system marked this response as low-confidence or data-limited. Treat it as informational, not a trading instruction.</Text></View>}
      <View style={styles.section}><Text style={styles.sectionTitle}>Limitations</Text><View style={styles.card}>{result.response.limitations.map((item, index) => <Text key={`${item}-${index}`} style={styles.muted}>• {item}</Text>)}</View></View><Text style={styles.sync}>Context as of {new Date(result.context.asOf).toLocaleString()}</Text><Pressable onPress={() => { setResult(null); setContext(null); setError(null); }} style={styles.newQuestion}><Text style={styles.newQuestionText}>Ask another question</Text></Pressable></>}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},flex:{flex:1},content:{padding:spacing.lg,paddingBottom:52,gap:spacing.lg},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:spacing.sm},eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:2},title:{color:colors.text,fontSize:32,fontWeight:'900',marginTop:5},subtitle:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:7},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:12},label:{color:colors.muted,fontSize:11,fontWeight:'800'},input:{minHeight:82,color:colors.text,fontSize:15,lineHeight:21,textAlignVertical:'top',paddingTop:8},ask:{minHeight:46,borderRadius:radius.md,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',paddingHorizontal:12},askText:{color:colors.background,fontSize:13,fontWeight:'900'},askLoading:{minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},askLoadingText:{color:colors.background,fontSize:11,fontWeight:'800',flexShrink:1},progressRow:{flexDirection:'row',gap:6,justifyContent:'center'},progressDot:{width:28,height:3,borderRadius:2,backgroundColor:colors.border},progressDotActive:{backgroundColor:colors.accent},retry:{alignSelf:'flex-start',borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,paddingHorizontal:12,paddingVertical:7},retryText:{color:colors.accent,fontSize:10,fontWeight:'900'},disabled:{opacity:0.45},pressed:{opacity:0.72},alert:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:8},alertTitle:{color:colors.text,fontSize:13,fontWeight:'900'},section:{gap:spacing.sm},sectionTitle:{color:colors.text,fontSize:19,fontWeight:'900'},suggestion:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},suggestionText:{color:colors.text,fontSize:12,lineHeight:18,flex:1},arrow:{color:colors.accent,fontSize:24,fontWeight:'700'},answerCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.accent,borderRadius:radius.lg,padding:spacing.lg,gap:14},answerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},answerLabel:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.4},chip:{backgroundColor:colors.accentSoft,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:6},chipText:{color:colors.text,fontSize:9,fontWeight:'900'},answer:{color:colors.text,fontSize:15,lineHeight:24},citation:{color:colors.accent,fontWeight:'900'},metaRow:{flexDirection:'row',justifyContent:'space-between',gap:10},review:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md,gap:6},reviewTitle:{color:colors.text,fontSize:12,fontWeight:'900'},evidence:{flexDirection:'row',gap:10,paddingVertical:5},evidenceIcon:{width:25,height:25,borderRadius:13,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},evidenceIconText:{color:colors.accent,fontSize:11,fontWeight:'900'},evidenceBody:{flex:1,gap:2},evidenceTitle:{color:colors.text,fontSize:12,fontWeight:'900'},evidenceValue:{color:colors.text,fontSize:12,lineHeight:17},evidenceSource:{color:colors.muted,fontSize:9},muted:{color:colors.muted,fontSize:11,lineHeight:17},sync:{color:colors.muted,fontSize:9},newQuestion:{alignItems:'center',paddingVertical:8},newQuestionText:{color:colors.accent,fontSize:12,fontWeight:'900'},memoryHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},memoryCount:{color:colors.accent,fontSize:10,fontWeight:'900'},memoryItem:{paddingVertical:6,gap:3},memoryDate:{color:colors.muted,fontSize:9},memoryQuestion:{color:colors.text,fontSize:11,lineHeight:16},clearMemory:{borderTopWidth:1,borderColor:colors.border,paddingTop:10,marginTop:4,alignItems:'center'},clearMemoryText:{color:colors.accent,fontSize:10,fontWeight:'900'},transparency:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg,gap:12},transparencyHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},transparencyEyebrow:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.4},transparencyTitle:{color:colors.text,fontSize:19,fontWeight:'900',marginTop:3},transparencySubtitle:{color:colors.muted,fontSize:10,lineHeight:16},verifiedPill:{backgroundColor:colors.accentSoft,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:6},verifiedText:{color:colors.text,fontSize:9,fontWeight:'900'},sourceGrid:{gap:8},sourceItem:{flexDirection:'row',gap:9,borderTopWidth:1,borderColor:colors.border,paddingTop:9},sourceIcon:{width:24,height:24,borderRadius:12,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},sourceIconText:{color:colors.accent,fontSize:10,fontWeight:'900'},sourceBody:{flex:1,gap:2},sourceTitle:{color:colors.text,fontSize:11,fontWeight:'900'},sourceValue:{color:colors.text,fontSize:10,lineHeight:15},sourceType:{color:colors.muted,fontSize:8},memorySummary:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.sm,gap:4},memorySummaryTitle:{color:colors.text,fontSize:10,fontWeight:'900'},contextTime:{color:colors.muted,fontSize:8}
});
