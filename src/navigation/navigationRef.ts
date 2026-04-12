import { createNavigationContainerRef } from '@react-navigation/native';

// Merkezi navigation ref: RootNavigator dışındaki yerler buradan import eder.
// Böylece ekranlar/komponentler RootNavigator'a bağımlı kalmaz ve require cycle azalır.
export const navigationRef = createNavigationContainerRef<{ Main: undefined }>();
