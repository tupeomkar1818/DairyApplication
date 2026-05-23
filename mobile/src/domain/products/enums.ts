export type ProductType = 'Milk' | 'Milk Product' | 'Sweet Product' | 'Grocery Product';

export type ProductUnit = 'Gram' | 'Kg' | 'ml' | 'Litre' | 'Packet' | 'Piece' | 'Box' | 'Bottle' | 'Pouch';

export type ProductVariant = '250 ml' | '500 ml' | '1 Litre' | '2 Litre' | 'Custom Size';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type ProductAvailability = 'Available' | 'Out of Stock' | 'Seasonal Product' | 'Discontinued';

export type DeliveryTimeSlot = 'Morning' | 'Afternoon' | 'Evening';

export type ProductFeature =
  | 'Fresh Product'
  | 'Organic'
  | 'Best Seller'
  | 'Subscription Available'
  | 'Home Delivery Available'
  | 'Returnable Bottle'
  | 'Refrigeration Required';

export type TaxApplicable = 'Yes' | 'No';
export type TaxPercentage = '0%' | '5%' | '12%' | '18%';

