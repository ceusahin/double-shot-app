import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mainTabScrollBottomPadding } from '../constants/mainTabDock';

/** Ana sekme dock’u için dikey kaydırma alt boşluğu (px). */
export function useMainTabScrollPadding(): number {
  const insets = useSafeAreaInsets();
  return mainTabScrollBottomPadding(insets.bottom);
}
