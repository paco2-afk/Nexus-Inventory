// services/InventoryService.js
// Aligned with InventoryItem + Transaction models (no StockMovement/StockLevel/Reservation).
import { InventoryItem, Transaction, Product, Warehouse } from "../models/index.js";
import * as NotificationService from "./NotificationService.js";

class InventoryService {
   async recordStockMovement(movementData) {
      const {
         productId,
         warehouseId,
         type,
         quantity,
         reason,
         reference,
         organizationId,
         performedBy,
         unitCost,
      } = movementData;

      const product = await Product.findById(productId);
      const warehouse = await Warehouse.findById(warehouseId);

      if (!product || !warehouse) {
         throw new Error("Product or warehouse not found");
      }

      const orgId = organizationId || product.organization || warehouse.organization;
      if (!orgId) {
         throw new Error("Organization is required for stock movements");
      }

      let item = await InventoryItem.findOne({ product: productId, warehouse: warehouseId });
      if (!item) {
         if (!performedBy) {
            throw new Error("performedBy is required when creating inventory items");
         }
         item = new InventoryItem({
            product: productId,
            warehouse: warehouseId,
            organization: orgId,
            quantity: { onHand: 0, reserved: 0, available: 0, damaged: 0 },
            createdBy: performedBy,
         });
      }

      const previousQuantity = item.quantity?.onHand ?? 0;
      let quantityChange = Number(quantity);

      // Normalize movement types to signed delta
      if (type === "out" || type === "ship" || type === "damage" || type === "loss") {
         quantityChange = -Math.abs(quantityChange);
      } else if (type === "in" || type === "receive" || type === "return") {
         quantityChange = Math.abs(quantityChange);
      }
      // adjustment / count / transfer: quantity may already be signed

      const newQuantity = previousQuantity + quantityChange;
      if (newQuantity < 0) {
         throw new Error("Insufficient stock");
      }

      item.quantity.onHand = newQuantity;
      item.lastMovement = new Date();
      if (performedBy) item.updatedBy = performedBy;
      await item.save();

      const txTypeMap = {
         in: "receive",
         out: "ship",
         adjustment: "adjust",
         adjust: "adjust",
         transfer: "transfer",
         count: "count",
         receive: "receive",
         ship: "ship",
         return: "return",
         damage: "damage",
         loss: "loss",
         reservation: "reservation",
         unreservation: "unreservation",
      };

      const txType = txTypeMap[type] || "adjust";
      const ref = reference || `MOV-${Date.now()}`;

      const transaction = new Transaction({
         organization: orgId,
         type: txType,
         reference: ref,
         referenceType: txType === "count" ? "count" : txType === "transfer" ? "transfer" : "adjustment",
         referenceId: item._id,
         inventoryItem: item._id,
         product: productId,
         warehouse: warehouseId,
         quantityChange,
         previousQuantity,
         newQuantity,
         unitCost: unitCost ?? item.cost?.unitCost,
         reason,
         performedBy: performedBy || item.createdBy,
      });

      await transaction.save();

      await this.checkLowStockAlerts(productId, warehouseId);

      return { movement: transaction, item };
   }

   async getStockLevels(productId, warehouseId) {
      const item = await InventoryItem.findOne({
         product: productId,
         warehouse: warehouseId,
      }).populate("product warehouse");

      if (!item) {
         return { productId, warehouseId, quantity: 0, reserved: 0, available: 0 };
      }

      const onHand = item.quantity?.onHand ?? 0;
      const reserved = item.quantity?.reserved ?? 0;

      return {
         productId,
         warehouseId,
         quantity: onHand,
         reserved,
         available: item.quantity?.available ?? onHand - reserved,
         item,
      };
   }

   async performStockTake(warehouseId, counts, { organizationId, performedBy } = {}) {
      const results = { updated: [], discrepancies: [] };

      for (const count of counts) {
         const { productId, countedQuantity } = count;
         const currentStock = await this.getStockLevels(productId, warehouseId);
         const discrepancy = Number(countedQuantity) - currentStock.quantity;

         if (discrepancy !== 0) {
            await this.recordStockMovement({
               productId,
               warehouseId,
               type: "count",
               quantity: discrepancy,
               reason: "Stock take adjustment",
               reference: `ST-${Date.now()}`,
               organizationId,
               performedBy,
            });

            results.discrepancies.push({
               productId,
               expected: currentStock.quantity,
               counted: countedQuantity,
               discrepancy,
            });
         }

         results.updated.push({ productId, quantity: countedQuantity });
      }

      return results;
   }

   async transferStock(fromWarehouse, toWarehouse, productId, quantity, opts = {}) {
      const sourceStock = await this.getStockLevels(productId, fromWarehouse);
      if (sourceStock.available < quantity) {
         throw new Error("Insufficient stock in source warehouse");
      }

      const ref = `TRF-${Date.now()}`;

      await this.recordStockMovement({
         productId,
         warehouseId: fromWarehouse,
         type: "out",
         quantity: -Math.abs(quantity),
         reason: "Transfer to warehouse",
         reference: ref,
         ...opts,
      });

      await this.recordStockMovement({
         productId,
         warehouseId: toWarehouse,
         type: "in",
         quantity: Math.abs(quantity),
         reason: "Transfer from warehouse",
         reference: ref,
         ...opts,
      });

      return { success: true, transferred: quantity, reference: ref };
   }

   async reserveStock(productId, quantity, warehouseId, orderId, opts = {}) {
      const item = await InventoryItem.findOne({ product: productId, warehouse: warehouseId });
      if (!item) {
         throw new Error("Inventory item not found");
      }

      const available = (item.quantity?.onHand ?? 0) - (item.quantity?.reserved ?? 0);
      if (available < quantity) {
         throw new Error("Insufficient available stock");
      }

      item.quantity.reserved = (item.quantity.reserved || 0) + quantity;
      await item.save();

      if (opts.performedBy && opts.organizationId) {
         await new Transaction({
            organization: opts.organizationId,
            type: "reservation",
            reference: `RSV-${orderId || Date.now()}`,
            referenceType: "order",
            referenceId: orderId || item._id,
            inventoryItem: item._id,
            product: productId,
            warehouse: warehouseId,
            quantityChange: 0,
            previousQuantity: item.quantity.onHand,
            newQuantity: item.quantity.onHand,
            reason: `Reserved ${quantity} for order`,
            performedBy: opts.performedBy,
            metadata: { reserved: quantity, orderId },
         }).save();
      }

      return {
         product: productId,
         warehouse: warehouseId,
         quantity,
         order: orderId,
         status: "active",
         expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         inventoryItem: item._id,
      };
   }

   async releaseReservation(productId, warehouseId, quantity, opts = {}) {
      const item = await InventoryItem.findOne({ product: productId, warehouse: warehouseId });
      if (!item) {
         throw new Error("Inventory item not found");
      }

      item.quantity.reserved = Math.max(0, (item.quantity.reserved || 0) - quantity);
      await item.save();

      if (opts.performedBy && opts.organizationId) {
         await new Transaction({
            organization: opts.organizationId,
            type: "unreservation",
            reference: `URSV-${Date.now()}`,
            referenceType: "order",
            referenceId: opts.orderId || item._id,
            inventoryItem: item._id,
            product: productId,
            warehouse: warehouseId,
            quantityChange: 0,
            previousQuantity: item.quantity.onHand,
            newQuantity: item.quantity.onHand,
            reason: `Released reservation of ${quantity}`,
            performedBy: opts.performedBy,
         }).save();
      }

      return item;
   }

   async checkLowStockAlerts(productId, warehouseId) {
      const product = await Product.findById(productId);
      if (!product) return;

      const threshold =
         product.inventory?.minimumStock ??
         product.inventory?.reorderPoint ??
         product.lowStockThreshold;
      if (threshold == null) return;

      const stockLevel = await this.getStockLevels(productId, warehouseId);
      if (stockLevel.quantity <= threshold) {
         if (typeof NotificationService.sendLowStockAlert === "function") {
            await NotificationService.sendLowStockAlert(productId, warehouseId, stockLevel.quantity);
         } else if (typeof NotificationService.sendLowStockAlerts === "function") {
            await NotificationService.sendLowStockAlerts(productId, warehouseId, stockLevel.quantity);
         }
      }
   }
}

const inventoryService = new InventoryService();
export default inventoryService;
