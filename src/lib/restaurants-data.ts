export interface MenuItem {
  id: number | string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number | null;
  image: string;
  category: string;
  popular?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  location?: string;
  address?: string;
  phone: string;
  operatingHours?: string;
  manager?: string;
  status?: string;
  isDefault?: boolean;
  menuId?: string;
  tables?: Array<{ name: string; location: string; status: string }>;
}

export interface Restaurant {
  id: number | string;
  name: string;
  cuisine: string;
  rating: string;
  reviews: string;
  price: string;
  time: string;
  location: string;
  logo: string;
  logoBg: string;
  image: string;
  logoImage: string;
  username: string;
  menuItems: MenuItem[];
  branches?: Branch[];
  categories?: { name: string; emoji?: string }[];
  phone?: string;
  operatingHours?: string;
  facilities?: string;
  introText?: string;
  descriptionText?: string;
  offerSlides?: string[];
  offer_slides?: string | string[];
  primaryColor?: string;
  isVerified?: boolean;
  primary_color?: string;
  layoutType?: string;
  layout_type?: string;
  favicon?: string;
  socialPreview?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  appearance?: {
    menuLayout?: string;
    fontFamily?: string;
    themeColor?: string;
  };
  isPushEnabled?: boolean;
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: "menuverse",
    name: "MenuVerse Kitchen",
    cuisine: "Multi-Cuisine & Gourmet Specialties",
    rating: "4.9",
    reviews: "340",
    price: "$$",
    time: "15-25 min",
    location: "Global / Main Location",
    logo: "M",
    logoBg: "from-amber-500 to-orange-600",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
    username: "menuverse",
    isVerified: true,
    phone: "+880 1700-112233",
    operatingHours: "Open Daily: 11:00 AM - 11:30 PM",
    facilities: "Air Conditioned, Wifi, Table QR ordering, bKash & Card payments",
    introText:
      "Welcome to MenuVerse Kitchen. Scan QR codes at your table to place kitchen orders instantly.",
    descriptionText:
      "MenuVerse Kitchen serves artisan multi-cuisine dishes, gourmet burgers, pizza, pasta, and beverages.",
    branches: [
      {
        id: "main-location",
        name: "Main Location",
        address: "Main Location, Global",
        location: "Main Location",
        phone: "+880 1700-112233",
        operatingHours: "11:00 AM - 11:30 PM",
        tables: [
          { name: "Table 01", location: "Main Hall", status: "Active" },
          { name: "Table 02", location: "Main Hall", status: "Active" },
          { name: "Table 03", location: "Window Side", status: "Active" },
        ],
      },
    ],
    categories: [],
    menuItems: [],
  },
  {
    id: "mehnur-food-gallery",
    name: "Mehnur Food Gallery",
    cuisine: "Gourmet Asian & Multi-Cuisine",
    rating: "4.2",
    reviews: "23",
    price: "$$",
    time: "15-20 min",
    location: "ZamZam Tower, Uttara, Dhaka",
    logo: "M",
    logoBg: "from-amber-600 to-yellow-500",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
    username: "mehnur-food-gallery",
    isVerified: true,
    phone: "+880 1700-112233",
    operatingHours: "Open Daily: 11:00 AM - 11:00 PM",
    facilities: "Air Conditioned, Wifi, Table QR ordering, bKash & Card payments",
    introText:
      "Welcome to Mehnur Food Gallery. Scan QR codes at your table to place kitchen orders instantly.",
    descriptionText:
      "Mehnur Food Gallery serves artisan dishes, delicious wontons, mapo tofu, kung pao chicken, and beverages.",
    categories: [],
    menuItems: [],
  },
  {
    id: 1,
    name: "Burger Craft Lab",
    cuisine: "Gourmet Burgers",
    rating: "4.9",
    reviews: "340",
    price: "$$",
    phone: "+8801919-760626",
    operatingHours: "Open Daily: 11:00 AM - 11:30 PM",
    facilities: "Air Conditioned, Wifi, Table QR ordering, bKash payments accepted",
    time: "15-25 min",
    location: "Dhanmondi, Dhaka",
    logo: "B",
    logoBg: "from-amber-500 to-orange-600",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
    username: "burgercraftlab",
    branches: [
      {
        id: "downtown",
        name: "Downtown Flagship",
        address: "221 Baker Street, New York, NY",
        location: "221 Baker Street, New York, NY",
        phone: "+1 (555) 010-2233",
        operatingHours: "11:00 AM - 11:00 PM",
        tables: [
          { name: "Table 01", location: "Window Side", status: "Active" },
          { name: "Table 02", location: "Window Side", status: "Active" },
        ],
      },
      {
        id: "dhanmondi",
        name: "Dhanmondi Branch",
        address: "Road 27, Dhanmondi, Dhaka",
        location: "Road 27, Dhanmondi, Dhaka",
        phone: "+880 1712-345678",
        operatingHours: "11:00 AM - 11:00 PM",
        tables: [
          { name: "Table 01", location: "Window Side", status: "Active" },
          { name: "Table 02", location: "Window Side", status: "Active" },
          { name: "Table 03", location: "Main Hall", status: "Active" },
          { name: "Table 04", location: "Main Hall", status: "Active" },
          { name: "Table 05", location: "Main Hall", status: "Active" },
          { name: "Table 06", location: "VIP Lounge", status: "Active" },
          { name: "Table 07", location: "VIP Lounge", status: "Active" },
          { name: "Table 08", location: "VIP Lounge", status: "Active" },
        ],
      },
      {
        id: "gulshan",
        name: "Gulshan Branch",
        address: "Road 11, Gulshan-2, Dhaka",
        location: "Road 11, Gulshan-2, Dhaka",
        phone: "+880 1712-876543",
        operatingHours: "12:00 PM - 12:00 AM",
        tables: [
          { name: "Table 01", location: "Window Side", status: "Active" },
          { name: "Table 02", location: "Terrace", status: "Active" },
          { name: "Table 03", location: "Main Room", status: "Active" },
          { name: "Table 04", location: "Main Room", status: "Active" },
        ],
      },
      {
        id: "uttara",
        name: "Uttara Branch",
        address: "Sector 11, Uttara, Dhaka",
        location: "Sector 11, Uttara, Dhaka",
        phone: "+880 1712-112233",
        operatingHours: "11:00 AM - 10:00 PM",
        tables: [
          { name: "Table 01", location: "Ground Floor", status: "Active" },
          { name: "Table 02", location: "Ground Floor", status: "Active" },
          { name: "Table 03", location: "First Floor", status: "Active" },
        ],
      },
    ],
    categories: [],
    menuItems: [],
  },
  {
    id: 2,
    name: "Sultan's Dine",
    cuisine: "Traditional Mughal & Kacchi Biryani",
    rating: "4.9",
    reviews: "1520",
    price: "$$$",
    time: "10-20 min",
    location: "Gulshan, Dhaka",
    logo: "S",
    logoBg: "from-red-500 to-rose-600",
    image:
      "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=80&auto=format&fit=crop&q=80",
    username: "sultansdine",
    categories: [],
    menuItems: [],
  },
  {
    id: 3,
    name: "Sakura Sushi Bar",
    cuisine: "Japanese Sushi & Ramen",
    rating: "5.0",
    reviews: "1.2k",
    price: "$$$",
    time: "20-30 min",
    location: "Banani, Dhaka",
    logo: "S",
    logoBg: "from-pink-500 to-purple-600",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=80&auto=format&fit=crop&q=80",
    username: "sakurasushibar",
    categories: [],
    menuItems: [],
  },
  {
    id: 4,
    name: "The Spicy Wok",
    cuisine: "Sichuan & Asian Fusion",
    rating: "4.7",
    reviews: "180",
    price: "$$",
    time: "15-25 min",
    location: "Uttara, Dhaka",
    logo: "T",
    logoBg: "from-red-600 to-orange-500",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=80&auto=format&fit=crop&q=80",
    username: "thespicywok",
    categories: [],
    menuItems: [],
  },
  {
    id: 5,
    name: "Red Chili Chinese Restaurant",
    cuisine: "Sichuan & Cantonese Chinese",
    rating: "4.8",
    reviews: "210",
    price: "$$",
    time: "20-30 min",
    location: "Dhanmondi, Dhaka",
    logo: "R",
    logoBg: "from-red-600 to-orange-700",
    image:
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=80&auto=format&fit=crop&q=80",
    username: "redchilichinese",
    categories: [],
    menuItems: [],
  },
];
