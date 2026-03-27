import { Platform } from 'react-native';
import { getNotifications, isExpoGo } from './notificationsWrapper';

const REMINDER_DAYS_BEFORE_END = 10;
const DATA_TYPE = 'team_subscription_reminder';

/** Aynı ekip için daha önce planlanmış abonelik hatırlatıcılarını iptal eder. */
export async function cancelTeamSubscriptionReminders(teamId: string): Promise<void> {
  if (isExpoGo()) return;
  const Notifications = getNotifications();
  if (typeof Notifications.getAllScheduledNotificationsAsync !== 'function') return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    const data = n.content.data as { type?: string; teamId?: string } | undefined;
    if (data?.type === DATA_TYPE && data?.teamId === teamId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/**
 * Bitişe REMINDER_DAYS_BEFORE_END gün kala tek seferlik yerel bildirim planlar.
 * Süre 10 günden kısaysa veya geçmişse planlama yapılmaz (ekran üzerinden uyarı gösterilir).
 */
export async function scheduleTeamSubscriptionExpiryReminder(params: {
  teamId: string;
  teamName: string;
  subscriptionEndsAtIso: string;
}): Promise<void> {
  if (isExpoGo()) return;
  const Notifications = getNotifications();
  if (typeof Notifications.scheduleNotificationAsync !== 'function') return;

  const ends = new Date(params.subscriptionEndsAtIso);
  if (Number.isNaN(ends.getTime())) return;

  const reminderAt = new Date(ends);
  reminderAt.setDate(reminderAt.getDate() - REMINDER_DAYS_BEFORE_END);
  reminderAt.setHours(10, 0, 0, 0);

  const now = new Date();
  if (reminderAt.getTime() <= now.getTime()) {
    return;
  }

  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (perm.status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('subscription', {
      name: 'Abonelik',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4AF37',
    });
  }

  await cancelTeamSubscriptionReminders(params.teamId);

  const triggerType = Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ekip paket süreniz dolmak üzere',
      body: `"${params.teamName}" aboneliğinize yaklaşık ${REMINDER_DAYS_BEFORE_END} gün kaldı. Yenilemek için iletişime geçin.`,
      sound: true,
      data: { type: DATA_TYPE, teamId: params.teamId },
    },
    trigger: {
      type: triggerType,
      date: reminderAt,
      channelId: Platform.OS === 'android' ? 'subscription' : undefined,
    },
  });
}
