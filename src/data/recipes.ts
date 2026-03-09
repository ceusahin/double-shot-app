/**
 * Global tarifler: Tatlılar, Kahveler, Kokteyller
 */

export interface RecipeItem {
  id: string;
  name: string;
  desc: string;
  type: string;
}

/** Tatlılar */
export const TATLILAR: RecipeItem[] = [
  { id: 'tiramisu', name: 'Tiramisu', desc: 'Mascarpone ve kahveli bisküvi', type: 'Klasik' },
  { id: 'affogato', name: 'Affogato', desc: 'Dondurma üzerine espresso', type: 'Kahveli' },
  { id: 'cheesecake', name: 'Cheesecake', desc: 'Krem peynirli New York usulü', type: 'Pasta' },
  { id: 'brownie', name: 'Brownie', desc: 'Çikolatalı kahveli brownie', type: 'Kek' },
];

/** Kahveler */
export const KAHVELER: RecipeItem[] = [
  { id: 'espresso', name: 'Espresso', desc: 'Konsantre, yoğun ve kremalı', type: 'Sıcak' },
  { id: 'americano', name: 'Americano', desc: 'Espresso + Sıcak Su', type: 'Sıcak' },
  { id: 'cappuccino', name: 'Cappuccino', desc: 'Bol süt köpüklü espresso', type: 'Sütlü / Sıcak' },
  { id: 'flat-white', name: 'Flat White', desc: 'Pürüzsüz süt dokusu', type: 'Sütlü / Sıcak' },
  { id: 'v60', name: 'V60 Pour Over', desc: 'Berrak filtre kahve', type: 'Demleme / Sıcak' },
  { id: 'cold-brew', name: 'Cold Brew', desc: 'Soğuk suyla uzun demleme', type: 'Soğuk' },
];

/** Kokteyller (kahveli / bar) */
export const KOKTEYLLER: RecipeItem[] = [
  { id: 'espresso-martini', name: 'Espresso Martini', desc: 'Vodka, kahve likörü, espresso', type: 'Alkollü' },
  { id: 'irish-coffee', name: 'Irish Coffee', desc: 'Irish whiskey, sıcak kahve, krema', type: 'Sıcak' },
  { id: 'carajillo', name: 'Carajillo', desc: 'Espresso + Licor 43', type: 'Alkollü' },
  { id: 'viennese-coffee', name: 'Viennese Coffee', desc: 'Espresso, çikolata, krema', type: 'Sıcak' },
];

/** Kategori başlıkları ve listeleri */
export const RECIPE_CATEGORIES: { key: string; title: string; items: RecipeItem[] }[] = [
  { key: 'tatlilar', title: 'Tatlılar', items: TATLILAR },
  { key: 'kahveler', title: 'Kahveler', items: KAHVELER },
  { key: 'kokteyller', title: 'Kokteyller', items: KOKTEYLLER },
];

/** @deprecated Eski isim; Kahveler ile aynı */
export const COFFEE_TYPES = KAHVELER;

export interface RecipeDetailData {
  name: string;
  desc: string;
  stats: { time: string; water: string; temp: string; ratio: string };
  steps: string[];
}

const DEFAULT_RECIPE: RecipeDetailData = {
  name: 'Espresso',
  desc: 'Espresso (İtalyan İfadesi: espresso, preslenmiş demektir), ince öğütülmüş kahve çekirdeklerinden makine yardımı ile yüksek basınçlı sıcak su geçirilerek elde edilen yoğun kahve.',
  stats: { time: '25-30 sn', water: '36 g', temp: '93°C', ratio: '1:2' },
  steps: [
    'Portafiltreyi temizle ve kurula.',
    '18g kahveyi öğüt ve portafiltreye al.',
    'Distributor (WDT) ile kahveyi eşit dağıt.',
    'Tamper ile portafiltrenin yüzeyine düzgün ve eşit baskı uygula.',
    'Portafiltreyi gruba tak ve hemen demlemeyi başlat.',
    '25-30 saniye boyunca 36 gram çıktı(yield) alarak işlemi sonlandır.',
  ],
};

function findRecipeById(id: string): RecipeItem | undefined {
  return [...KAHVELER, ...TATLILAR, ...KOKTEYLLER].find((r) => r.id === id);
}

export function getRecipeDetail(id: string): RecipeDetailData {
  const item = findRecipeById(id);
  const name = item ? item.name : id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  return { ...DEFAULT_RECIPE, name };
}
