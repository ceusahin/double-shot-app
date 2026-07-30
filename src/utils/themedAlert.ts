export type ThemedAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type ThemedAlertPayload = {
  title: string;
  message?: string;
  buttons: ThemedAlertButton[];
  cancelable?: boolean;
};

let applyPayload: ((p: ThemedAlertPayload | null) => void) | null = null;

/** Root’taki ThemedAlertHost mount olunca çağrılır */
export function registerThemedAlertHost(host: (p: ThemedAlertPayload | null) => void) {
  applyPayload = host;
}

export function unregisterThemedAlertHost() {
  applyPayload = null;
}

/**
 * RN Alert.alert ile aynı imza: başlık, mesaj, butonlar.
 * Android’de sistem diyaloğu yerine uygulama temalı modal kullanılır.
 */
export function themedAlert(
  title: string,
  message?: string,
  buttons?: ThemedAlertPayload['buttons'],
  options?: { cancelable?: boolean }
) {
  const list =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: 'Tamam', style: 'default' as const, onPress: () => {} }];
  applyPayload?.({
    title,
    message,
    buttons: list,
    cancelable: options?.cancelable !== false,
  });
}

export function dismissThemedAlert() {
  applyPayload?.(null);
}
