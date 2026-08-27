import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getAccessToken } from '@/auth';
import { colors, radius, spacing } from '@/theme';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

type NotificationItem = {
  id: number;
  severity: string;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

async function authed(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) { router.replace('/login'); throw new Error('Sign in required'); }
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([authed('/security/notifications?limit=50'), authed('/security/notifications/unread-count')]);
      setItems(Array.isArray(list) ? list : []);
      setUnread(Number(count?.count ?? count ?? 0));
    } catch (error) {
      Alert.alert('Notifications', error instanceof Error ? error.message : 'Unable to load notifications');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: number) {
    try { await authed(`/security/notifications/${id}/read`, { method: 'POST' }); await load(); }
    catch (error) { Alert.alert('Notifications', error instanceof Error ? error.message : 'Unable to update notification'); }
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Text style={styles.eyebrow}>INTELLIGENCE</Text>
        <View style={styles.header}><View><Text style={styles.title}>Notification Inbox</Text><Text style={styles.sub}>{unread} unread notification{unread === 1 ? '' : 's'}</Text></View><Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable></View>
        {items.length === 0 ? <View style={styles.card}><Text style={styles.empty}>You’re all caught up.</Text><Text style={styles.sub}>New portfolio intelligence notifications will appear here.</Text></View> :
          items.map(item => <Pressable key={item.id} style={[styles.card, item.readAt ? styles.read : styles.unread]} onPress={() => !item.readAt && markRead(item.id)}>
            <View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.severity}>{item.severity.toUpperCase()}</Text></View>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.meta}>{item.readAt ? 'Read' : 'Unread'}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ''}</Text>
          </Pressable>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, content:{padding:spacing.lg,paddingBottom:48,gap:spacing.md},
  eyebrow:{color:colors.accent,fontSize:11,fontWeight:'900',letterSpacing:1.5}, header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  title:{color:colors.text,fontSize:28,fontWeight:'900'}, sub:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:5}, back:{color:colors.accent,fontWeight:'900',paddingTop:6},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.lg}, unread:{borderColor:colors.accent}, read:{opacity:0.72},
  row:{flexDirection:'row',justifyContent:'space-between',gap:12}, cardTitle:{color:colors.text,fontSize:15,fontWeight:'900',flex:1}, severity:{color:colors.accent,fontSize:9,fontWeight:'900'},
  message:{color:colors.text,fontSize:13,lineHeight:19,marginTop:8}, meta:{color:colors.muted,fontSize:10,marginTop:10}, empty:{color:colors.text,fontSize:16,fontWeight:'900'}
});