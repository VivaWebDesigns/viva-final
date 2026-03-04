import galleryKitchen1 from "@/assets/images/optimized/AdobeStock_615565130_1771521960347.webp";
import galleryLiving1 from "@/assets/images/optimized/AdobeStock_470165599_1771521960348.webp";
import galleryKitchen2 from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_19_17_PM_1771521960349.webp";
import galleryDoor from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_18_07_PM_1771521960349.webp";
import galleryExterior from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_15_32_PM_1771521960350.webp";
import galleryPorch from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_18_31_PM_1771528760345.webp";
import galleryFence from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_23_09_PM_1771529000104.webp";
import galleryFenceWhite from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_36_54_PM_1771541172783.webp";
import galleryFenceDark from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_35_34_PM_1771541172783.webp";
import galleryHallway from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_45_31_PM_1771541281424.webp";
import galleryLivingRoom from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_44_00_PM_1771541281424.webp";
import galleryBedroom from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_42_48_PM_1771541281424.webp";
import galleryDeckPorch from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_06_07_59_PM_1771542495142.webp";
import galleryDeckGray from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_06_07_32_PM_1771542495142.webp";
import galleryDeckCovered from "@/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_06_03_13_PM_1771542495143.webp";
import galleryDeckStained from "@/assets/images/optimized/Feb_19,_2026,_06_02_24_PM_1771542495143.webp";
import galleryBedroomBlue from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_51_26_AM_1771595655138.webp";
import galleryFoyer from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_49_57_AM_1771595655139.webp";
import galleryDiningRoom from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_49_54_AM_1771595655139.webp";
import galleryKitchen from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_44_03_AM_1771595655139.webp";
import galleryExtCraftsman from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_10_18_AM_1771596640067.webp";
import galleryExtWhiteBrick from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_09_43_AM_1771596640068.webp";
import galleryExtGreenRanch from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_09_39_AM_1771596640068.webp";
import galleryExtColonial from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_09_36_AM_1771596640068.webp";
import galleryExtRanchTan from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_02_27_AM_1771596640068.webp";
import galleryExtBlueShutters from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_02_19_AM_1771596640069.webp";
import galleryCabSage from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_42_AM_1771597260881.webp";
import galleryCabCharcoal from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_20_AM_1771597260882.webp";
import galleryCabNavy from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_15_AM_1771597260882.webp";
import galleryCabWhite from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_12_AM_1771597260882.webp";
import galleryFenceBlack from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_34_38_AM_1771598093722.webp";
import galleryFenceBrown from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_34_08_AM_1771598093722.webp";
import galleryFenceRedCedar from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_34_03_AM_1771598093723.webp";
import galleryFenceHorizontal from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_41_12_AM_1771598503007.webp";
import galleryCommRetail from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_51_AM_1771600212443.webp";
import galleryCommWarehouse from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_46_AM_1771600212444.webp";
import galleryCommOffice from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_31_AM_1771600212444.webp";
import galleryCommRestaurant from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_28_AM_1771600212444.webp";
import galleryCommModern from "@/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_24_AM_1771600212445.webp";

export const SERVICE_CATEGORIES = [
  "Interior",
  "Exterior",
  "Cabinets",
  "Deck",
  "Fence",
  "Commercial",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const CATEGORY_FILTER_MAP: Record<string, ServiceCategory> = {
  interior: "Interior",
  exterior: "Exterior",
  cabinets: "Cabinets",
  deck: "Deck",
  fence: "Fence",
  commercial: "Commercial",
};

export interface ProjectImage {
  id: string;
  src: string;
  alt: string;
  category: ServiceCategory;
  caption: string;
  location?: string;
}

export const allProjects: ProjectImage[] = [
  {
    id: "cab-kitchen-blue",
    src: galleryKitchen1,
    alt: "Kitchen with painted blue island and white cabinets",
    category: "Cabinets",
    caption: "Kitchen Cabinet Refinish",
    location: "Dilworth, Charlotte",
  },
  {
    id: "int-living-elegant",
    src: galleryLiving1,
    alt: "Elegant living room with fresh paint and modern decor",
    category: "Interior",
    caption: "Living Room Repaint",
    location: "Myers Park, Charlotte",
  },
  {
    id: "ext-full-repaint",
    src: galleryExterior,
    alt: "Beautifully painted home exterior with landscaping",
    category: "Exterior",
    caption: "Full Exterior Repaint",
    location: "South Charlotte",
  },
  {
    id: "cab-kitchen-white",
    src: galleryKitchen2,
    alt: "Modern kitchen with freshly painted white cabinets",
    category: "Cabinets",
    caption: "Cabinet Painting",
    location: "Matthews, NC",
  },
  {
    id: "fence-privacy-stain",
    src: galleryFence,
    alt: "Wooden fence with fresh stain finish",
    category: "Fence",
    caption: "Privacy Fence Staining",
    location: "Pineville, NC",
  },
  {
    id: "fence-picket-white",
    src: galleryFenceWhite,
    alt: "White picket fence with fresh paint and garden landscaping",
    category: "Fence",
    caption: "Picket Fence Painting",
    location: "Matthews, NC",
  },
  {
    id: "fence-dark-modern",
    src: galleryFenceDark,
    alt: "Modern dark-stained horizontal fence with patio area",
    category: "Fence",
    caption: "Privacy Fence Staining",
    location: "South Charlotte",
  },
  {
    id: "deck-porch-blue",
    src: galleryDeckPorch,
    alt: "Front porch with blue-gray painted deck and white railings",
    category: "Deck",
    caption: "Front Porch Deck Painting",
    location: "Matthews, NC",
  },
  {
    id: "deck-gray-composite",
    src: galleryDeckGray,
    alt: "Gray composite deck with black metal railings and outdoor seating",
    category: "Deck",
    caption: "Backyard Deck Staining",
    location: "Indian Trail, NC",
  },
  {
    id: "deck-covered-natural",
    src: galleryDeckCovered,
    alt: "Covered porch with natural wood stained deck and outdoor furniture",
    category: "Deck",
    caption: "Covered Porch Staining",
    location: "Waxhaw, NC",
  },
  {
    id: "deck-refinish-rich",
    src: galleryDeckStained,
    alt: "Large backyard deck with rich wood stain finish",
    category: "Deck",
    caption: "Deck Refinishing",
    location: "Concord, NC",
  },
  {
    id: "int-hallway-trim",
    src: galleryHallway,
    alt: "Freshly painted hallway with white trim and stair railing",
    category: "Interior",
    caption: "Hallway & Trim Repaint",
    location: "Huntersville, NC",
  },
  {
    id: "int-living-warm",
    src: galleryLivingRoom,
    alt: "Warm neutral living room with fresh paint and crown molding",
    category: "Interior",
    caption: "Living Room Refresh",
    location: "Ballantyne, Charlotte",
  },
  {
    id: "int-bedroom-navy",
    src: galleryBedroom,
    alt: "Bedroom with navy accent wall and light gray walls",
    category: "Interior",
    caption: "Accent Wall & Bedroom",
    location: "Myers Park, Charlotte",
  },
  {
    id: "int-bedroom-blue",
    src: galleryBedroomBlue,
    alt: "Serene bedroom with soft blue-gray walls and white trim",
    category: "Interior",
    caption: "Master Bedroom Painting",
    location: "Mint Hill, NC",
  },
  {
    id: "int-foyer-staircase",
    src: galleryFoyer,
    alt: "Foyer and staircase with warm neutral walls and white trim",
    category: "Interior",
    caption: "Foyer & Staircase",
    location: "Dilworth, Charlotte",
  },
  {
    id: "int-dining-green",
    src: galleryDiningRoom,
    alt: "Dining room with deep green walls and white wainscoting",
    category: "Interior",
    caption: "Dining Room & Wainscoting",
    location: "Plaza Midwood, Charlotte",
  },
  {
    id: "int-kitchen-teal",
    src: galleryKitchen,
    alt: "Kitchen with white painted cabinets and teal accent wall",
    category: "Interior",
    caption: "Kitchen Repaint",
    location: "Fort Mill, SC",
  },
  {
    id: "ext-craftsman-trim",
    src: galleryExtCraftsman,
    alt: "Craftsman-style brick home with dark green trim and stone columns",
    category: "Exterior",
    caption: "Exterior Trim & Door",
    location: "NoDa, Charlotte",
  },
  {
    id: "ext-white-brick",
    src: galleryExtWhiteBrick,
    alt: "White painted brick farmhouse with black windows and metal roof",
    category: "Exterior",
    caption: "Full Brick Painting",
    location: "Weddington, NC",
  },
  {
    id: "ext-green-ranch",
    src: galleryExtGreenRanch,
    alt: "Sage green painted brick ranch with white trim and carport",
    category: "Exterior",
    caption: "Brick Ranch Repaint",
    location: "Gastonia, NC",
  },
  {
    id: "ext-colonial-tan",
    src: galleryExtColonial,
    alt: "Tan painted brick colonial with white trim and portico",
    category: "Exterior",
    caption: "Colonial Exterior",
    location: "South Charlotte",
  },
  {
    id: "ext-ranch-tan",
    src: galleryExtRanchTan,
    alt: "Light tan painted brick ranch home with white trim",
    category: "Exterior",
    caption: "Brick Ranch Painting",
    location: "Matthews, NC",
  },
  {
    id: "ext-blue-shutters",
    src: galleryExtBlueShutters,
    alt: "Blue-gray painted brick home with cedar shutters and white columns",
    category: "Exterior",
    caption: "Full Exterior Painting",
    location: "Huntersville, NC",
  },
  {
    id: "ext-door-blue",
    src: galleryDoor,
    alt: "Beautiful blue front door with glass panels",
    category: "Exterior",
    caption: "Front Door & Trim",
    location: "Ballantyne, Charlotte",
  },
  {
    id: "ext-porch-ceiling",
    src: galleryPorch,
    alt: "Covered porch with freshly painted ceiling and trim",
    category: "Exterior",
    caption: "Porch Ceiling & Trim",
    location: "Mint Hill, NC",
  },
  {
    id: "cab-sage-modern",
    src: galleryCabSage,
    alt: "Modern kitchen with sage green painted cabinets and open shelving",
    category: "Cabinets",
    caption: "Sage Green Cabinets",
    location: "Dilworth, Charlotte",
  },
  {
    id: "cab-charcoal-farm",
    src: galleryCabCharcoal,
    alt: "Kitchen with dark charcoal painted cabinets and farmhouse sink",
    category: "Cabinets",
    caption: "Charcoal Cabinet Painting",
    location: "Ballantyne, Charlotte",
  },
  {
    id: "cab-navy-island",
    src: galleryCabNavy,
    alt: "Kitchen with navy blue painted cabinets and white island countertop",
    category: "Cabinets",
    caption: "Navy Cabinet Refinishing",
    location: "Myers Park, Charlotte",
  },
  {
    id: "cab-white-classic",
    src: galleryCabWhite,
    alt: "Classic white painted kitchen cabinets with butcher block countertops",
    category: "Cabinets",
    caption: "White Cabinet Painting",
    location: "Indian Trail, NC",
  },
  {
    id: "fence-black-privacy",
    src: galleryFenceBlack,
    alt: "Black stained privacy fence with landscaping and stone accents",
    category: "Fence",
    caption: "Black Fence Staining",
    location: "Waxhaw, NC",
  },
  {
    id: "fence-brown-cedar",
    src: galleryFenceBrown,
    alt: "Rich brown stained cedar privacy fence along driveway",
    category: "Fence",
    caption: "Cedar Fence Staining",
    location: "Concord, NC",
  },
  {
    id: "fence-red-cedar",
    src: galleryFenceRedCedar,
    alt: "Red cedar stained privacy fence with fire pit area",
    category: "Fence",
    caption: "Cedar Fence Refinishing",
    location: "Fort Mill, SC",
  },
  {
    id: "fence-horizontal",
    src: galleryFenceHorizontal,
    alt: "Horizontal cedar fence with warm honey stain finish",
    category: "Fence",
    caption: "Horizontal Fence Staining",
    location: "Matthews, NC",
  },
  {
    id: "comm-retail-strip",
    src: galleryCommRetail,
    alt: "Freshly painted retail strip center with cream stucco and black trim",
    category: "Commercial",
    caption: "Retail Center Painting",
    location: "South Charlotte",
  },
  {
    id: "comm-warehouse",
    src: galleryCommWarehouse,
    alt: "Green painted brick warehouse building with industrial windows",
    category: "Commercial",
    caption: "Warehouse Exterior",
    location: "NoDa, Charlotte",
  },
  {
    id: "comm-office-tan",
    src: galleryCommOffice,
    alt: "Professional office building with tan exterior and white columns",
    category: "Commercial",
    caption: "Office Building",
    location: "Ballantyne, Charlotte",
  },
  {
    id: "comm-restaurant",
    src: galleryCommRestaurant,
    alt: "Restaurant exterior with warm orange stucco and outdoor patio",
    category: "Commercial",
    caption: "Restaurant Repaint",
    location: "Huntersville, NC",
  },
  {
    id: "comm-modern-office",
    src: galleryCommModern,
    alt: "Modern commercial building with gray stucco and large windows",
    category: "Commercial",
    caption: "Commercial Office",
    location: "South End, Charlotte",
  },
];

export function getProjectsByCategory(category: ServiceCategory): ProjectImage[] {
  return allProjects.filter((p) => p.category === category);
}
