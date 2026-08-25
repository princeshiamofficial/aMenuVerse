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
    categories: [
      { name: "Burgers", emoji: "🍔" },
      { name: "Pizza", emoji: "🍕" },
      { name: "Beverages", emoji: "🥤" },
    ],
    menuItems: [
      {
        id: "mv-1",
        name: "MenuVerse Special Burger",
        description:
          "Double smash patty with caramelized onions, cheddar cheese, and signature house sauce.",
        price: 9.5,
        image:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
        category: "Burgers",
        popular: true,
      },
      {
        id: "mv-2",
        name: "Artisan Truffle Pizza",
        description:
          "Stone-baked Neapolitan pizza topped with wild mushrooms, truffle oil, and fresh mozzarella.",
        price: 14.0,
        image:
          "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80",
        category: "Pizza",
        popular: true,
      },
      {
        id: "mv-3",
        name: "Fresh Iced Lemonade",
        description: "Freshly squeezed lemon juice with garden mint and sparkling soda.",
        price: 3.5,
        image:
          "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
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
    menuItems: [
      {
        id: "mfg-1",
        name: "Sichuan Wontons in Chilli Oil",
        description:
          "Handcrafted wontons served in spicy, numbing chilli oil with sweet tang and toasted sesame.",
        price: 8.5,
        image:
          "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600&auto=format&fit=crop&q=80",
        category: "Starters",
      },
      {
        id: "mfg-2",
        name: "Silken Mapo Tofu",
        description:
          "Traditional Sichuan mapo tofu with minced beef, broad bean paste, and Sichuan peppercorns.",
        price: 9.0,
        image:
          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
      },
      {
        id: "mfg-3",
        name: "Kung Pao Chicken",
        description:
          "Wok-tossed chicken chunks with peanuts, dried red chillies, and savory sweet soy reduction.",
        price: 11.0,
        image:
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
      },
    ],
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
    menuItems: [
      {
        id: 21,
        name: "Truffle Mushroom Pizza",
        description:
          "Stone-baked Neapolitan pizza topped with wild cremini mushrooms, white truffle oil essence, fresh mozzarella, and wild arugula.",
        price: 18.0,
        image:
          "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80",
        category: "Pizza",
        popular: true,
      },
      {
        id: 22,
        name: "Spaghetti Carbonara",
        description:
          "Traditional egg yolk emulsion sauce, crispy cured pancetta, aged Pecorino Romano cheese, and fresh cracked black peppercorns.",
        price: 15.5,
        image:
          "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80",
        category: "Pasta",
        popular: true,
      },
      {
        id: 23,
        name: "Classic Margherita Pizza",
        description:
          "Rich San Marzano tomato base, fresh buffalo mozzarella, aromatic sweet basil leaves, and extra virgin olive oil drizzle.",
        price: 14.0,
        image:
          "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&auto=format&fit=crop&q=80",
        category: "Pizza",
      },
      {
        id: 24,
        name: "Espresso Tiramisu",
        description:
          "Layers of espresso-soaked Italian ladyfingers, velvety whipped mascarpone cream cheese, and dark cocoa powder dusting.",
        price: 7.5,
        image:
          "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80",
        category: "Desserts",
      },
      {
        id: 25,
        name: "Chianti Classico",
        description:
          "A glass of premium Tuscan red wine featuring rich cherry and wild berry notes with smooth tannins.",
        price: 9.0,
        image:
          "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
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
    menuItems: [
      {
        id: 31,
        name: "Dragon Sushi Roll Platter",
        description:
          "Inside-out sushi rolls filled with freshwater eel and cucumber, topped with avocado sheets, tobiko, and sweet soy glaze.",
        price: 22.5,
        image:
          "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&auto=format&fit=crop&q=80",
        category: "Sushi",
        popular: true,
      },
      {
        id: 32,
        name: "Tonkotsu Chashu Ramen",
        description:
          "16-hour slow-cooked creamy pork bone broth, custom noodles, tender braised chashu pork, soft nitamago egg, and nori.",
        price: 16.0,
        image:
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
        category: "Ramen",
        popular: true,
      },
      {
        id: 33,
        name: "Spicy Bluefin Tuna Roll",
        description:
          "Hand-rolled sushi featuring spicy minced bluefin tuna, toasted sesame seeds, crunchy tempura flakes, and spicy kewpie.",
        price: 12.0,
        image:
          "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80",
        category: "Sushi",
      },
      {
        id: 34,
        name: "Uji Matcha Ice Cream",
        description:
          "Artisanal churned green tea ice cream made with premium stone-ground matcha powder from Uji, Kyoto.",
        price: 5.5,
        image:
          "https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?w=600&auto=format&fit=crop&q=80",
        category: "Desserts",
      },
      {
        id: 35,
        name: "Warm Junmai Sake",
        description:
          "Traditional pure-rice sake served warm, presenting a rich, full-bodied flavour profile with clean notes.",
        price: 10.0,
        image:
          "https://images.unsplash.com/photo-1613063372218-568d6020bc41?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
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
    menuItems: [
      {
        id: 41,
        name: "Spicy Sichuan Chilli Wontons",
        description:
          "Delicate steamed pork wontons served floating in a spicy, aromatic house chilli oil and aged black vinegar sauce.",
        price: 11.0,
        image:
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
        category: "Appetizers",
        popular: true,
      },
      {
        id: 42,
        name: "Sichuan Kung Pao Chicken",
        description:
          "Stir-fried tender diced chicken breast, roasted peanuts, wok-charred dry red chillies, and aromatic Sichuan peppercorns.",
        price: 14.5,
        image:
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
        popular: true,
      },
      {
        id: 43,
        name: "Authentic Mapo Tofu",
        description:
          "Silken tofu blocks cooked with seasoned minced beef in a fiery, numbing Sichuan bean paste sauce.",
        price: 13.0,
        image:
          "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
      },
      {
        id: 44,
        name: "Steamed Jasmine Rice",
        description:
          "Fragrant, fluffy long-grain steamed Jasmine rice served in a traditional porcelain bowl.",
        price: 2.5,
        image:
          "https://images.unsplash.com/photo-1516685018646-549198525c1b?w=600&auto=format&fit=crop&q=80",
        category: "Sides",
      },
      {
        id: 45,
        name: "Brewed Jasmine Green Tea",
        description:
          "Freshly brewed hot loose-leaf Jasmine green tea served hot, showcasing delicate floral notes.",
        price: 3.0,
        image:
          "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
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
    menuItems: [
      {
        id: 51,
        name: "Sichuan Chili Chicken",
        description:
          "Crispy chicken cubes stir-fried with hot Sichuan peppercorns, dried red chilis, and fresh garlic.",
        price: 13.5,
        image:
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
        popular: true,
      },
      {
        id: 52,
        name: "Beef with Oyster Sauce",
        description:
          "Tender beef slices stir-fried with fresh broccoli, mushrooms, and scallions in rich oyster sauce.",
        price: 15.0,
        image:
          "https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
        popular: true,
      },
      {
        id: 53,
        name: "Yangzhou Fried Rice",
        description:
          "Classic wok-fried Jasmine rice with shrimps, barbecue pork, green peas, and egg.",
        price: 10.0,
        image:
          "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80",
        category: "Rice & Noodles",
      },
      {
        id: 54,
        name: "Steamed Chicken Dumplings",
        description:
          "Handmade dumplings filled with seasoned minced chicken, served with soy dipping sauce.",
        price: 8.0,
        image:
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
        category: "Appetizers",
      },
      {
        id: 55,
        name: "Iced Lychee Tea",
        description:
          "Sweet iced black tea infused with fragrant lychee fruit syrup and whole lychees.",
        price: 3.5,
        image:
          "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
  },
];
