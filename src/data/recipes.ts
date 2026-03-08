/**
 * Global kahve tarifleri (referans projeden)
 */

export interface RecipeItem {
  id: string;
  name: string;
  desc: string;
  type: string;
}

export const COFFEE_TYPES: RecipeItem[] = [
  { id: 'espresso', name: 'Espresso', desc: 'Konsantre, yoğun ve kremalı', type: 'Sıcak' },
  { id: 'americano', name: 'Americano', desc: 'Espresso + Sıcak Su', type: 'Sıcak' },
  { id: 'cappuccino', name: 'Cappuccino', desc: 'Bol süt köpüklü espresso', type: 'Sütlü / Sıcak' },
  { id: 'flat-white', name: 'Flat White', desc: 'Pürüzsüz süt dokusu', type: 'Sütlü / Sıcak' },
  { id: 'v60', name: 'V60 Pour Over', desc: 'Berrak filtre kahve', type: 'Demleme / Sıcak' },
  { id: 'cold-brew', name: 'Cold Brew', desc: 'Soğuk suyla uzun demleme', type: 'Soğuk' },
];

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

export function getRecipeDetail(id: string): RecipeDetailData {
  const item = COFFEE_TYPES.find((c) => c.id === id);
  const name = item ? item.name : id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  return { ...DEFAULT_RECIPE, name };
}
