import { AppState, type AppStateStatus } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/** Tam ekip programı tablosu açıkken true; diğer durumlarda portrait zorlanır. */
let teamScheduleFullscreenOpen = false;

export function setTeamScheduleFullscreenOpen(open: boolean) {
  teamScheduleFullscreenOpen = open;
}

export function isTeamScheduleFullscreenOpen() {
  return teamScheduleFullscreenOpen;
}

/** Tam ekran tablo dışındayken dikey kilidi uygula (sistem döndürmesi açık olsa bile). */
export async function lockPortraitUnlessFullscreen() {
  if (teamScheduleFullscreenOpen) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    /* native / Expo Go farkları */
  }
}

/**
 * Tam ekran tablodan çıkışta: yataydan kesin dikeye dön.
 * Android’de bazen önce unlock gerekir; ardından PORTRAIT + PORTRAIT_UP ve bir kare sonra tekrar.
 */
export async function forcePortraitLock() {
  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    /* bazı cihazlarda yataydan çıkış için önce unlock gerekir; hemen ardından portrait kilitlenir */
  }
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
  } catch {
    /* */
  }
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    /* */
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    /* */
  }
}

/**
 * Sadece başka uygulamadan dönüşte portrait kilitle.
 * Ekran döndürmede sık görülen `inactive` → `active` ile portrait zorlanmasın
 * (tam ekran tablo yatayda kalabilsin).
 */
export function subscribeAppStatePortraitLock() {
  let previous = AppState.currentState;
  const sub = AppState.addEventListener('change', (next) => {
    const wasInBackground = previous === 'background';
    previous = next;
    if (next === 'active' && wasInBackground) void lockPortraitUnlessFullscreen();
  });
  return () => sub.remove();
}
