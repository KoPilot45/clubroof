/** Im Browser gibt es keinen Push (Benachrichtigungen erscheinen im Notification-Center). */
export type PushState = 'unsupported' | 'off' | 'denied' | 'on';

export async function pushState(): Promise<PushState> {
  return 'unsupported';
}

export async function enablePush(): Promise<PushState> {
  return 'unsupported';
}

export async function disablePush() {}

export function listenForPushTaps(): () => void {
  return () => {};
}
