/**
 * Onboarding: rol seçenekleri ve seviye tespit soru havuzu (referans projeden)
 */

export const ONBOARDING_ROLES = [
  { id: 'barista', label: 'Baristayım', desc: 'Profesyonel olarak kahve hazırlıyorum' },
  { id: 'manager', label: 'Kafe Yöneticisiyim', desc: 'Bir kafenin operasyonunu yürütüyorum' },
  { id: 'owner', label: 'Dükkan Sahibiyim', desc: 'Kahve dükkanım veya markam var' },
  { id: 'learner', label: 'Öğrenmek İstiyorum', desc: 'Kahveye ilgim var, kendimi geliştirmek istiyorum' },
] as const;

export const ONBOARDING_QUESTION_POOL = [
  { q: 'Espresso demleme (extraction) süresi ortalama kaç saniyedir?', options: ['10-15 saniye', '25-30 saniye', '45-60 saniye', '1-2 dakika'], answer: 1 },
  { q: 'Latte Art için sütü kremalaştırırken ideal sıcaklık ortalama nedir?', options: ['40-45°C', '60-65°C', '80-85°C', '95-100°C'], answer: 1 },
  { q: 'V60, Chemex ve Aeropress gibi yöntemlere genel olarak ne ad verilir?', options: ['Cold Brew', 'Türk Kahvesi', 'Manuel Demleme', 'Kapsül Kahve'], answer: 2 },
  { q: 'Espresso yapımında kahve çekirdekleri nasıl öğütülmelidir?', options: ['Çok İnce (Pudra gibi)', 'İnce (İnce Tuz gibi)', 'Orta (Kum gibi)', 'Kalın (Kaya tuzu gibi)'], answer: 1 },
  { q: 'Latte ve Cappuccino arasındaki en belirgin köpük farkı nedir?', options: ['Latte daha yoğun köpüklüdür', 'Cappuccino daha az süt içerir ve köpüğü yoğundur', 'İkisi de tamamen aynıdır', 'Cappuccino kremasızdır'], answer: 1 },
  { q: 'Flat White hangi ülkenin kahve kültüründen dünyaya yayılmıştır?', options: ['İtalya', 'Avustralya / Yeni Zelanda', 'Amerika', 'Türkiye'], answer: 1 },
  { q: "Arabica çekirdeğinin Robusta'ya göre belirgin özelliği nedir?", options: ['Çok yüksek kafein içerir', 'Daha tatlı, asidik ve aromatiktir', 'Kalitesiz ve odunsudur', 'Sadece espresso için kullanılır'], answer: 1 },
  { q: 'Cold Brew (Soğuk Demleme) genellikle ne kadar süre demlenir?', options: ['3-5 dakika', '15-20 dakika', '1-2 saat', '12-24 saat'], answer: 3 },
  { q: 'Americano kahvesi nasıl hazırlanır?', options: ['Filtre kahve üzerine süt eklenerek', 'Espressonun üzerine sıcak su eklenerek', 'Sıcak suya kahve tozu atılarak', 'Süt köpüğü üzerine espresso dökülerek'], answer: 1 },
  { q: 'Single (Tek) shot espresso ortalama kaç mililitredir (ml)?', options: ['10-15 ml', '25-30 ml', '50-60 ml', '100-120 ml'], answer: 1 },
  { q: 'Mocha tarifinde espressonun içine belirgin olarak ne eklenir?', options: ['Karamel Şurubu', 'Çikolata (Toz veya Sos)', 'Fındık Şurubu', 'Vanilya Özütü'], answer: 1 },
  { q: 'Kahve çekirdeklerinin tazeliğini korumak için en iyi saklama yöntemi hangisidir?', options: ['Buzdolabında açık kapta', 'Güneş gören bir cam kavanozda', 'Işık ve hava almayan serin bir kapta', 'Derin dondurucuda su içinde'], answer: 2 },
];

/** Skora göre başlangıç puanı ve seviye (referans). App level: Beginner | Junior Barista | Barista | Senior Barista | Head Barista */
export function getOnboardingLevel(score: number): { grade: string; title: string; points: number; level: 'Beginner' | 'Junior Barista' | 'Barista' | 'Senior Barista' | 'Head Barista' } {
  if (score === 5) return { grade: 'C2', title: 'Master Barista', points: 1000, level: 'Head Barista' };
  if (score === 4) return { grade: 'C1', title: 'Advanced (Usta)', points: 700, level: 'Head Barista' };
  if (score === 3) return { grade: 'B2', title: 'Upper Intermediate (İleri)', points: 450, level: 'Senior Barista' };
  if (score === 2) return { grade: 'B1', title: 'Intermediate (Orta)', points: 250, level: 'Barista' };
  if (score === 1) return { grade: 'A2', title: 'Beginner (Başlangıç)', points: 100, level: 'Junior Barista' };
  return { grade: 'A1', title: 'Tadımlık (Çaylak)', points: 0, level: 'Beginner' };
}
