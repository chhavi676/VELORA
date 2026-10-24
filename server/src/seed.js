import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import Product from "./models/Product.js";
import RunwayShow from "./models/RunwayShow.js";
import ModelProfile from "./models/ModelProfile.js";

// ---------------------------------------------------------------------------
// Demo catalogue. IMAGES: only a handful of licensed-for-demo Unsplash photos are
// used, so photos repeat within a category. Replace any `img(...)` below with your
// own image URL (or edit products later from the Admin dashboard) before publishing.
// ---------------------------------------------------------------------------
const U = (id, w = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
const PHOTO = {
  gown: "photo-1566174053879-31528523f8ae",
  silk: "photo-1539008835657-9e8e9680c956",
  blazer: "photo-1591047139829-d91aecb6caea",
  bag: "photo-1584917865442-de89df76afd3",
  heels: "photo-1543163521-1bf539c55dd2",
  coat: "photo-1539533018447-63fcce2678e3",
  runway: "photo-1539109136881-3be0616acf4b",
  light: "photo-1509631179647-0177331693ae",
  campaign: "photo-1529139574466-a303027c1d8b",
  m1: "photo-1534528741775-53994a69daeb",
  m2: "photo-1524504388940-b1c1722653e1",
  m3: "photo-1508214751196-bcfd4ca60f91"
};
const img = (key, alt, view = "Front") => ({ url: U(PHOTO[key]), alt, view });

const CLOTHING = ["XS", "S", "M", "L", "XL"];
const SHOES = ["36", "37", "38", "39", "40", "41"];
const CARE_DRY = "Dry clean only. Store on a padded hanger away from direct sunlight.";
const CARE_LEATHER = "Wipe with a soft dry cloth. Store in the dust bag provided.";

const p = (slug, name, designer, category, price, tag, description, extra) => ({ slug, name, designer, category, price, tag, description, ...extra });

const products = [
  // Dresses
  p("sculpted-evening-gown", "Sculpted Evening Gown", "Maison Aurel", "Dresses", 128000, "RUNWAY EDIT", "A sculptural silhouette for after-dark occasions.", { inventory: 5, isFeatured: true, sizes: CLOTHING, colors: ["Noir", "Bordeaux"], material: "Heavy crepe, silk-satin lining", care: CARE_DRY, details: ["Boned bodice for structure", "Concealed side zip", "Floor-length with a subtle train", "Made in Italy"], images: [img("gown", "Sculptural evening dress"), img("silk", "Eveningwear editorial", "Editorial")] }),
  p("silk-column-dress", "Silk Column Dress", "Maison Aurel", "Dresses", 156000, "RUNWAY EDIT", "Fluid silk, understated lines, unmistakable presence.", { inventory: 4, isFeatured: true, sizes: CLOTHING, colors: ["Ivory", "Midnight"], material: "100% mulberry silk", care: CARE_DRY, details: ["Bias-cut column silhouette", "Hand-rolled hems", "Fully lined", "Made in France"], images: [img("silk", "Silk evening dress"), img("gown", "Evening dress detail", "Editorial")] }),
  p("draped-satin-midi", "Draped Satin Midi", "Atelier Seren", "Dresses", 98000, "NEW ARRIVAL", "A softly draped midi that moves with every step.", { inventory: 9, sizes: CLOTHING, colors: ["Champagne", "Forest"], material: "Duchess satin", care: CARE_DRY, details: ["Cowl neckline", "Side-gathered waist", "Mid-calf length"], images: [img("silk", "Draped satin midi dress"), img("gown", "Satin dress editorial", "Editorial")] }),
  p("cut-out-cocktail-dress", "Cut-Out Cocktail Dress", "Studio Noire", "Dresses", 84000, "LIMITED", "A precise geometric cut-out set against a clean sheath.", { inventory: 2, sizes: CLOTHING, colors: ["Noir"], material: "Stretch wool crepe", care: CARE_DRY, details: ["Waist cut-out detail", "Back zip", "Knee length"], images: [img("gown", "Cocktail dress"), img("silk", "Cocktail dress editorial", "Editorial")] }),
  // Tailoring
  p("atelier-blazer", "The Atelier Blazer", "Studio Noire", "Tailoring", 89000, "NEW ARRIVAL", "Precision tailoring with a relaxed, modern line.", { inventory: 8, isFeatured: true, sizes: CLOTHING, colors: ["Black", "Stone"], material: "Virgin wool twill", care: CARE_DRY, details: ["Single-breasted, two-button", "Half-canvassed construction", "Working cuff buttons"], images: [img("blazer", "Tailored jacket")] }),
  p("double-breasted-jacket", "Double-Breasted Jacket", "Maison Aurel", "Tailoring", 112000, "SIGNATURE", "A broad-shouldered double-breasted jacket with a long line.", { inventory: 6, sizes: CLOTHING, colors: ["Charcoal", "Black"], material: "Italian wool-mohair blend", care: CARE_DRY, details: ["Peak lapels", "Six-button front", "Fully lined in cupro"], images: [img("blazer", "Double-breasted jacket")] }),
  p("pinstripe-waistcoat", "Pinstripe Waistcoat", "Atelier Seren", "Tailoring", 46000, "EDITOR'S PICK", "A fitted waistcoat made to be worn alone or layered.", { inventory: 10, sizes: CLOTHING, colors: ["Navy pinstripe"], material: "Wool suiting", care: CARE_DRY, details: ["Adjustable back strap", "Welt pockets", "V-neckline"], images: [img("blazer", "Pinstripe waistcoat")] }),
  p("relaxed-wool-suit-jacket", "Relaxed Wool Suit Jacket", "Studio Noire", "Tailoring", 76000, "NEW ARRIVAL", "An unstructured jacket that keeps its shape without the stiffness.", { inventory: 7, sizes: CLOTHING, colors: ["Oat", "Ink"], material: "Wool-linen blend", care: CARE_DRY, details: ["Soft shoulder", "Patch pockets", "Unlined for summer wear"], images: [img("blazer", "Relaxed suit jacket")] }),
  // Accessories & Bags
  p("lumiere-mini-bag", "Lumière Mini Bag", "Élan Objects", "Accessories", 64000, "EDITOR'S PICK", "A compact statement piece with polished hardware.", { inventory: 12, sizes: [], colors: ["Black", "Tan"], material: "Calfskin leather, brass hardware", care: CARE_LEATHER, details: ["Top handle with detachable strap", "Magnetic closure", "W 19 × H 13 × D 7 cm"], images: [img("bag", "Designer handbag")] }),
  p("structured-tote", "Structured Tote", "Élan Objects", "Bags", 92000, "SIGNATURE", "A work-to-evening tote with room for a laptop.", { inventory: 6, colors: ["Black", "Cognac"], material: "Grained calfskin", care: CARE_LEATHER, details: ["Fits a 14-inch laptop", "Interior zip pocket", "W 36 × H 28 × D 13 cm"], images: [img("bag", "Structured tote")] }),
  p("evening-clutch", "Evening Clutch", "Élan Objects", "Bags", 38000, "LIMITED", "A slim clutch with a hidden chain strap.", { inventory: 1, colors: ["Gold", "Noir"], material: "Satin with metallic trim", care: CARE_LEATHER, details: ["Fits phone and cards", "Concealed chain strap", "W 24 × H 13 cm"], images: [img("bag", "Evening clutch")] }),
  p("saddle-crossbody", "Saddle Crossbody", "Atelier Seren", "Bags", 58000, "NEW ARRIVAL", "A soft saddle shape with an adjustable strap.", { inventory: 0, colors: ["Chestnut", "Black"], material: "Vegetable-tanned leather", care: CARE_LEATHER, details: ["Adjustable crossbody strap", "Flap closure", "W 22 × H 16 × D 6 cm"], images: [img("bag", "Saddle crossbody bag")] }),
  // Shoes
  p("architectural-heels", "Architectural Heels", "Élan Objects", "Shoes", 72000, "LIMITED", "A clean profile with a distinctive sculptural heel.", { inventory: 6, sizes: SHOES, colors: ["Black", "Bone"], material: "Nappa leather upper, leather sole", care: CARE_LEATHER, details: ["85 mm sculpted heel", "Pointed toe", "Made in Italy"], images: [img("heels", "Statement heels")] }),
  p("slingback-pumps", "Slingback Pumps", "Atelier Seren", "Shoes", 54000, "NEW ARRIVAL", "A low slingback that goes from desk to dinner.", { inventory: 11, sizes: SHOES, colors: ["Nude", "Black"], material: "Patent leather", care: CARE_LEATHER, details: ["60 mm kitten heel", "Adjustable back strap", "Cushioned insole"], images: [img("heels", "Slingback pumps")] }),
  p("ankle-strap-sandals", "Ankle-Strap Sandals", "Élan Objects", "Shoes", 61000, "EDITOR'S PICK", "A minimal two-strap sandal with a sculpted block heel.", { inventory: 8, sizes: SHOES, colors: ["Gold", "Black"], material: "Metallic leather", care: CARE_LEATHER, details: ["70 mm block heel", "Buckle ankle strap"], images: [img("heels", "Ankle-strap sandals")] }),
  p("pointed-ankle-boots", "Pointed Ankle Boots", "Studio Noire", "Shoes", 78000, "SIGNATURE", "A sharp ankle boot with a stacked heel.", { inventory: 5, sizes: SHOES, colors: ["Black"], material: "Calf leather", care: CARE_LEATHER, details: ["50 mm stacked heel", "Inner zip", "Leather lining"], images: [img("heels", "Pointed ankle boots")] }),
  // Outerwear
  p("soft-structure-coat", "Soft Structure Coat", "Studio Noire", "Outerwear", 174000, "SIGNATURE", "An elevated outer layer designed for repeat wear.", { inventory: 3, isFeatured: true, sizes: CLOTHING, colors: ["Camel", "Black"], material: "Double-faced wool-cashmere", care: CARE_DRY, details: ["Raw-edge finish", "Hidden placket", "Below-knee length"], images: [img("coat", "Long tailored coat")] }),
  p("belted-wrap-coat", "Belted Wrap Coat", "Maison Aurel", "Outerwear", 196000, "RUNWAY EDIT", "A wrap coat cut generously and tied at the waist.", { inventory: 4, sizes: CLOTHING, colors: ["Ecru", "Charcoal"], material: "Pure cashmere", care: CARE_DRY, details: ["Self-tie belt", "Deep side pockets", "Fully lined"], images: [img("coat", "Belted wrap coat")] }),
  p("cropped-wool-jacket", "Cropped Wool Jacket", "Atelier Seren", "Outerwear", 68000, "NEW ARRIVAL", "A boxy cropped jacket for in-between weather.", { inventory: 9, sizes: CLOTHING, colors: ["Ink", "Sage"], material: "Brushed wool", care: CARE_DRY, details: ["Boxy fit", "Snap front", "Slanted pockets"], images: [img("coat", "Cropped wool jacket")] }),
  p("quilted-long-parka", "Quilted Long Parka", "Studio Noire", "Outerwear", 124000, "LIMITED", "A long quilted parka with a removable hood.", { inventory: 2, sizes: CLOTHING, colors: ["Black"], material: "Recycled nylon, down fill", care: "Machine wash cold on a delicate cycle; tumble dry low with dryer balls.", details: ["Removable hood", "Water-repellent finish", "Down-filled"], images: [img("coat", "Quilted long parka")] })
];

const demoNote = "Editorial demonstration entry. The title, date, venue and designer are fictional placeholders for this assignment.";
const show = (slug, title, designer, city, season, date, cover, gallery) => ({ slug, title, designer, city, venue: "Demo venue — verify before publication", season, showDate: new Date(date), coverImage: U(PHOTO[cover], 1200), gallery: gallery.map((k) => U(PHOTO[k], 1200)), description: demoNote, sourceLabel: "Assignment demo — not verified" });

const shows = [
  show("paris-shape-of-silence-demo", "The Shape of Silence", "Maison Aurel", "Paris", "AUTUMN / WINTER 2026", "2026-03-08T18:00:00Z", "runway", ["runway", "light"]),
  show("milan-study-in-light-demo", "A Study in Light", "Studio Noire", "Milan", "SPRING / SUMMER 2026", "2026-02-25T18:00:00Z", "light", ["light"]),
  show("copenhagen-soft-geometry-demo", "Soft Geometry", "Élan Objects", "Copenhagen", "RESORT 2026", "2026-01-18T18:00:00Z", "campaign", ["campaign"]),
  show("london-quiet-tailoring-demo", "Quiet Tailoring", "Atelier Seren", "London", "AUTUMN / WINTER 2026", "2026-02-20T18:00:00Z", "campaign", ["campaign", "runway"]),
  show("new-york-after-dark-demo", "After Dark", "Maison Aurel", "New York", "SPRING / SUMMER 2027", "2026-09-10T18:00:00Z", "runway", ["runway"]),
  show("mumbai-first-light-demo", "First Light", "Studio Noire", "Mumbai", "RESORT 2027", "2026-11-14T18:00:00Z", "light", ["light", "campaign"])
];

const demoBio = "Fictional demonstration profile created to preview the portfolio experience. Not a real booking profile.";
const mdl = (slug, displayName, baseCity, heightCm, specialties, portrait, extraPortfolio = []) => ({ slug, displayName, agency: "Independent · Demo", baseCity, heightCm, specialties, bio: demoBio, portraitUrl: U(PHOTO[portrait], 800), portfolio: [{ url: U(PHOTO[portrait]), caption: "Portrait test image", type: "Portrait" }, ...extraPortfolio.map((k) => ({ url: U(PHOTO[k]), caption: "Runway-inspired editorial image", type: "Runway" }))], isDemoProfile: true });

// NOTE: only three demo portraits exist, so faces repeat. Swap `portrait` URLs for real, consented images.
const models = [
  mdl("amara-laurent-demo", "Amara Laurent", "Paris", 178, ["Editorial", "Runway"], "m1", ["runway"]),
  mdl("elise-moreau-demo", "Elise Moreau", "Milan", 175, ["Campaign", "Beauty"], "m2"),
  mdl("nia-bennett-demo", "Nia Bennett", "London", 177, ["Runway", "Editorial"], "m3"),
  mdl("sana-kapoor-demo", "Sana Kapoor", "Mumbai", 172, ["Editorial", "Campaign"], "m2"),
  mdl("lea-hartmann-demo", "Léa Hartmann", "Copenhagen", 180, ["Runway"], "m3", ["light"]),
  mdl("zuri-adeyemi-demo", "Zuri Adeyemi", "New York", 176, ["Campaign", "Runway"], "m1")
];

async function upsertBySlug(Model, records) {
  const operations = records.map(({ inventory, ...record }) => ({
    updateOne: {
      filter: { slug: record.slug },
      // Stock is only set when a record is first inserted, so re-seeding never undoes real sales.
      update: inventory === undefined ? { $set: record } : { $set: record, $setOnInsert: { inventory } },
      upsert: true
    }
  }));
  const result = await Model.bulkWrite(operations, { ordered: true });
  console.log(`${Model.modelName}: matched=${result.matchedCount}, modified=${result.modifiedCount}, inserted=${result.upsertedCount}`);
}

try {
  await connectDatabase();
  await upsertBySlug(Product, products);
  await upsertBySlug(RunwayShow, shows);
  await upsertBySlug(ModelProfile, models);
  console.log("Seed complete. Running the seed again updates these demo records without duplicating them.");
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}