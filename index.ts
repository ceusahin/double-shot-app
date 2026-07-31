import './src/polyfills/crypto';
import * as ScreenOrientation from 'expo-screen-orientation';
import { registerRootComponent } from 'expo';

import App from './App';

void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

registerRootComponent(App);
