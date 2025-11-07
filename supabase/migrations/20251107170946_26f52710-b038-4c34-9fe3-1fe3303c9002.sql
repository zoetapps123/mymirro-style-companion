-- Create function to normalize wardrobe item categories
CREATE OR REPLACE FUNCTION public.normalize_wardrobe_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Normalize category to standard names
  NEW.category := CASE
    -- Footwear → Shoes
    WHEN LOWER(NEW.category) IN ('footwear', 'foot wear', 'foot-wear') THEN 'Shoes'
    
    -- Various top variations → Tops
    WHEN LOWER(NEW.category) IN ('upper wear', 'upperwear', 'upper-wear', 'top', 'shirt', 'tshirt', 't-shirt', 'blouse', 'tee') THEN 'Tops'
    
    -- Various bottom variations → Bottoms
    WHEN LOWER(NEW.category) IN ('lower wear', 'lowerwear', 'lower-wear', 'bottom', 'pants', 'trouser', 'trousers', 'jean', 'chinos', 'shorts') THEN 'Bottoms'
    
    -- Various outer wear variations → Outerwear
    WHEN LOWER(NEW.category) IN ('outer wear', 'outerwear', 'outer-wear', 'jacket', 'coat', 'blazer', 'cardigan', 'sweater', 'hoodie') THEN 'Outerwear'
    
    -- Accessories variations → Accessories
    WHEN LOWER(NEW.category) IN ('accessory', 'accessorie') THEN 'Accessories'
    
    -- Dresses variations → Dresses
    WHEN LOWER(NEW.category) IN ('dress', 'gown') THEN 'Dresses'
    
    -- Keep as-is if already standard or unknown
    ELSE NEW.category
  END;
  
  RETURN NEW;
END;
$$;

-- Create trigger to normalize categories before insert or update
CREATE TRIGGER normalize_category_before_insert_update
  BEFORE INSERT OR UPDATE ON public.wardrobe_items
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_wardrobe_category();