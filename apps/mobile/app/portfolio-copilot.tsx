import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const STARTERS = [
  'How concentrated is my portfolio?',
  'What is the biggest risk in my portfolio?',
  'How much cash do I currently have?',
  'Which stress scenario is most severe?',
];

type Evidence = { id: string; label: string; value: string; source: 'portfolio' | 'risk_twin' | 'knowledge' };
type CopilotResponse = { answer: string; confidence: 'low' | 'medium' | 'high'; riskLevel: 'low' | 'moderate' | 'high' | 'critical' | 'unknown'; evidenceIds: string[]; limitations: string[]; requiresHumanReview: boolean };
type ApiResult = { generatedAt: string; source: { configured: boolean; provider: string; model?: string; message: string }; context: { asOf: string; answerability: 'grounded' | 'insufficient_data'; evidence: Evidence[] }; response: CopilotResponse };

function confidenceLabel(value: CopilotResponse['confidence']) { return value === 'high' ? 'High confidence' : value === 'medium' ? 'Moderate confidence' : 'Low confidence'; }
function riskLabel(value: CopilotResponse['riskLevel']) { return value === 'unknown' ? 'Unknown risk' : `${value.charAt(0).toUpperCase()}${value.slice(1)} risk`; }
function evidenceIds(answer: string) { return [...answer.matchAll(/\[([a-z0-9:_-]+)\]/gi)].map((match) => match[1]).filter(Boolean); }
function renderAnswer(answer: string, evidence: Evidence[]) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const parts = answer.split(/(\[[a-z0-9:_-]+\])/gi);
  return parts.map((part, index) => {
    const match = /^\[([a-z0-9:_-]+)\]$/i.exec(part);
    if (!match) return <Text key={index}>{part}</Text>;
    const item = byId.get(match[1]);
    return <Text key={index} style={styles.citation}>{item ? ` ${item.label} ` : part}</Text>;
  });
}

export default function PortfolioCopilotScreen() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
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

  const ask = useCallback(async (value = question) => {
    const normalized = value.trim();
    if (!normalized || loading) return;
    setQuestion(normalized); setLoading(true); setError(null); setResult(null);
    try {
      const token = await getAccessToken();
      if (!token) { router.replace('/login'); return; }
      const response = await fetch(`${API_URL}/portfolio/copilot`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ question: normalized }),
      });
      if (response.status === 401) { router.replace('/login'); return; }
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Portfolio Copilot is unavailable');
      setResult(payload as unknown as ApiResult);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to get a grounded Copilot response'); }
    finally { setLoading(false); }
  }, [loading, question]);

  if (initializing) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Checking Portfolio Copilot…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.eyebrow}>INVESTIQ AI</Text>
          <Text style={styles.title}>Portfolio Copilot</Text>
          <Text style={styles.subtitle}>Ask about your verified portfolio. The Copilot is grounded in account data and deterministic risk tests—not invented market facts.</Text>
        </View>

        {error && <View style={styles.alert}><Text style={styles.alertTitle}>Copilot unavailable</Text><Text style={styles.muted}>{error}</Text></View>}

        <View style={styles.card}>
          <Text style={styles.label}>Try a question</Text>
          <TextInput value={question} onChangeText={setQuestion} placeholder="Ask about concentration, cash, risk…" placeholderTextColor={colors.muted} multiline maxLength={1000} style={styles.input} editable={!loading} />
          <Pressable onPress={() => void ask()} disabled={!question.trim() || loading} style={({ pressed }) => [styles.ask, (!question.trim() || loading) && styles.disabled, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator /> : <Text style={styles.askText}>Ask Copilot</Text>}
          </Pressable>
        </View>

        {!result && <View style={styles.section}><Text style={styles.sectionTitle}>Suggested questions</Text>{STARTERS.map((starter) => <Pressable key={starter} onPress={() => void ask(starter)} disabled={loading} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Text style={styles.suggestionText}>{starter}</Text><Text style={styles.arrow}>›</Text></Pressable>)}</View>}

        {result && <>
          <View style={styles.answerCard}>
            <View style={styles.answerHeader}><Text style={styles.answerLabel}>GROUNDED ANSWER</Text><View style={styles.chip}><Text style={styles.chipText}>{confidenceLabel(result.response.confidence)}</Text></View></View>
            <Text style={styles.answer}>{renderAnswer(result.response.answer, result.context.evidence)}</Text>
            <View style={styles.metaRow}><Text style={styles.muted}>{riskLabel(result.response.riskLevel)}</Text><Text style={styles.muted}>{result.context.answerability === 'grounded' ? 'Verified context' : 'Limited context'}</Text></View>
          </View>

          {result.response.requiresHumanReview && <View style={styles.review}><Text style={styles.reviewTitle}>Human review recommended</Text><Text style={styles.muted}>The system marked this response as low-confidence or data-limited. Treat it as informational, not a trading instruction.</Text></View>}

          <View style={styles.section}><Text style={styles.sectionTitle}>Evidence used</Text><View style={styles.card}>{result.context.evidence.filter((item) => result.response.evidenceIds.includes(item.id)).map((item) => <View key={item.id} style={styles.evidence}><View style={styles.evidenceIcon}><Text style={styles.evidenceIconText}>✓</Text></View><View style={styles.evidenceBody}><Text style={styles.evidenceTitle}>{item.label}</Text><Text style={styles.evidenceValue}>{item.value}</Text><Text style={styles.evidenceSource}>{item.source === 'risk_twin' ? 'Risk Twin' : item.source === 'knowledge' ? 'Knowledge reference' : 'Verified portfolio'}</Text></View></View>)}</View></View>

          <View style={styles.section}><Text style={styles.sectionTitle}>Limitations</Text><View style={styles.card}>{result.response.limitations.map((item, index) => <Text key={`${item}-${index}`} style={styles.muted}>• {item}</Text>)}</View></View>
          <Text style={styles.sync}>Context as of {new Date(result.context.asOf).toLocaleString()}</Text>
          <Pressable onPress={() => { setResult(null); setError(null); }} style={styles.newQuestion}><Text style={styles.newQuestionText}>Ask another question</Text></Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, flex:{flex:1}, content:{padding:spacing.lg,paddingBottom:52,gap:spacing.lg}, loading:{flex:1,alignItems:'center',justifyContent:'center',gap:spacing.sm}, eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:2}, title:{color:colors.text,fontSize:32,fontWeight:'900',marginTop:5}, subtitle:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:7}, card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:12}, label:{color:colors.muted,fontSize:11,fontWeight:'800'}, input:{minHeight:82,color:colors.text,fontSize:15,lineHeight:21,textAlignVertical:'top',paddingTop:8}, ask:{height:46,borderRadius:radius.md,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'}, askText:{color:colors.background,fontSize:13,fontWeight:'900'}, disabled:{opacity:0.45}, pressed:{opacity:0.72}, alert:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:6}, alertTitle:{color:colors.text,fontSize:13,fontWeight:'900'}, section:{gap:spacing.sm}, sectionTitle:{color:colors.text,fontSize:19,fontWeight:'900'}, suggestion:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}, suggestionText:{color:colors.text,fontSize:12,lineHeight:18,flex:1}, arrow:{color:colors.accent,fontSize:24,fontWeight:'700'}, answerCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.accent,borderRadius:radius.lg,padding:spacing.lg,gap:14}, answerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, answerLabel:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.4}, chip:{backgroundColor:colors.accentSoft,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:6}, chipText:{color:colors.text,fontSize:9,fontWeight:'900'}, answer:{color:colors.text,fontSize:15,lineHeight:24}, citation:{color:colors.accent,fontWeight:'900'}, metaRow:{flexDirection:'row',justifyContent:'space-between',gap:10}, review:{backgroundColor:colors.surfaceElevated,borderRadius:radius.md,padding:spacing.md,gap:6}, reviewTitle:{color:colors.text,fontSize:12,fontWeight:'900'}, evidence:{flexDirection:'row',gap:10,paddingVertical:5}, evidenceIcon:{width:25,height:25,borderRadius:13,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'}, evidenceIconText:{color:colors.accent,fontSize:11,fontWeight:'900'}, evidenceBody:{flex:1,gap:2}, evidenceTitle:{color:colors.text,fontSize:12,fontWeight:'900'}, evidenceValue:{color:colors.text,fontSize:12,lineHeight:17}, evidenceSource:{color:colors.muted,fontSize:9}, muted:{color:colors.muted,fontSize:11,lineHeight:17}, sync:{color:colors.muted,fontSize:9}, newQuestion:{alignItems:'center',paddingVertical:8}, newQuestionText:{color:colors.accent,fontSize:12,fontWeight:'900'}
});
