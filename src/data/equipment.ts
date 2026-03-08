/**
 * Makine & ekipman: arıza çözümü ve bakım takvimi (referans projeden)
 */

export const EQUIPMENT_CATEGORIES = [
  { id: 'espresso', label: 'Espresso' },
  { id: 'grinder', label: 'Değirmen' },
  { id: 'water', label: 'Su & Filtre' },
] as const;

export interface FaultItem {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  symptoms: string;
  solutions: string[];
}

export const EQUIPMENT_FAULTS: Record<string, FaultItem[]> = {
  espresso: [
    {
      id: 'esp-1',
      title: 'Grup başlığından su akışı yok / damlıyor',
      severity: 'medium',
      symptoms: 'Düğmeye basıldığında pompa sesi geliyor ama kahve akmıyor veya çok yavaş damlıyor.',
      solutions: [
        'Espresso öğütüm inceliğini kontrol et: Çok ince öğütülmüş olabilir.',
        'Dozu kontrol et: Sepete fazla kahve konmuş olabilir.',
        'Grup duş telini sök ve temizle, kör tıkanıklık olabilir.',
        'Makine bekleme/ısınma modunda mı? Ekrandan basıncı kontrol et.',
      ],
    },
    {
      id: 'esp-2',
      title: 'Buhar çubuğunda düşük basınç sorunu',
      severity: 'low',
      symptoms: 'Sütü kremalaştırırken yeterli girdap/basınç oluşmuyor.',
      solutions: [
        'Buhar çubuğunun ucundaki (nozul) delikler süt tabakasıyla tıkanmış olabilir. İğne veya kürdan ile temizle.',
        'Vanayı tam olarak açtığından emin ol.',
        'Kazan basınç (boiler) göstergesi 1.0 - 1.5 bar arasında olmalıdır, kontrol et.',
      ],
    },
    {
      id: 'esp-3',
      title: 'Makinenin altından su kaçırıyor',
      severity: 'high',
      symptoms: 'Tezgaha sürekli temiz veya kirli su sızıntısı var.',
      solutions: [
        'Drenaj (tahliye) borusu tıkanmış olabilir veya tepsiden taşmış olabilir. Tepsinin altını kontrol et.',
        'Şebeke giriş valfini kapatarak güvenliği sağla.',
        'Durum devam ediyorsa KESİNLİKLE müdahale etme ve teknik servisi ara.',
      ],
    },
  ],
  grinder: [
    {
      id: 'grind-1',
      title: 'Değirmen çalışıyor ama kahve vermiyor (Tıkanma)',
      severity: 'medium',
      symptoms: 'Motor sesi var fakat chute (oluk) kısmından kahve dökülmüyor.',
      solutions: [
        'Aşırı ince veya nemli kahve çekirdeği diskleri tıkamış olabilir. Öğütümü 2-3 tık kalınlaştırıp boşta çalıştır.',
        'Oluk (chute) kısmını fırça ile nazikçe temizle.',
        'Değirmen fişten çekili ve tamamen boşalmışken hopperı çıkarıp disk aralarını vakumla temizle.',
      ],
    },
  ],
  water: [
    {
      id: 'water-1',
      title: 'Kahvenin tadı asidik (Ekşi) veya klorlu gelmeye başladı',
      severity: 'medium',
      symptoms: 'Reçete doğru olmasına rağmen tat profili negatif yönde değişti.',
      solutions: [
        'Su arıtma filtresinin ömrü dolmuş olabilir, son değişim tarihini kontrol et.',
        'By-pass ayarlarında valf kaçırmış veya değişmiş olabilir.',
        'Arıtma şirketini filtre değişimi için çağır.',
      ],
    },
  ],
};

export interface MaintenanceTask {
  id: number;
  title: string;
  period: string;
  status: 'todo' | 'done';
}

export const MAINTENANCE_TASKS: MaintenanceTask[] = [
  { id: 1, title: 'Espresso - Kör Filtre (Backflush)', period: 'Günlük (Kapanış)', status: 'todo' },
  { id: 2, title: 'Buhar Çubuğu Kimyasalı ile Süt Borusu Temizliği', period: 'Günlük (Kapanış)', status: 'done' },
  { id: 3, title: 'Değirmen Hoppar Yıkama & Kurulama', period: 'Haftalık', status: 'todo' },
  { id: 4, title: 'Su Arıtma Sistemi Tuz Check-up / Filtrasyon', period: 'Aylık', status: 'todo' },
  { id: 5, title: 'Espresso - Duş Telleri PulyCaff ile Bekletme', period: 'Haftalık', status: 'todo' },
];
