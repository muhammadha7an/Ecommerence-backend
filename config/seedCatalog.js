const Category = require("../models/Category");
const Product = require("../models/Product");

const initialCategories = [
  { legacyId: 1, name: "Everyday Essentials", image: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=600" },
  { legacyId: 2, name: "Home Accents", image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=600" },
  { legacyId: 3, name: "Accessories", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=600" },
  { legacyId: 4, name: "Stationery & Office", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600" },
  { legacyId: 5, name: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=600" },
  { legacyId: 6, name: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=600" },
];

const initialProducts = [
  // Everyday Essentials (categoryId: 1)
  { legacyId: 1, name: "Canvas Tote Bag", price: 24, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&q=80", stock: 15, inStock: true, isFeatured: true },
  { legacyId: 2, name: "Stainless Steel Water Bottle", price: 28, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80", stock: 20, inStock: true, isFeatured: true },
  { legacyId: 3, name: "Eco Mesh Shopping Bag", price: 12, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80", stock: 35, inStock: true },
  { legacyId: 4, name: "Insulated Travel Tumbler", price: 32, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&q=80", stock: 18, inStock: true },
  { legacyId: 5, name: "Reusable Cotton Face Pads", price: 15, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&q=80", stock: 25, inStock: true },
  { legacyId: 31, name: "Foldable Reusable Shopping Crate", price: 20, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=500&q=80", stock: 12, inStock: true },
  { legacyId: 32, name: "Silicone Food Storage Bags (Set of 3)", price: 19, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1584473457406-6240486418e9?w=500&q=80", stock: 22, inStock: true },
  { legacyId: 48, name: "Collapsible Silicone Cup", price: 13, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80", stock: 30, inStock: true },
  { legacyId: 49, name: "Organic Cotton Produce Bags (Set of 5)", price: 16, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80", stock: 28, inStock: true },
  { legacyId: 50, name: "Reusable Beeswax Food Wraps", price: 21, categoryId: 1, category: "Everyday Essentials", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&q=80", stock: 16, inStock: true },

  // Home Accents (categoryId: 2)
  { legacyId: 6, name: "Ceramic Coffee Mug", price: 18, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&q=80", stock: 24, inStock: true, isFeatured: true },
  { legacyId: 7, name: "Soy Wax Scented Candle", price: 22, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500&q=80", stock: 30, inStock: true, isFeatured: true },
  { legacyId: 8, name: "Woven Cotton Throw Blanket", price: 45, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&q=80", stock: 14, inStock: true },
  { legacyId: 9, name: "Minimalist Ceramic Vase", price: 30, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?w=500&q=80", stock: 10, inStock: true },
  { legacyId: 10, name: "Decorative Brass Tray", price: 38, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=500&q=80", stock: 8, inStock: true },
  { legacyId: 11, name: "Tabletop Succulent Planter", price: 26, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&q=80", stock: 15, inStock: true },
  { legacyId: 33, name: "Macrame Wall Hanging", price: 34, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1587384215930-3b7f174e0bfd?w=500&q=80", stock: 7, inStock: true },
  { legacyId: 34, name: "Rattan Storage Basket", price: 29, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=500&q=80", stock: 19, inStock: true },
  { legacyId: 35, name: "Terracotta Plant Pot Trio", price: 24, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&q=80", stock: 11, inStock: true },
  { legacyId: 51, name: "Linen Throw Pillow Cover", price: 19, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&q=80", stock: 22, inStock: true },
  { legacyId: 52, name: "Wooden Wall Clock", price: 40, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=500&q=80", stock: 6, inStock: true },
  { legacyId: 53, name: "Woven Jute Doormat", price: 27, categoryId: 2, category: "Home Accents", image: "https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?w=500&q=80", stock: 14, inStock: true },

  // Accessories (categoryId: 3)
  { legacyId: 12, name: "Minimalist Wrist Watch", price: 85, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80", stock: 9, inStock: true, isFeatured: true },
  { legacyId: 13, name: "Handcrafted Leather Keychain", price: 14, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=500&q=80", stock: 40, inStock: true },
  { legacyId: 14, name: "Canvas Baseball Cap", price: 25, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&q=80", stock: 18, inStock: true },
  { legacyId: 15, name: "Wool Blend Knit Scarf", price: 35, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=500&q=80", stock: 12, inStock: true },
  { legacyId: 16, name: "Polarized Sunglasses", price: 48, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&q=80", stock: 16, inStock: true },
  { legacyId: 36, name: "Leather Belt", price: 32, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80", stock: 20, inStock: true },
  { legacyId: 37, name: "Woven Friendship Bracelet Set", price: 10, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&q=80", stock: 50, inStock: true },
  { legacyId: 38, name: "Canvas Crossbody Bag", price: 44, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80", stock: 11, inStock: true },
  { legacyId: 54, name: "Silk Neck Tie", price: 30, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80", stock: 15, inStock: true },
  { legacyId: 55, name: "Merino Wool Beanie", price: 26, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=500&q=80", stock: 24, inStock: true },
  { legacyId: 56, name: "Leather Wallet", price: 52, categoryId: 3, category: "Accessories", image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=500&q=80", stock: 14, inStock: true },

  // Stationery & Office (categoryId: 4)
  { legacyId: 17, name: "Linen Hardcover Notebook", price: 16, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80", stock: 30, inStock: true, isFeatured: true },
  { legacyId: 18, name: "Classic Fountain Pen Set", price: 40, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&q=80", stock: 17, inStock: true },
  { legacyId: 19, name: "Wooden Desk Organizer", price: 28, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=500&q=80", stock: 13, inStock: true },
  { legacyId: 20, name: "Leather Pocket Journal", price: 22, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?w=500&q=80", stock: 25, inStock: true },
  { legacyId: 21, name: "Brass Bookmarks (Set of 3)", price: 12, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&q=80", stock: 45, inStock: true },
  { legacyId: 39, name: "Washi Tape Collection", price: 9, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1519791883288-dc8bd696e667?w=500&q=80", stock: 60, inStock: true },
  { legacyId: 40, name: "Recycled Paper Sticky Notes", price: 7, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&q=80", stock: 55, inStock: true },
  { legacyId: 41, name: "Wooden Desk Calendar", price: 18, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=500&q=80", stock: 20, inStock: true },
  { legacyId: 57, name: "Kraft Paper Envelope Set", price: 11, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80", stock: 35, inStock: true },
  { legacyId: 58, name: "Leather Pen Holder", price: 15, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?w=500&q=80", stock: 28, inStock: true },
  { legacyId: 59, name: "Corkboard Wall Planner", price: 24, categoryId: 4, category: "Stationery & Office", image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&q=80", stock: 16, inStock: true },

  // Kitchen & Dining (categoryId: 5)
  { legacyId: 22, name: "Wooden Salad Bowl Set", price: 42, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&q=80", stock: 14, inStock: true, isFeatured: true },
  { legacyId: 23, name: "Glass Teapot with Infuser", price: 36, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80", stock: 19, inStock: true },
  { legacyId: 24, name: "Marble Coaster Set (Set of 4)", price: 20, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80", stock: 32, inStock: true },
  { legacyId: 25, name: "Linen Dinner Napkins (Set of 4)", price: 22, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500&q=80", stock: 26, inStock: true },
  { legacyId: 42, name: "Cast Iron Trivet", price: 17, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&q=80", stock: 21, inStock: true },
  { legacyId: 43, name: "Handblown Glass Tumbler Set", price: 34, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80", stock: 15, inStock: true },
  { legacyId: 44, name: "Bamboo Cutting Board", price: 26, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1584346133934-260ef1f42e59?w=500&q=80", stock: 18, inStock: true },
  { legacyId: 60, name: "Stoneware Dinner Plate Set", price: 48, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80", stock: 10, inStock: true },
  { legacyId: 61, name: "Copper Moscow Mule Mugs (Set of 2)", price: 30, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500&q=80", stock: 12, inStock: true },
  { legacyId: 62, name: "Olive Wood Serving Spoons", price: 21, categoryId: 5, category: "Kitchen & Dining", image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&q=80", stock: 20, inStock: true },

  // Self Care & Wellness (categoryId: 6)
  { legacyId: 26, name: "Aroma Essential Oil Diffuser", price: 35, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&q=80", stock: 22, inStock: true, isFeatured: true },
  { legacyId: 27, name: "Organic Herbal Tea Sampler", price: 18, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&q=80", stock: 30, inStock: true },
  { legacyId: 28, name: "Silk Sleep Eye Mask", price: 24, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&q=80", stock: 17, inStock: true },
  { legacyId: 29, name: "Bamboo Dry Body Brush", price: 16, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80", stock: 25, inStock: true },
  { legacyId: 45, name: "Lavender Bath Salts", price: 15, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&q=80", stock: 35, inStock: true },
  { legacyId: 46, name: "Weighted Meditation Cushion", price: 55, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80", stock: 8, inStock: true },
  { legacyId: 47, name: "Natural Loofah Sponge Set", price: 11, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&q=80", stock: 40, inStock: true },
  { legacyId: 63, name: "Jade Facial Roller", price: 20, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&q=80", stock: 28, inStock: true },
  { legacyId: 64, name: "Shea Butter Hand Cream", price: 13, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&q=80", stock: 33, inStock: true },
  { legacyId: 65, name: "Herbal Bath Soak Sampler", price: 22, categoryId: 6, category: "Self Care & Wellness", image: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&q=80", stock: 19, inStock: true },
];

const seedCatalog = async () => {
  try {
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      console.log("Seeding initial categories to MongoDB...");
      await Category.insertMany(initialCategories);
      console.log(`Seeded ${initialCategories.length} categories.`);
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log("Seeding initial products to MongoDB...");
      await Product.insertMany(initialProducts);
      console.log(`Seeded ${initialProducts.length} products.`);
    }
  } catch (error) {
    console.error("Error during catalog seeding:", error.message);
  }
};

module.exports = seedCatalog;

