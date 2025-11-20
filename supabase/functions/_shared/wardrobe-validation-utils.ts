export interface WardrobeValidation {
  has_minimum_items: boolean;
  has_ethnic_set: boolean;
  has_tops: boolean;
  has_bottoms: boolean;
  has_shoes: boolean;
  has_dresses: boolean;
  total_items: number;
  categories: string[];
  wardrobe_health_score: number; // 0-100
}

export function validateWardrobe(items: any[]): WardrobeValidation {
  const norm = (s: any) => (s || '').toString().toLowerCase();
  
  const tops = items.filter((i: any) => 
    ['shirt','top','tee','t-shirt','blouse','polo','kurta','kurti','tank'].some(k => norm(i.category).includes(k))
  );
  
  const bottoms = items.filter((i: any) => 
    ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom','legging','pajama','churidar'].some(k => norm(i.category).includes(k))
  );
  
  const shoes = items.filter((i: any) => 
    ['shoe','sneaker','boot','loafer','heel','sandal','jutti','mojari'].some(k => norm(i.category).includes(k))
  );
  
  const ethnic = items.filter((i: any) => 
    ['kurta set','saree','lehenga','sherwani','salwar'].some(k => norm(i.category).includes(k) || norm(i.name).includes(k))
  );
  
  const dresses = items.filter((i: any) => 
    ['dress','gown','jumpsuit'].some(k => norm(i.category).includes(k))
  );
  
  const categories = [...new Set(items.map((i: any) => i.category))];
  
  // Calculate health score (0-100)
  let score = 0;
  if (tops.length > 0) score += 20;
  if (bottoms.length > 0) score += 20;
  if (shoes.length > 0) score += 20;
  if (tops.length >= 3) score += 10;
  if (bottoms.length >= 2) score += 10;
  if (shoes.length >= 2) score += 10;
  if (categories.length >= 5) score += 10;
  
  return {
    has_minimum_items: items.length >= 3,
    has_ethnic_set: ethnic.length > 0,
    has_tops: tops.length > 0,
    has_bottoms: bottoms.length > 0,
    has_shoes: shoes.length > 0,
    has_dresses: dresses.length > 0,
    total_items: items.length,
    categories,
    wardrobe_health_score: Math.min(score, 100),
  };
}

export function hasCategoryItems(items: any[], category: string): boolean {
  const norm = (s: any) => (s || '').toString().toLowerCase();
  return items.some((i: any) => norm(i.category).includes(category.toLowerCase()));
}
