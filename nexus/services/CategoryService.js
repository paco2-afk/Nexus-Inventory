// services/CategoryService.js
import { Category, Product } from "../models/index.js";

class CategoryService {
   async getCategories(organizationId, { includeInactive = false } = {}) {
      const filter = {};
      if (organizationId) filter.organization = organizationId;
      if (!includeInactive) filter.isActive = true;
      return Category.find(filter).sort({ sortOrder: 1, name: 1 });
   }

   async getCategoryById(id) {
      return Category.findById(id).populate("parent", "name");
   }

   async createCategory(categoryData) {
      if (!categoryData.name) throw new Error("Category name is required");
      if (!categoryData.organization) throw new Error("Organization is required");
      if (!categoryData.createdBy) throw new Error("createdBy is required");

      const existing = await Category.findOne({
         name: categoryData.name,
         organization: categoryData.organization,
      });
      if (existing) throw new Error("A category with this name already exists");

      const category = new Category(categoryData);
      await category.save();
      return category;
   }

   async updateCategory(id, updateData) {
      if (updateData.name && updateData.organization) {
         const existing = await Category.findOne({
            name: updateData.name,
            organization: updateData.organization,
            _id: { $ne: id },
         });
         if (existing) throw new Error("A category with this name already exists");
      }

      const category = await Category.findByIdAndUpdate(id, updateData, { new: true });
      if (!category) throw new Error("Category not found");
      return category;
   }

   async deleteCategory(id) {
      const productsWithCategory = await Product.countDocuments({ category: id });
      if (productsWithCategory > 0) {
         throw new Error(`Cannot delete category. It is used by ${productsWithCategory} products.`);
      }
      const result = await Category.findByIdAndDelete(id);
      if (!result) throw new Error("Category not found");
      return true;
   }

   async getCategoryTree(organizationId) {
      const categories = await this.getCategories(organizationId);
      const byId = new Map(categories.map((c) => [String(c._id), { ...c.toObject(), children: [] }]));
      const roots = [];

      for (const cat of byId.values()) {
         if (cat.parent && byId.has(String(cat.parent))) {
            byId.get(String(cat.parent)).children.push(cat);
         } else {
            roots.push(cat);
         }
      }
      return roots;
   }

   async getCategoryStats(organizationId) {
      const categories = await this.getCategories(organizationId);
      const stats = [];
      for (const cat of categories) {
         const productCount = await Product.countDocuments({ category: cat._id });
         stats.push({ category: cat, productCount });
      }
      return stats;
   }
}

const categoryService = new CategoryService();
export default categoryService;
