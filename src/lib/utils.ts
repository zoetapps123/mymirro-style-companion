import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function orderOutfitForDisplay(items: any[]) {
  const lower = (s?: string) => (s || '').toLowerCase();
  const isTop = (c: string) => ['shirt','top','blouse','tshirt','t-shirt','upperwear','tops'].some(k => c.includes(k));
  const isBottom = (c: string) => ['pants','jeans','trousers','skirt','shorts','lowerwear','bottom','bottoms'].some(k => c.includes(k));
  const isShoe = (c: string) => ['shoe','shoes','sneaker','sneakers','boot','boots','loafer','heel','heels','sandal','sandals','footwear'].some(k => c.includes(k));
  const isAccessory = (c: string) => [
    'accessor','accessory','accessories',
    'watch','belt','bag','handbag','purse','wallet',
    'sunglass','sunglasses','glass','glasses',
    'hat','cap','scarf',
    'jewelry','jewellery',
    'ring','bracelet','necklace',
    'earring','earrings','bangle','anklet'
  ].some(k => c.includes(k));
  const isLayer = (c: string) => ['jacket','blazer','cardigan','coat','sweater','hoodie','outerwear','layer','layers'].some(k => c.includes(k));

  const top = items.find(i => isTop(lower(i.category)));
  const bottom = items.find(i => isBottom(lower(i.category)));
  const shoe = items.find(i => isShoe(lower(i.category)));
  const accessory = items.find(i => isAccessory(lower(i.category)));
  const layer = items.find(i => isLayer(lower(i.category)));

  // Priority: top, bottom, shoe, accessory (then layer if no accessory)
  const ordered: any[] = [];
  if (top) ordered.push(top);
  if (bottom) ordered.push(bottom);
  if (shoe) ordered.push(shoe);
  if (accessory) ordered.push(accessory);
  else if (layer) ordered.push(layer); // Only show layer if NO accessory

  // Fill remaining slots with any other items
  const usedIds = new Set(ordered.map(i => i.id));
  for (const item of items) {
    if (ordered.length >= 4) break;
    if (!usedIds.has(item.id)) {
      ordered.push(item);
      usedIds.add(item.id);
    }
  }
  
  return ordered.slice(0, 4);
}
