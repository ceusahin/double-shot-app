import type { TeamsStackParamList } from '../navigation/TeamsStack';

export const TEAM_MEMBER_FEATURE_KEYS = [
  'team_management',
  'shift_management',
  'timesheet_management',
  'shift_location_management',
  'shortage_list',
  'shot_notification',
  'inventory_management',
] as const;

export type TeamMemberFeatureKey = (typeof TEAM_MEMBER_FEATURE_KEYS)[number];

export type TeamFeatureCardDefinition = {
  key: TeamMemberFeatureKey;
  title: string;
  subtitle: string;
  icon: string;
  route: keyof TeamsStackParamList;
};

export const TEAM_FEATURE_CARDS: TeamFeatureCardDefinition[] = [
  {
    key: 'team_management',
    title: 'Ekip Yönetimi',
    subtitle: 'Üyeler ve roller',
    icon: 'people-outline',
    route: 'TeamManagement',
  },
  {
    key: 'shift_management',
    title: 'Vardiya Yönetimi',
    subtitle: 'Haftalık plan',
    icon: 'calendar-outline',
    route: 'ShiftManagement',
  },
  {
    key: 'timesheet_management',
    title: 'Puantaj Yönetimi',
    subtitle: 'Giriş/çıkış kayıtları',
    icon: 'document-text-outline',
    route: 'Timesheet',
  },
  {
    key: 'shift_location_management',
    title: 'Vardiya Konumu',
    subtitle: 'Mağaza alanı',
    icon: 'location-outline',
    route: 'ShiftLocationManagement',
  },
  {
    key: 'shortage_list',
    title: 'Eksik Listesi',
    subtitle: 'Çalışma alanı eksikleri',
    icon: 'list-circle-outline',
    route: 'ShortageList',
  },
  {
    key: 'shot_notification',
    title: 'Shot Bildirim',
    subtitle: 'Ekibe hızlı duyuru',
    icon: 'flash-outline',
    route: 'ShotNotification',
  },
  {
    key: 'inventory_management',
    title: 'Depo Stok Yönetimi',
    subtitle: 'Stok ve kritik seviye',
    icon: 'cube-outline',
    route: 'InventoryManagement',
  },
];
