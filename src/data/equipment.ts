/**
 * Makine & ekipman: arıza çözümü ve bakım takvimi (referans projeden)
 */

export const EQUIPMENT_CATEGORIES = [
  { id: 'espresso', label: 'Espresso' },
  { id: 'grinder', label: 'Değirmen' },
  { id: 'water', label: 'Su & Filtre' },
  { id: 'brewer', label: 'Filtre Demleme' },
  { id: 'ice', label: 'Buz Makinesi' },
  { id: 'refrigeration', label: 'Soğutma' },
  { id: 'dishwasher', label: 'Bulaşık' },
  { id: 'oven', label: 'Fırın' },
  { id: 'fryer', label: 'Fritöz' },
  { id: 'grill', label: 'Izgara / Salamander' },
  { id: 'hood', label: 'Davlumbaz & Havalandırma' },
  { id: 'pos', label: 'POS & Adisyon' },
  { id: 'payment', label: 'Ödeme Cihazı' },
  { id: 'printer', label: 'Mutfak / Adisyon Yazıcıları' },
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
    {
      id: 'grind-2',
      title: 'Öğütüm tutarsız (bir kalın bir ince)',
      severity: 'medium',
      symptoms: 'Aynı reçetede shot süreleri ciddi dalgalanıyor, crema dengesiz.',
      solutions: [
        'Disklerin aşınma durumunu kontrol et; kullanım saatini geçen bıçakları değiştir.',
        'Hopper içinde farklı kavrum/çekirdek karışımı olup olmadığını kontrol et.',
        'Değirmeni boşaltıp tekrar tek bir çekirdek ile kalibrasyon yap.',
        'Statik elektrik için ortam nemini ve değirmen topraklamasını kontrol et.',
      ],
    },
    {
      id: 'grind-3',
      title: 'Değirmen aşırı ısınıyor',
      severity: 'high',
      symptoms: 'Uzun kullanımda gövdede belirgin ısı artışı ve yanık koku.',
      solutions: [
        'Servisi yavaşlatıp değirmene kısa soğuma aralığı ver.',
        'Tıkanma kaynaklı yük artışı için öğütüm yolunu temizle.',
        'Motor havalandırma kanallarının açık olduğundan emin ol.',
        'Koku devam ediyorsa cihazı kapatıp teknik servise yönlendir.',
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
    {
      id: 'water-2',
      title: 'Su debisi düştü, cihazlar yavaş doluyor',
      severity: 'medium',
      symptoms: 'Makine kazan dolumu ve çay/sıcak su çıkışı normalden yavaş.',
      solutions: [
        'Ön filtrede tortu birikimi olup olmadığını kontrol et.',
        'Ana su giriş vanasının tam açık olduğundan emin ol.',
        'Filtre değişim tarihi geçtiyse kartuş değişimi planla.',
        'Debi düşük kalırsa tesisat kaynaklı problem için teknik destek çağır.',
      ],
    },
  ],
  brewer: [
    {
      id: 'brew-1',
      title: 'Filtre kahve zayıf ve sulu çıkıyor',
      severity: 'low',
      symptoms: 'Aynı reçetede gövde düşük, tat belirgin şekilde sulu.',
      solutions: [
        'Öğütümü bir tık incelt ve reçeteyi yeniden test et.',
        'Demleme sepetinde kanal oluşumu olup olmadığını kontrol et.',
        'Su sıcaklığını 92-96°C aralığında doğrula.',
      ],
    },
    {
      id: 'brew-2',
      title: 'Filtre kahve acı ve yanık tatta',
      severity: 'low',
      symptoms: 'Demleme sonunda yüksek acılık, uzun bitiş, yanık algısı.',
      solutions: [
        'Öğütümü bir tık kalınlaştır ve temas süresini kısalt.',
        'Kullanılan kahvenin kavrum tarihini ve tazeliğini kontrol et.',
        'Demleme ekipmanındaki eski yağ birikimlerini temizle.',
      ],
    },
  ],
  ice: [
    {
      id: 'ice-1',
      title: 'Buz üretimi yetersiz',
      severity: 'medium',
      symptoms: 'Yoğun saat öncesi bunker dolmuyor, üretim aralığı uzuyor.',
      solutions: [
        'Kondenser peteklerini toz/kir açısından temizle.',
        'Su giriş filtresi ve hattı basıncını kontrol et.',
        'Cihaz etrafında yeterli havalandırma boşluğu olduğundan emin ol.',
      ],
    },
    {
      id: 'ice-2',
      title: 'Buzlar kokulu veya bulanık',
      severity: 'high',
      symptoms: 'Buzda yabancı koku, bulanıklık veya tat bozukluğu.',
      solutions: [
        'Bunker içini gıda uyumlu temizleyici ile sanitize et.',
        'Su filtrasyon sistemini ve değişim tarihini kontrol et.',
        'Hijyen riski nedeniyle sorun sürerse buz kullanımını durdur.',
      ],
    },
  ],
  refrigeration: [
    {
      id: 'cold-1',
      title: 'Buzdolabı hedef sıcaklığa inmiyor',
      severity: 'high',
      symptoms: 'Dolap içi ısı 8°C üzeri, ürünler yeterince soğumuyor.',
      solutions: [
        'Kapı contasında boşluk/hasar olup olmadığını kontrol et.',
        'Kondanser temizliğini yap ve hava sirkülasyonunu aç.',
        'Dolap içi raf yerleşimini hava akışını kesmeyecek şekilde düzelt.',
        'Sıcaklık düşmüyorsa ürün güvenliği için alternatif depolamaya geç ve servisi çağır.',
      ],
    },
    {
      id: 'cold-2',
      title: 'Derin dondurucuda karlanma artışı',
      severity: 'medium',
      symptoms: 'Kısa sürede yoğun buzlanma ve kapak kapanışında zorlanma.',
      solutions: [
        'Kapak aç-kapa sıklığını azaltacak servis akışı planla.',
        'Conta kaçağı ve kapı hizasını kontrol et.',
        'Planlı defrost uygulayıp iç yüzeyi kuru bırak.',
      ],
    },
  ],
  dishwasher: [
    {
      id: 'dw-1',
      title: 'Bardaklar mat ve lekeli çıkıyor',
      severity: 'medium',
      symptoms: 'Yıkama sonrası su lekesi, matlık ve koku kalıntısı.',
      solutions: [
        'Parlatıcı (rinse aid) seviyesini ve dozaj ayarını kontrol et.',
        'Yıkama sıcaklığını cihaz standardına göre doğrula.',
        'Filtre ve püskürtme kollarını söküp temizle.',
      ],
    },
    {
      id: 'dw-2',
      title: 'Makine su boşaltmıyor',
      severity: 'high',
      symptoms: 'Program bitiminde tabanda su kalıyor, taşma riski oluşuyor.',
      solutions: [
        'Drenaj hortumunda kıvrılma/tıkanma kontrolü yap.',
        'Pompa filtresini temizle.',
        'Sorun sürerse cihazı durdurup teknik servise bildir.',
      ],
    },
  ],
  oven: [
    {
      id: 'oven-1',
      title: 'Fırın dengesiz pişiriyor',
      severity: 'medium',
      symptoms: 'Aynı tepside ürünlerin bir kısmı fazla, bir kısmı az pişiyor.',
      solutions: [
        'Fanlı mod ve raf yerleşimini ürün tipine göre yeniden ayarla.',
        'Kapak contası kaçağı olup olmadığını kontrol et.',
        'İç hazneyi ve hava kanallarını yağ birikimine karşı temizle.',
      ],
    },
    {
      id: 'oven-2',
      title: 'Ön ısıtma süresi normalden uzun',
      severity: 'high',
      symptoms: 'Cihaz hedef sıcaklığa geç ulaşıyor, servis akışı gecikiyor.',
      solutions: [
        'Gerilim dengesizliği için elektrik hattını kontrol ettir.',
        'Rezistans performans düşüşü ihtimali için servis kaydı aç.',
        'Geçici olarak düşük hacimli batch planına geçerek servis gecikmesini azalt.',
      ],
    },
  ],
  fryer: [
    {
      id: 'fry-1',
      title: 'Fritöz geç ısınıyor veya hedef sıcaklığa çıkmıyor',
      severity: 'high',
      symptoms: 'Yağ uzun sürede ısınıyor, ürünler yağ çekiyor ve servis gecikiyor.',
      solutions: [
        'Fritözdeki yağ seviyesini min-max çizgisine göre kontrol et.',
        'Termostat ayarı ve ekran hedef sıcaklığının doğru olduğundan emin ol.',
        'Rezistans çevresinde yanık kırıntı/karbon birikimini temizle.',
        'Isınma sorunu devam ederse cihazı servis dışı bırakıp teknik servise bildir.',
      ],
    },
    {
      id: 'fry-2',
      title: 'Yağ köpürüyor ve taşma eğilimi var',
      severity: 'high',
      symptoms: 'Kızartma sırasında yoğun köpürme ve taşma riski oluşuyor.',
      solutions: [
        'Yağ kalitesini kontrol et; kullanım ömrü dolduysa değiştir.',
        'Islak/çözdürülmemiş ürünü doğrudan yağa atma.',
        'Sepeti kapasitenin üstünde doldurmadan parti parti pişir.',
        'Köpürme sürerse cihazı kapat, yağı güvenli şekilde soğut ve raporla.',
      ],
    },
  ],
  grill: [
    {
      id: 'grill-1',
      title: 'Izgara yüzeyi eşit ısıtmıyor',
      severity: 'medium',
      symptoms: 'Aynı plakada ürünlerin bir kısmı yanarken bir kısmı çiğ kalıyor.',
      solutions: [
        'Pişirme öncesi yeterli ön ısıtma süresi verdiğinden emin ol.',
        'Yüzeyi kazıyıp karbon birikimini temizle.',
        'Bölgesel ısı farkı sürüyorsa rezistans/gaz hattı kontrolü için teknik destek çağır.',
      ],
    },
    {
      id: 'grill-2',
      title: 'Salamander üstten kızartma zayıf',
      severity: 'medium',
      symptoms: 'Ürün yüzeyinde beklenen kızarma olmuyor, servis süresi uzuyor.',
      solutions: [
        'Raf yüksekliğini ürüne göre doğru seviyeye al.',
        'Rezistansların aktif olduğundan ve mod seçiminin doğru olduğundan emin ol.',
        'Yağ/kurum tabakası varsa cihazı soğutup derin temizlik yap.',
      ],
    },
  ],
  hood: [
    {
      id: 'hood-1',
      title: 'Davlumbaz çekişi düştü, ortam dumanlanıyor',
      severity: 'high',
      symptoms: 'Mutfakta buhar ve koku birikiyor, çalışan konforu düşüyor.',
      solutions: [
        'Metal yağ filtrelerini söküp temizle ve tamamen kurutarak tak.',
        'Fan devri/anahtar kademelerinin çalıştığını kontrol et.',
        'Kanallarda tıkanma şüphesi varsa bakım firmasına yönlendir.',
      ],
    },
    {
      id: 'hood-2',
      title: 'Davlumbazdan anormal titreşim veya ses geliyor',
      severity: 'high',
      symptoms: 'Fan çalışırken sürtme, vuruntu veya yüksek uğultu sesi oluşuyor.',
      solutions: [
        'Cihazı güvenli şekilde kapatıp gevşek panel/vida olup olmadığını kontrol et.',
        'Fan pervanesinde yağ birikimi ve balans problemi ihtimalini değerlendir.',
        'Sesi zorlayarak çalıştırma; teknik servise öncelikli kayıt aç.',
      ],
    },
  ],
  pos: [
    {
      id: 'pos-1',
      title: 'Adisyon ekranı donuyor veya sipariş geç düşüyor',
      severity: 'medium',
      symptoms: 'Sipariş girişi gecikiyor, masaya yanlış/eksik ürün riski artıyor.',
      solutions: [
        'Uygulamayı kapat-aç ve cihaz hafızasında açık gereksiz uygulamaları kapat.',
        'Wi-Fi sinyal gücünü kontrol et, gerekiyorsa erişim noktasına yaklaş.',
        'Eş zamanlı sipariş yoğunluğunda terminali yeniden başlat.',
      ],
    },
    {
      id: 'pos-2',
      title: 'Sipariş mutfağa düşmüyor',
      severity: 'high',
      symptoms: 'Kasada girilen sipariş mutfak ekranında/yazıcıda görünmüyor.',
      solutions: [
        'Sipariş kanalının doğru mutfak istasyonuna yönlendirildiğini kontrol et.',
        'Mutfak yazıcısı veya KDS bağlantısını test et (test baskısı).',
        'Aynı siparişi tekrar göndermeden önce sistemde kuyrukta olup olmadığını kontrol et.',
        'Sorun sürerse manuel bilgilendirme yapıp teknik destek çağır.',
      ],
    },
  ],
  payment: [
    {
      id: 'pay-1',
      title: 'Temassız ödeme okumuyor',
      severity: 'medium',
      symptoms: 'NFC kart/telefon birden çok denemede okunmuyor.',
      solutions: [
        'Terminali yeniden başlat ve batarya seviyesini kontrol et.',
        'Cihaz ağ bağlantısını (Wi-Fi/SIM) doğrula.',
        'Temassız limit üstü işlemse çip+PIN yöntemine yönlendir.',
      ],
    },
    {
      id: 'pay-2',
      title: 'Ödeme provizyonda kalıyor',
      severity: 'high',
      symptoms: 'İşlem ne onay ne red veriyor, müşteri bekliyor.',
      solutions: [
        'Ağ kalitesini kontrol edip işlemi iptal/tekrar adımıyla güvenli şekilde yönet.',
        'Aynı tutarı çift çekim yapmamak için POS işlem geçmişini kontrol et.',
        'Müşteriye süreç hakkında net bilgi verip alternatif ödeme yöntemi sun.',
      ],
    },
  ],
  printer: [
    {
      id: 'print-1',
      title: 'Yazıcıdan çıktı soluk veya eksik',
      severity: 'low',
      symptoms: 'Adisyon satırları silik, bazı satırlar okunmuyor.',
      solutions: [
        'Termal kağıdı doğru yönde yerleştir ve rulonun kaliteli olduğundan emin ol.',
        'Yazıcı kafasını üretici önerisine uygun temizleyiciyle temizle.',
        'Aynı sorun devam ediyorsa yazıcı kafası ömrünü kontrol ettir.',
      ],
    },
    {
      id: 'print-2',
      title: 'Yazıcı çevrimdışı görünüyor',
      severity: 'medium',
      symptoms: 'Sipariş gönderiliyor ama yazıcı tepki vermiyor.',
      solutions: [
        'Güç ve ağ kablolarını/bağlantı ışıklarını kontrol et.',
        'IP eşleşmesi değiştiyse ağ ayarını yeniden tanımla.',
        'Yazıcıyı kapat-aç yapıp test baskısı al.',
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
  { id: 1, title: 'Espresso makinesinde suyla backflush', period: 'Günlük (Açılış + Kapanış)', status: 'todo' },
  { id: 2, title: 'Buhar çubuğu nozul sök-temizle-sanitize', period: 'Günlük (Kapanış)', status: 'todo' },
  { id: 3, title: 'Değirmen çıkış oluğu ve doz haznesi temizliği', period: 'Günlük (Kapanış)', status: 'todo' },
  { id: 4, title: 'Buz makinesi bunker içi hijyen kontrolü', period: 'Günlük (Açılış)', status: 'todo' },
  { id: 5, title: 'Bulaşık makinesi filtre ve püskürtme kolu temizliği', period: 'Günlük (Kapanış)', status: 'todo' },
  { id: 6, title: 'Espresso duş teli ve conta söküp kimyasal bekletme', period: 'Haftalık', status: 'todo' },
  { id: 7, title: 'Değirmen hopper yıkama ve tamamen kurutma', period: 'Haftalık', status: 'todo' },
  { id: 8, title: 'Buz makinesi kondenser petek temizliği', period: 'Haftalık', status: 'todo' },
  { id: 9, title: 'Soğutucu kapı contası ve kapanma testleri', period: 'Haftalık', status: 'todo' },
  { id: 10, title: 'Filtre kahve ekipmanlarında yağ çözücü temizlik', period: 'Haftalık', status: 'todo' },
  { id: 11, title: 'Su filtrasyon kartuş ömür kontrolü', period: 'Aylık', status: 'todo' },
  { id: 12, title: 'Espresso makinesi kazan basınç/sıcaklık doğrulaması', period: 'Aylık', status: 'todo' },
  { id: 13, title: 'Fırın contası, fan ve rezistans performans kontrolü', period: 'Aylık', status: 'todo' },
  { id: 14, title: 'Buzdolabı/derin dondurucu termometre kalibrasyonu', period: 'Aylık', status: 'todo' },
  { id: 15, title: 'Elektrik kablo ve priz görsel güvenlik kontrolü', period: 'Aylık', status: 'todo' },
];
