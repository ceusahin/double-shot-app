import { spacing } from '../utils/theme';

/**
 * Ana sekme dock’unun (tabBarOuter + dock + güvenli alan payı) yaklaşık toplam yüksekliği.
 * - Sahne tam ekran + dock overlay ile içerik dock altına uzar.
 * - Scroll içerik alt boşluğu ve alt gradient şeridi bu değere göre hizalanır.
 */
export const MAIN_TAB_DOCK_BLOCK_HEIGHT = 120;

/** Dock üstündeki karartma bandı (~40 px) için telafi payı. */
const MAIN_TAB_DOCK_TOP_SCRIM_CLEARANCE = 40;

/** Dock ile son içerik satırı arasında ek nefes payı (px) — üst scrim karartması dahil. */
const MAIN_TAB_SCROLL_DOCK_CLEARANCE = spacing.xl + MAIN_TAB_DOCK_TOP_SCRIM_CLEARANCE;

/**
 * Ana sekmeler (Home / Tarifler / Operasyon / Ekip) görünürken ScrollView / FlatList
 * `contentContainerStyle` alt boşluğu — dock üstünde kalmak için + home indicator payı.
 */
export function mainTabScrollBottomPadding(safeAreaBottomInset: number): number {
  return (
    MAIN_TAB_DOCK_BLOCK_HEIGHT +
    spacing.xxl +
    Math.max(safeAreaBottomInset, spacing.sm) +
    MAIN_TAB_SCROLL_DOCK_CLEARANCE
  );
}
