/**
 * Yetki anahtarlarını (key) uygulama içinde okunabilir Türkçe etiketlere çevirir.
 * DB'deki description varsa o kullanılır, yoksa bu map kullanılır.
 */

const KEY_LABELS: Record<string, string> = {
  create_shift: 'Vardiya oluşturabilir',
  edit_shift: 'Vardiyayı düzenleyebilir',
  delete_shift: 'Vardiyayı silebilir',
  view_reports: 'Raporları görüntüleyebilir',
  send_shot_notification: 'Shot bildirimi gönderebilir',
  manage_training: 'Eğitim modüllerini yönetebilir',
  assign_roles: 'Üyelere rol atayabilir',
  manage_roles: 'Rol ve yetkileri düzenleyebilir',
};

export function getPermissionDisplayName(permission: { key: string; description?: string | null }): string {
  if (permission.description?.trim()) return permission.description.trim();
  return KEY_LABELS[permission.key] ?? permission.key.replace(/_/g, ' ');
}
