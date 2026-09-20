import { productService } from "./productService";
import { inventoryService } from "./inventoryService";
import { orderService } from "./orderService";
import { userService } from "./userService";
import { notificationService } from "./notificationService";
import { settingsService } from "./settingsService";
import { dbConnect } from "./dbConnect";
import { Product, Supplier, Warehouse, Order, Category } from "../models/index";

function wrapCrud(Model) {
   return {
      async list() {
         await dbConnect();
         return Model.find().sort({ updatedAt: -1 }).lean();
      },
      async get(id) {
         await dbConnect();
         return Model.findById(id);
      },
      async create(data) {
         await dbConnect();
         const doc = new Model(data);
         await doc.save();
         return doc;
      },
      async update(id, data) {
         await dbConnect();
         return Model.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
      },
      async remove(id) {
         await dbConnect();
         const result = await Model.findByIdAndDelete(id);
         return !!result;
      },
   };
}

const suppliers = wrapCrud(Supplier);
const warehouses = wrapCrud(Warehouse);

const serviceProvider = {
   getAuthService() {
      return {
         async authenticateUser() {
            throw new Error("Use NextAuth credentials provider");
         },
      };
   },
   getProductService() {
      return {
         ...productService,
         listProducts: async () => {
            const { products } = await productService.getProducts({ page: 1, limit: 100 });
            return products;
         },
         updateProduct: productService.updateProduct.bind(productService),
         createProduct: productService.createProduct.bind(productService),
         deleteProduct: productService.deleteProduct.bind(productService),
      };
   },
   getInventoryService() {
      return inventoryService;
   },
   getOrderService() {
      return {
         ...orderService,
         listOrders: async () => {
            const { orders } = await orderService.getOrders({ page: 1, limit: 100 });
            return orders;
         },
         createOrder: orderService.createOrder.bind(orderService),
         updateOrder: async (id, data) => {
            await dbConnect();
            return Order.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
         },
         deleteOrder: async (id) => {
            await dbConnect();
            const result = await Order.findByIdAndDelete(id);
            return !!result;
         },
      };
   },
   getSupplierService() {
      return {
         listSuppliers: suppliers.list,
         getSupplier: suppliers.get,
         createSupplier: suppliers.create,
         updateSupplier: suppliers.update,
         deleteSupplier: suppliers.remove,
      };
   },
   getUserService() {
      return userService;
   },
   getNotificationService() {
      return notificationService;
   },
   getReportingService() {
      return { async generateReport() { return { status: "not_configured" }; } };
   },
   getAnalyticsService() {
      return { async getMetrics() { return {}; } };
   },
   getSettingsService() {
      return settingsService;
   },
   getWarehouseService() {
      return {
         listWarehouses: warehouses.list,
         getWarehouse: warehouses.get,
         createWarehouse: warehouses.create,
         updateWarehouse: warehouses.update,
         deleteWarehouse: warehouses.remove,
      };
   },
   getProfileService() {
      return {
         getProfile: async () => ({}),
         updateProfile: async (data) => data,
      };
   },
   getBillingService() { return {}; },
   getMediaService() { return {}; },
   getSearchService() {
      return { searchProducts: productService.searchProducts?.bind(productService) };
   },
   getFeatureFlagService() { return { isEnabled: async () => false }; },
   getCacheService() { return {}; },
   getImportExportService() { return {}; },
   getRoleService() { return {}; },
   getSecurityService() { return {}; },
   getSchedulerService() { return {}; },
   getTenantService() { return {}; },
   getPaymentService() { return {}; },
   getCategoryService() {
      return {
         listCategories: async () => {
            await dbConnect();
            return Category.find().lean();
         },
      };
   },
   getCatalog() {
      return Product;
   },
};

export default serviceProvider;
