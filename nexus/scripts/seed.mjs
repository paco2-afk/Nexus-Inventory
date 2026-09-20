import bcrypt from "bcrypt";
import { dbConnect, mongoose } from "../lib/dbConnect.js";
import { User, Role, Organization, Category, Product, Warehouse, Supplier, InventoryItem } from "../models/index.js";

async function seed() {
   await dbConnect();

   let role = await Role.findOne({ name: "admin" });
   if (!role) {
      role = await Role.create({
         name: "admin",
         description: "Organization administrator",
         permissions: [],
         isSystemRole: true,
         isDefault: true,
      });
   }

   const email = "admin@nexus.local";
   let user = await User.findOne({ email });
   if (!user) {
      user = await User.create({
         name: "Nexus Admin",
         email,
         password: await bcrypt.hash("admin123", 10),
         emailVerified: true,
         status: "active",
         role: role._id,
         pin: "123456",
      });
   }

   let org = await Organization.findOne({ owner: user._id });
   if (!org) {
      org = await Organization.create({
         name: "Nexus Demo",
         owner: user._id,
      });
      user.organization = org._id;
      await user.save();
   }

   let warehouse = await Warehouse.findOne({ code: "MAIN" });
   if (!warehouse) {
      warehouse = await Warehouse.create({
         name: "Main Warehouse",
         code: "MAIN",
         organization: org._id,
         location: { address: { city: "Nashville", country: "US" } },
      });
   }

   let supplier = await Supplier.findOne({ code: "ACME" });
   if (!supplier) {
      supplier = await Supplier.create({
         name: "Acme Supply",
         code: "ACME",
         organization: org._id,
         contact: { email: "orders@acme.example" },
      });
   }

   let category = await Category.findOne({ name: "General" });
   if (!category) {
      category = await Category.create({
         name: "General",
         organization: org._id,
         createdBy: user._id,
      });
   }

   const samples = [
      { name: "Warehouse Label Roll", sku: "NEX-1001", cost: 4.5, sell: 9.99, stock: 120 },
      { name: "Barcode Scanner", sku: "NEX-1002", cost: 45, sell: 89.0, stock: 18 },
      { name: "Packing Tape", sku: "NEX-1003", cost: 1.2, sell: 3.5, stock: 8 },
   ];

   for (const item of samples) {
      let product = await Product.findOne({ sku: item.sku });
      if (!product) {
         product = await Product.create({
            name: item.name,
            sku: item.sku,
            category: category._id,
            organization: org._id,
            supplier: supplier._id,
            pricing: { costPrice: item.cost, sellingPrice: item.sell },
            inventory: { currentStock: item.stock, minimumStock: 10, reorderPoint: 15 },
            createdBy: user._id,
         });
      }

      const existingItem = await InventoryItem.findOne({ product: product._id, warehouse: warehouse._id });
      if (!existingItem) {
         await InventoryItem.create({
            product: product._id,
            warehouse: warehouse._id,
            organization: org._id,
            quantity: { onHand: item.stock, reserved: 0, available: item.stock },
         });
      }
   }

   console.log("Seed complete");
   console.log("Login: admin@nexus.local / admin123");
   console.log("PIN: 123456");

   await mongoose.disconnect();
   process.exit(0);
}

seed().catch((err) => {
   console.error(err);
   process.exit(1);
});
