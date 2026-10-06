/**
 * Push auf dem Handy (Expo Push Service). Voraussetzung: echtes Gerät und ein Expo-Projekt
 * (`extra.eas.projectId` in app.json, kommt mit dem Entwicklungs-Build). Ohne das meldet
 * `pushStatus` „nicht verfügbar“ und die App funktioniert ohne Push.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { openLink } from './links';

export type PushState = 'unsupported' | 'off' | 'denied' | 'on';

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

let currentToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Api = <T>(
  path: string,
  options?: { method?: 'POST' | 'DELETE'; body?: unknown },
) => Promise<T>;

export async function pushState(): Promise<PushState> {
  if (!Device.isDevice || !projectId) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') return 'denied';
  return status === 'granted' ? 'on' : 'off';
}

/** Meldet das Gerät an; `ask` fragt bei Bedarf nach der Erlaubnis. */
export async function enablePush(api: Api, ask: boolean): Promise<PushState> {
  const state = await pushState();
  if (state === 'unsupported' || state === 'denied') return state;
  if (state === 'off') {
    if (!ask) return 'off';
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return 'denied';
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Clubroof',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  currentToken = data;
  await api('/me/devices', { method: 'POST', body: { token: data, platform: Platform.OS } });
  return 'on';
}

/** Beim Abmelden: dieses Gerät bekommt keine Push-Nachrichten mehr für das Konto. */
export async function disablePush(api: Api) {
  if (!currentToken) return;
  await api('/me/devices', { method: 'DELETE', body: { token: currentToken } }).catch(() => {});
  currentToken = null;
}

/** Antippen einer Push-Nachricht öffnet den Inhalt – auch beim Kaltstart der App. */
export function listenForPushTaps(): () => void {
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    const link = r?.notification.request.content.data?.link;
    if (typeof link === 'string') openLink(link);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const link = r.notification.request.content.data?.link;
    if (typeof link === 'string') openLink(link);
  });
  return () => sub.remove();
}
