// ================================================================
// aMenuVerse Central TypeScript Types & Interfaces (like ERPApp)
// ================================================================

// ----------------------------------------------------------------
// 1. Core & Auth Types
// ----------------------------------------------------------------
export type UserRole =
  | "Super Admin"
  | "Owner"
  | "Manager"
  | "Cashier"
  | "Chef"
  | "Waiter"
  | "Host"
  | "Customer"
  | "super_admin"
  | "superadmin"
  | "owner"
  | "manager"
  | "cashier"
  | "chef"
  | "waiter"
  | "host"
  | "customer";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  name?: string | null;
  role?: string | null;
  roles?: string[];
  branch?: string | null;
  assigned_branch_id?: string | null;
  restaurant_id?: number | null;
  avatar_url?: string | null;
}

// ----------------------------------------------------------------
// 2. Restaurant & Profile Types
// ----------------------------------------------------------------
export interface ProfileAppearance {
  themeColor?: string;
  menuLayout?: string;
  fontFamily?: string;
}

export interface DbRestaurantRecord {
  id: string | number;
  name: string;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  cuisine?: string | null;
  phone?: string | null;
  status?: string | null;
  plan?: string | null;
  mrr?: number | null;
  plan_expires_at?: string | null;
}

export interface RestaurantProfile {
  name?: string;
  slug?: string;
  description?: string;
  about?: string;
  intro?: string;
  cuisine?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  logo?: string;
  coverUrl?: string;
  operatingHours?: string;
  facilities?: string[] | string;
  prepTime?: string;
  rating?: string | number;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  metaTitle?: string;
  ogImageUrl?: string;
  faviconUrl?: string;
  isIndexed?: boolean;
  appearance?: ProfileAppearance;
}

// ----------------------------------------------------------------
// 3. Branches & Tables
// ----------------------------------------------------------------
export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  manager?: string;
  isDefault?: boolean;
  tableCount?: number;
  openingHours?: string;
  status?: "active" | "inactive";
  createdAt?: string;
}

export interface BranchTable {
  id: string;
  tableNumber: string;
  table_no?: string;
  branchId: string;
  branch_id?: string;
  capacity?: number;
  qrToken?: string;
  qr_token?: string;
  status?: "available" | "occupied" | "reserved";
  active?: boolean;
  createdAt?: string;
}

// ----------------------------------------------------------------
// 4. Menu: Categories & Food Items
// ----------------------------------------------------------------
export interface CategoryRecord {
  id: string;
  name: string;
  description: string;
  icon: string;
  emoji?: string;
  image: string;
  visible: boolean;
  itemCount: number;
}

export type Category = CategoryRecord;

export interface FoodItemRecord {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  categoryId?: string;
  image: string;
  gallery: string[];
  view360: string;
  price: number;
  discountPrice: number | null;
  prepTime: number;
  calories: number;
  ingredients: string[];
  allergens: string[];
  spicyLevel: number;
  bestSeller: boolean;
  popular: boolean;
  chefChoice: boolean;
  vegetarian: boolean;
  halal: boolean;
  outOfStock: boolean;
  available: boolean;
  sortOrder: number;
}

export type FoodItem = FoodItemRecord;

// ----------------------------------------------------------------
// 5. Orders & POS Types
// ----------------------------------------------------------------
export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderType = "dine-in" | "takeaway" | "delivery";

export interface OrderLine {
  itemId: string;
  name: string;
  price: number;
  qty: number;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export type OrderLineRecord = OrderLine;

export interface Order {
  id: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  branchId?: string;
  type: OrderType;
  status: OrderStatus;
  tableNumber?: string;
  customerName: string;
  phone: string;
  notes?: string;
  lines: OrderLine[];
  subtotal: number;
  discountType?: "amount" | "percent";
  discountValue?: number;
  discountAmount?: number;
  tax: number;
  total: number;
  prepTimeMinutes?: number;
  prepStartedAt?: string;
  estimatedPrepMinutes?: number;
}

export type FullOrderRecord = Order;

export interface OrdersFilter {
  branchId?: string;
  status?: OrderStatus | "all";
  type?: OrderType | "all";
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ----------------------------------------------------------------
// 6. Staff / Team Directory
// ----------------------------------------------------------------
export type StaffRole = "Owner" | "Manager" | "Cashier" | "Chef" | "Waiter" | "Host";
export type StaffStatus = "active" | "on-leave" | "suspended" | "inactive";

export interface StaffRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: StaffRole;
  branch: string;
  status: StaffStatus;
  shift: string;
  joinDate: string;
  avatarUrl?: string;
}

export type StaffMember = StaffRecord;

export interface StaffFilter {
  branch?: string;
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ----------------------------------------------------------------
// 7. Reservations
// ----------------------------------------------------------------
export type ReservationStatus = "pending" | "confirmed" | "seated" | "cancelled" | "completed";

export interface ReservationRecord {
  id: string;
  guestName: string;
  phone: string;
  email?: string;
  partySize: number;
  date: string;
  time: string;
  seatingArea: string;
  tableNumber?: string;
  status: ReservationStatus;
  specialNotes?: string;
  occasion?: string;
  branchId?: string;
  branchName?: string;
  createdAt?: string;
}

export type Reservation = ReservationRecord;

export interface ReservationFilter {
  branchId?: string;
  status?: ReservationStatus | "all";
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ----------------------------------------------------------------
// 8. Promotions
// ----------------------------------------------------------------
export type PromotionKind = "seasonal" | "happy_hour" | "combo" | "bogo" | "flash_deal";
export type PromotionScope = "all" | "categories" | "items";

export interface PromotionRecord {
  id: string;
  kind: PromotionKind;
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  targetScope: PromotionScope;
  categoryNames?: string[];
  itemIds?: string[];
  active: boolean;
  image?: string;
  description?: string;
  showPopup?: boolean;
  branchName?: string;
  branchId?: string;
  createdByRole?: string;
  createdByUserId?: string;
  createdAt?: string;
}

export type Promotion = PromotionRecord;

export interface PromotionFilter {
  branchId?: string;
  activeOnly?: boolean;
  kind?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ----------------------------------------------------------------
// 9. Waiter Calls & Requests
// ----------------------------------------------------------------
export type WaiterRequestType = "call" | "bill" | "water" | "cutlery" | "clean" | "custom";
export type WaiterRequestStatus = "pending" | "acknowledged" | "done";

export interface WaiterRequest {
  id: string;
  restaurantId: number;
  branchId?: string | null;
  tableNo: string;
  type: WaiterRequestType;
  note?: string | null;
  status: WaiterRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WaiterFilter {
  branchId?: string;
  tableNo?: string;
  type?: string;
}

// ----------------------------------------------------------------
// 10. Customer Feedback
// ----------------------------------------------------------------
export interface FeedbackRecord {
  id: string;
  restaurantId?: number;
  branchId?: string;
  customerName: string;
  phone?: string;
  rating: number;
  foodQualityRating?: number;
  serviceRating?: number;
  ambianceRating?: number;
  comment?: string;
  tableNo?: string;
  orderNumber?: number;
  source?: "qr_menu" | "in_store" | "google";
  sentiment?: "positive" | "neutral" | "negative";
  createdAt: string;
}

// ----------------------------------------------------------------
// 11. Subscription Packages & Tenant Quotas
// ----------------------------------------------------------------
export interface SubscriptionPackageRecord {
  id: string;
  name: string;
  price: string;
  billing: string;
  badge: string;
  badgeColor?: string;
  features: string[];
  maxBranches?: string;
  maxCategories?: string;
  maxItems?: string;
  maxOrders?: string;
  maxQrs?: string;
}

export interface TenantSubscription {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  isExpiredDowngraded: boolean;
  expiresAt: string | null;
  joined: string;
  limits: {
    maxBranches: number | "unlimited";
    maxCategories: number | "unlimited";
    maxItems: number | "unlimited";
    maxOrders: number | "unlimited";
    maxQrs: number | "unlimited";
  };
  usage: {
    branches: number;
    categories: number;
    items: number;
    orders: number;
    qrs: number;
  };
}

// ----------------------------------------------------------------
// 12. Analytics
// ----------------------------------------------------------------
export interface AnalyticsFilter {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsSummary {
  totalScans: number;
  totalViews: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  dailyTrend: Array<{
    date: string;
    scans: number;
    views: number;
    orders: number;
    revenue: number;
  }>;
}
