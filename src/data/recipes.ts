/**
 * Global tarifler: tamamı alkolsüz, güncel ve operasyon dostu reçeteler.
 */

export interface RecipeItem {
  id: string;
  name: string;
  desc: string;
  type: string;
}

export interface RecipeDetailData {
  name: string;
  desc: string;
  stats: { time: string; water: string; temp: string; ratio: string };
  steps: string[];
}

/** Sıcak içecekler (Türkiye'de yaygın tercih) */
export const KAHVELER: RecipeItem[] = [
  { id: 'turkish-coffee', name: 'Türk Kahvesi', desc: 'Köpüğü korunmuş geleneksel sunum', type: 'Sıcak / Geleneksel' },
  { id: 'espresso', name: 'Espresso', desc: 'Yoğun, dengeli ve kısa shot', type: 'Sıcak / Klasik' },
  { id: 'americano', name: 'Americano', desc: 'Espresso bazlı yumuşak içim', type: 'Sıcak / Klasik' },
  { id: 'cappuccino', name: 'Cappuccino', desc: 'Mikro köpüklü süt dengesi', type: 'Sütlü / Sıcak' },
  { id: 'latte', name: 'Cafe Latte', desc: 'Yüksek süt oranlı yumuşak profil', type: 'Sütlü / Sıcak' },
  { id: 'mocha', name: 'Cafe Mocha', desc: 'Çikolata + espresso birleşimi', type: 'Sütlü / Sıcak' },
  { id: 'filter-coffee', name: 'Filtre Kahve', desc: 'Günlük servis için dengeli demleme', type: 'Filtre / Sıcak' },
  { id: 'salep', name: 'Salep', desc: 'Tarçınlı sıcak kış içeceği', type: 'Sıcak / Klasik' },
];

/** Soğuk içecekler (Türkiye'de yaygın tercih) */
export const ICECEKLER: RecipeItem[] = [
  { id: 'iced-americano', name: 'Iced Americano', desc: 'Soğuk, ferah espresso bazlı', type: 'Soğuk Kahve' },
  { id: 'iced-latte', name: 'Iced Latte', desc: 'Sütlü soğuk kahve klasiği', type: 'Soğuk Kahve' },
  { id: 'cold-brew', name: 'Cold Brew', desc: 'Uzun demleme, düşük asidite', type: 'Soğuk Kahve' },
  { id: 'caramel-frappe', name: 'Caramel Frappe', desc: 'Blender bazlı soğuk kahve içeceği', type: 'Soğuk / Blender' },
  { id: 'frozen-lemonade', name: 'Frozen Limonata', desc: 'Buzlu, yoğun limonata', type: 'Soğuk / Alkolsüz' },
  { id: 'strawberry-matcha', name: 'Strawberry Matcha', desc: 'Çilek bazlı katmanlı matcha içeceği', type: 'Soğuk' },
];

/** Tatlılar */
export const TATLILAR: RecipeItem[] = [
  { id: 'san-sebastian', name: 'San Sebastian', desc: 'Yüksek ısıda karamelize üst yüzey', type: 'Pasta' },
  { id: 'cheesecake', name: 'New York Cheesecake', desc: 'Krem peynir bazlı fırınlanmış klasik', type: 'Pasta' },
  { id: 'tiramisu', name: 'Tiramisu', desc: 'Kahve aromalı klasik İtalyan tatlısı', type: 'Soğuk tatlı' },
  { id: 'brownie', name: 'Fudge Brownie', desc: 'Yoğun çikolatalı nemli kek', type: 'Fırın ürünü' },
  { id: 'magnolia', name: 'Magnolia', desc: 'Meyve ve bisküvi katmanlı kuplu tatlı', type: 'Soğuk tatlı' },
  { id: 'profiterole', name: 'Profiterol', desc: 'Çikolata soslu klasik porsiyon tatlı', type: 'Tatlı vitrini' },
  { id: 'cookie', name: 'New York Cookie', desc: 'Kalın dokulu, dolgulu kurabiye', type: 'Fırın ürünü' },
];

/** Kategori başlıkları ve listeleri */
export const RECIPE_CATEGORIES: { key: string; title: string; items: RecipeItem[] }[] = [
  { key: 'sicak_icecekler', title: 'Sıcak İçecekler', items: KAHVELER },
  { key: 'soguk_icecekler', title: 'Soğuk İçecekler', items: ICECEKLER },
  { key: 'tatlilar', title: 'Tatlılar', items: TATLILAR },
];

/** @deprecated Eski isim; Kahveler ile aynı */
export const COFFEE_TYPES = KAHVELER;

const RECIPE_DETAILS: Record<string, RecipeDetailData> = {
  'turkish-coffee': {
    name: 'Türk Kahvesi',
    desc: 'Türk kahvesinde köpük ve kıvam kontrolü servis kalitesinin ana belirleyicisidir.',
    stats: { time: '2-3 dk', water: '65-70 ml', temp: 'Düşük-orta ateş', ratio: '6-7 g kahve / fincan' },
    steps: [
      'Cezveye fincan ölçüsü suyu ve kahveyi ekle, şeker tercihine göre ayarla.',
      'Karıştırıp homojen hale getir ve kısık ateşe al.',
      'Köpük yükselirken taşırmadan fincanlara köpüğü paylaştır.',
      'Kalan kahveyi kısa bir yükseltme sonrası fincana tamamla ve bekletmeden servis et.',
    ],
  },
  espresso: {
    name: 'Espresso',
    desc: 'Kaliteli espresso; doğru öğütüm, doz, tamp ve stabil sıcaklık birleşimidir. Hedef dengeli asidite, tatlılık ve kalıcı gövdedir.',
    stats: { time: '25-30 sn', water: '36 g', temp: '92-94°C', ratio: '1:2' },
    steps: [
      'Portafiltreyi temizleyip kuru hale getir.',
      '18 g kahveyi öğüt ve sepete al, WDT ile topakları kır.',
      'Yüzeyi eşitle ve tamper ile düz baskı uygula.',
      'Portafiltreyi takar takmaz demlemeyi başlat.',
      '25-30 saniyede yaklaşık 36 g çıktı al ve shotu bekletmeden servis et.',
    ],
  },
  americano: {
    name: 'Americano',
    desc: 'Americano, espresso karakterini koruyup sıcak su ile içimi yumuşatan klasik bir kahvedir.',
    stats: { time: '2-3 dk', water: '30 g espresso + 120-150 ml su', temp: '90-94°C', ratio: '1:4-1:5' },
    steps: [
      'Tek veya çift espresso shot hazırla.',
      'Fincana önce sıcak suyu ekle (120-150 ml).',
      'Espressoyu su üzerine dökerek crema bütünlüğünü koru.',
      'Tadım yapıp su miktarını müşteri tercihine göre ayarla.',
    ],
  },
  cappuccino: {
    name: 'Cappuccino',
    desc: 'Cappuccino; espresso, süt ve mikro köpüğün dengeli birleşimidir. Doku pürüzsüz ve tat dengeli olmalıdır.',
    stats: { time: '3-4 dk', water: '30 g espresso + 120 ml süt', temp: '55-60°C', ratio: '1:4' },
    steps: [
      'Çift shot espressoyu fincana al.',
      'Soğuk sütü 55-60°C’ye kadar mikro köpükle tekstürle.',
      'Sütü merkezden döküp fincanı doldur, köpük-sıvı dengesi kur.',
      'Servis öncesi yüzeyde büyük baloncuk kalmadığını kontrol et.',
    ],
  },
  'flat-white': {
    name: 'Flat White',
    desc: 'Flat White, cappuccinoya göre daha ince köpük ve daha yoğun kahve etkisi sunar.',
    stats: { time: '3-4 dk', water: '36-40 g espresso + 130 ml süt', temp: '55-60°C', ratio: '1:3-1:3.5' },
    steps: [
      'Ristrettoya yakın yoğun bir çift shot çıkar.',
      'Sütü ince mikro köpük dokusunda tekstürle.',
      'Latte art döküşüyle merkezden dökerek fincanı tamamla.',
      'Tat dengesini kontrol et; süt kahveyi bastırmamalı.',
    ],
  },
  latte: {
    name: 'Cafe Latte',
    desc: 'Latte, yüksek süt oranı ile daha yumuşak içim sağlayan espresso bazlı bir içecektir.',
    stats: { time: '3-4 dk', water: '30-36 g espresso + 180-220 ml süt', temp: '55-60°C', ratio: '1:5-1:6' },
    steps: [
      'Espresso shotu geniş latte bardağına al.',
      'Sütü mikro köpük kıvamında ısıt.',
      'Sütü kontrollü döküşle ekle ve üstte ince köpük bırak.',
      'İstenirse şurup veya aromayı standart pompa adediyle ekle.',
    ],
  },
  v60: {
    name: 'V60 Pour Over',
    desc: 'V60; berraklık ve aromatik katmanlar için akış kontrolü gerektiren manuel demleme yöntemidir.',
    stats: { time: '2:30-3:15', water: '250 g', temp: '92-96°C', ratio: '1:16' },
    steps: [
      'Filtreyi durulayıp dripperı ısıt; suyu döküp boşalt.',
      '15-16 g orta-ince öğütüm kahveyi ekleyip yüzeyi düzle.',
      'Bloom için 45 g su dök, 30-40 sn bekle.',
      'Dairesel döküşle suyu 250 g’a tamamla.',
      'Toplam sürenin 2:30-3:15 bandında olmasını hedefle.',
    ],
  },
  'filter-coffee': {
    name: 'Filtre Kahve',
    desc: 'Günlük servis için dengeli gövde ve temiz bitiş veren batch veya manuel filtre kahve reçetesidir.',
    stats: { time: '4-5 dk', water: '250 ml', temp: '92-96°C', ratio: '1:16' },
    steps: [
      'Filtre kağıdını sıcak suyla durulayıp ekipmanı hazırla.',
      '15-16 g orta öğütüm kahveyi filtreye al.',
      'Bloom için az su döküp 30 saniye bekle.',
      'Kalan suyu kontrollü ekleyerek toplam demlemeyi tamamla.',
      'Kahveyi karaf içinde hafif çevirip homojen şekilde servis et.',
    ],
  },
  'cold-brew': {
    name: 'Cold Brew',
    desc: 'Cold Brew, düşük asidite ve yumuşak profil için soğuk suyla uzun süreli demleme tekniğidir.',
    stats: { time: '12-16 saat', water: '100 g kahve / 1 L su', temp: '4-8°C', ratio: '1:10' },
    steps: [
      'Kalın öğütülmüş kahveyi temiz demleme kabına al.',
      'Soğuk suyu ekleyip tüm kahvenin ıslandığından emin ol.',
      'Kapalı şekilde buzdolabında 12-16 saat demle.',
      'Önce kaba filtre, sonra ince filtre ile süz.',
      'Serviste buz ve su/süt ile konsantrasyonu ayarla.',
    ],
  },
  'iced-americano': {
    name: 'Iced Americano',
    desc: 'Sıcak shotu buz ve su ile doğru oranlayarak ferah, temiz bir soğuk kahve elde edilir.',
    stats: { time: '2-3 dk', water: '30-36 g espresso + 120 ml soğuk su', temp: 'Soğuk', ratio: '1:4 civarı' },
    steps: [
      'Bardağı bol buz ile doldur.',
      'Soğuk suyu ekle.',
      'Taze espresso shotunu su üzerine dök.',
      'Kısa karıştırıp hemen servis et.',
    ],
  },
  'iced-latte': {
    name: 'Iced Latte',
    desc: 'Soğuk latte’de süt ve espresso katman dengesinin korunması tat kalitesi için kritiktir.',
    stats: { time: '2-3 dk', water: '30-36 g espresso + 160 ml süt', temp: 'Soğuk', ratio: '1:5 civarı' },
    steps: [
      'Bardağa buz ve soğuk sütü ekle.',
      'Ayrı olarak espresso shotunu hazırla.',
      'Espressoyu yavaşça sütün üstüne dökerek katman oluştur.',
      'Servis öncesi müşteri tercihine göre hafif karıştır.',
    ],
  },
  'matcha-latte': {
    name: 'Matcha Latte',
    desc: 'Kaliteli matcha için topaksız karışım ve doğru süt ısısı kritik önemdedir.',
    stats: { time: '3 dk', water: '30 ml su + 180 ml süt', temp: '70-80°C su / 55-60°C süt', ratio: '2 g matcha : 210 ml sıvı' },
    steps: [
      '2 g matchayı elekten geçirerek kaseye al.',
      '70-80°C su ile bambu çırpıcıyla topaksız hale getir.',
      'Sütü 55-60°C’de ısıtıp hafif tekstür ver.',
      'Matcha bazını bardağa al ve sütü ekleyip servis et.',
    ],
  },
  'strawberry-matcha': {
    name: 'Strawberry Matcha',
    desc: 'Katmanlı görsel için çilek püresi, süt ve matcha yoğunluğu dengelenmelidir.',
    stats: { time: '4 dk', water: '30 ml su + 120 ml süt', temp: 'Soğuk', ratio: '2 g matcha : 1 porsiyon içecek' },
    steps: [
      'Bardağın dibine çilek püresi veya sosunu ekle.',
      'Buz ve soğuk sütü ekleyerek ikinci katmanı oluştur.',
      'Ayrı kapta hazırlanan matcha shotunu üstten yavaşça dök.',
      'Servis öncesi katman bütünlüğünü koruyarak sun.',
    ],
  },
  mocha: {
    name: 'Cafe Mocha',
    desc: 'Mocha, çikolata tatlılığı ile espresso gövdesinin dengeli birleşimidir.',
    stats: { time: '4 dk', water: '30 g espresso + 20 g çikolata + 170 ml süt', temp: '55-60°C', ratio: '1:6 civarı' },
    steps: [
      'Bardağa çikolata sosunu al.',
      'Üzerine sıcak espressoyu ekleyip karıştır.',
      'Tekstürlenmiş sütü ekle ve yüzeyi düzle.',
      'Opsiyonel: ince kakao veya çikolata rendesi ile servis et.',
    ],
  },
  'dirty-chai': {
    name: 'Dirty Chai',
    desc: 'Baharatlı chai tabanına espresso eklenerek daha kompleks bir sıcak içecek elde edilir.',
    stats: { time: '4-5 dk', water: '120 ml chai + 30 g espresso + 100 ml süt', temp: '60-65°C', ratio: '1 espresso shot / porsiyon' },
    steps: [
      'Chai konsantresini süt ile ısıtıp karıştır.',
      'Ayrı olarak tek shot espresso hazırla.',
      'Chai bazını bardağa alıp espressoyu ekle.',
      'İsteğe göre üstte hafif süt köpüğü ile bitir.',
    ],
  },
  'caramel-frappe': {
    name: 'Caramel Frappe',
    desc: 'Blender içeceklerde buz-kahve-süt dengesi ve kıvam kontrolü standart olmalıdır.',
    stats: { time: '3 dk', water: '60 ml kahve + 120 ml süt + buz', temp: 'Soğuk', ratio: '1:2 (kahve:süt)' },
    steps: [
      'Blender kaba buz, süt, kahve ve karamel sosunu ekle.',
      '25-30 sn pürüzsüz kıvam elde edene kadar blend et.',
      'Bardağa alıp yoğunluğu kontrol et, gerekirse sütle aç.',
      'Üstüne krema ve karamel çizgisiyle servis et.',
    ],
  },
  'hibiscus-cooler': {
    name: 'Hibiscus Cooler',
    desc: 'Hibiscus bazlı alkolsüz içecek, yaz menülerinde ferah ve hafif alternatif sunar.',
    stats: { time: '5 dk', water: '40 ml hibiscus konsantre + 150 ml su/soda', temp: 'Soğuk', ratio: '1:4' },
    steps: [
      'Hibiscus konsantresini servis bardağına al.',
      'Buz ve soğuk su/sodayı ekleyerek karıştır.',
      'Tat dengesini limon ve basit şurup ile ayarla.',
      'Nane veya narenciye dilimi ile servis et.',
    ],
  },
  'frozen-lemonade': {
    name: 'Frozen Limonata',
    desc: 'Yaz döneminde yüksek talep gören frozen limonata, asit-tatlılık dengesine bağlı olarak standardize edilmelidir.',
    stats: { time: '2-3 dk', water: '40 ml limon suyu + 20 ml şurup + buz', temp: 'Soğuk', ratio: '2:1 (limon:şurup)' },
    steps: [
      'Blendera limon suyu, basit şurup, buz ve az su ekle.',
      'Pürüzsüz kıvama gelene kadar blend et.',
      'Tatlılık ve asiditeyi tadım ile dengele.',
      'Soğuk bardakta hemen servis et.',
    ],
  },
  salep: {
    name: 'Salep',
    desc: 'Salep servisinde kıvam, süt sıcaklığı ve tarçın dengesi ürünün algılanan kalitesini belirler.',
    stats: { time: '6-8 dk', water: '220 ml süt', temp: '70-75°C', ratio: '1 porsiyon salep tozu / 220 ml süt' },
    steps: [
      'Sütü tencerede ısıtmaya başla, kaynatmadan sıcaklığı yükselt.',
      'Salep karışımını yavaşça ekleyip çırpma teli ile topaksız hale getir.',
      'Kıvam alana kadar karıştırarak pişir.',
      'Fincana alıp tarçın ile servis et.',
    ],
  },
  tiramisu: {
    name: 'Tiramisu',
    desc: 'Krem dengesini bozmadan ıslatma kontrolü ile katmanlı dokusu korunmuş klasik bir soğuk tatlıdır.',
    stats: { time: '20 dk + dinlendirme', water: '120 ml espresso', temp: 'Soğuk servis', ratio: 'Krema:taban 1:1' },
    steps: [
      'Mascarpone bazlı kremayı pürüzsüz şekilde hazırla.',
      'Kedi dili bisküvileri espresso ile hafifçe ıslat.',
      'Krema ve bisküviyi katmanlayarak tepsiye yerleştir.',
      'En az 6 saat soğukta dinlendir, servis öncesi kakao serp.',
    ],
  },
  cheesecake: {
    name: 'New York Cheesecake',
    desc: 'Düşük-orta ısı ve kontrollü soğutma ile çatlamayan, yoğun dokulu bir cheesecake hedeflenir.',
    stats: { time: '70-80 dk + soğuma', water: 'Taban için 80 g tereyağı', temp: '160°C', ratio: 'Krem peynir bazlı' },
    steps: [
      'Bisküvi tabanı hazırlayıp kalıba bastır.',
      'Krem peynir karışımını düşük devirde homojen hale getir.',
      'Karışımı kalıba döküp 160°C’de kontrollü pişir.',
      'Fırını kapatıp kapağı aralık şekilde dinlendir.',
      'Tam soğuduktan sonra buzdolabında minimum 6 saat beklet.',
    ],
  },
  'san-sebastian': {
    name: 'San Sebastian',
    desc: 'Yüksek ısıda karamelize üst yüzey ve kremsi iç doku, bu tarifin temel karakteridir.',
    stats: { time: '40-50 dk', water: 'Yok', temp: '220-240°C', ratio: 'Yüksek krem peynir oranı' },
    steps: [
      'Krem peynir, şeker, yumurta ve kremayı pürüzsüz karıştır.',
      'Yağlı kağıt serili kalıba karışımı dök.',
      'Önceden ısıtılmış yüksek derecede üst yüzey karamelize olana kadar pişir.',
      'Orta kısmı hafif sallanır kıvamda fırından al ve soğut.',
    ],
  },
  brownie: {
    name: 'Fudge Brownie',
    desc: 'Brownie’de hedef dışı hafif kabuklu, içi nemli ve yoğun çikolata yapısıdır.',
    stats: { time: '25-30 dk', water: 'Yok', temp: '170-175°C', ratio: 'Yüksek çikolata/tereyağı' },
    steps: [
      'Tereyağı ve çikolatayı benmari usulü erit.',
      'Şeker ve yumurtayı sadece birleşene kadar çırp.',
      'Un ve kakao karışımını katla, aşırı karıştırma.',
      'Kalıba döküp orta rafta kontrollü pişir.',
      'Tam dilimlemeden önce oda sıcaklığında dinlendir.',
    ],
  },
  cookie: {
    name: 'New York Cookie',
    desc: 'Kalın doku ve akışkan iç dolgu için hamur sıcaklığı ve pişirme süresi hassas yönetilmelidir.',
    stats: { time: '14-16 dk + soğutma', water: 'Yok', temp: '180°C', ratio: 'Yüksek tereyağı/şeker' },
    steps: [
      'Hamuru hazırlayıp eşit gramajlı toplar yap.',
      'İstenirse orta kısma çikolata/krema dolgusu ekle.',
      'Tepside yeterli boşluk bırakarak diz.',
      '180°C’de kenarlar tutacak, merkez yumuşak kalacak şekilde pişir.',
      'Tepside 10 dakika dinlendirip servis et.',
    ],
  },
  affogato: {
    name: 'Affogato',
    desc: 'Sıcak espresso ve soğuk dondurma kontrastı ile servis edilen hızlı ve şık tatlı sunumudur.',
    stats: { time: '2 dk', water: '30 g espresso', temp: 'Sıcak + soğuk kontrast', ratio: '1 top dondurma / 1 shot' },
    steps: [
      'Servis kasesine bir top kaliteli vanilyalı dondurma koy.',
      'Taze espresso shot al.',
      'Espressoyu servis anında dondurma üzerine dök.',
      'Hızlı servis ederek doku kontrastını koru.',
    ],
  },
  magnolia: {
    name: 'Magnolia',
    desc: 'Magnolia’da kremanın pürüzsüz yapısı ve katman dengesi vitrinde ürün kalitesini doğrudan etkiler.',
    stats: { time: '20 dk + dinlendirme', water: 'Yok', temp: 'Soğuk servis', ratio: 'Krema:bisküvi:meyve dengeli' },
    steps: [
      'Muhallebi bazını pürüzsüz kıvamda hazırlayıp soğut.',
      'Kuplara bisküvi kırığı, krema ve meyveyi katmanla.',
      'Üst katmanı düzgünleyip soğukta dinlendir.',
      'Servis öncesi taze meyve ile tamamla.',
    ],
  },
  profiterole: {
    name: 'Profiterol',
    desc: 'Profiterolde hamur yumuşaklığı ve çikolata sos kıvamı dengeli olmalıdır.',
    stats: { time: '15 dk (hazır taban) / 45 dk (tam üretim)', water: 'Yok', temp: 'Soğuk servis', ratio: 'Hamur:pasta kreması:sos dengeli' },
    steps: [
      'Profiterol toplarını servis kabına yerleştir.',
      'İç dolgu kremasını dengeli şekilde uygula.',
      'Çikolata sosu akışkan kıvamda üstten gezdir.',
      'Soğuk zinciri bozmadan servis et.',
    ],
  },
};

const DEFAULT_RECIPE: RecipeDetailData = RECIPE_DETAILS.espresso;

function findRecipeById(id: string): RecipeItem | undefined {
  return [...KAHVELER, ...ICECEKLER, ...TATLILAR].find((r) => r.id === id);
}

export function getRecipeDetail(id: string): RecipeDetailData {
  const detailed = RECIPE_DETAILS[id];
  if (detailed) return detailed;

  const item = findRecipeById(id);
  const name = item ? item.name : id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  return { ...DEFAULT_RECIPE, name };
}
