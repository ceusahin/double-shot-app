import type { Team } from '../types';

const INVITE_HINT =
  'Üyeleri davet etmek için takım sayfasında sağ üstten "Ekibe davet et" ile süreli link oluşturun.';

/** Takım oluşturuldu diyaloğunun gövde metni: abonelik/kota + davet ipucu. */
export function buildTeamCreatedBody(team: Team): string {
  const parts: string[] = [];

  if (team.subscription_plan === 'trial') {
    parts.push('15 günlük deneme süreniz aktifleştirildi.');
  } else if (team.subscription_billing_months === 1) {
    parts.push('1 aylık ekip kotanız aktifleştirildi.');
  } else if (team.subscription_billing_months === 3) {
    parts.push('3 aylık ekip kotanız aktifleştirildi.');
  } else if (team.subscription_billing_months === 6) {
    parts.push('6 aylık ekip kotanız aktifleştirildi.');
  } else if (team.subscription_ends_at && team.subscription_plan && team.subscription_plan !== 'trial') {
    parts.push('Paket süreniz aktifleştirildi.');
  } else {
    parts.push('Ekip kurma kotanız kullanıma hazır.');
  }

  parts.push('');
  parts.push(INVITE_HINT);
  return parts.join('\n');
}
