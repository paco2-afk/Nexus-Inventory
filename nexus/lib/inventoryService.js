// lib/inventoryService.js — aligned with InventoryItem + Transaction
import { dbConnect } from "./dbConnect";
import { InventoryItem, Product, Warehouse, Transaction } from "../models/index";

const onHand = (item) => item?.quantity?.onHand ?? 0;

export const inventoryService = {
  async getInventory({ page = 1, limit = 10, filter = {} } = {}) {
    await dbConnect();
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      InventoryItem.countDocuments(filter),
      InventoryItem.find(filter)
        .populate("product", "name sku pricing inventory status")
        .populate("warehouse", "name location code")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);
    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 0 } };
  },

  async getInventoryItemById(id) {
    await dbConnect();
    return InventoryItem.findById(id)
      .populate("product", "name sku pricing description category inventory")
      .populate("warehouse", "name location code capacity");
  },

  async createInventoryItem(itemData) {
    await dbConnect();
    const [product, warehouse] = await Promise.all([
      Product.findById(itemData.product),
      Warehouse.findById(itemData.warehouse),
    ]);
    if (!product || !warehouse) throw new Error("Product or warehouse not found");
    const existing = await InventoryItem.findOne({ product: itemData.product, warehouse: itemData.warehouse });
    if (existing) throw new Error("Inventory item already exists for this product and warehouse");
    const qty =
      typeof itemData.quantity === "number"
        ? { onHand: itemData.quantity, reserved: 0, available: itemData.quantity, damaged: 0 }
        : {
            onHand: itemData.quantity?.onHand ?? 0,
            reserved: itemData.quantity?.reserved ?? 0,
            available: itemData.quantity?.available ?? itemData.quantity?.onHand ?? 0,
            damaged: itemData.quantity?.damaged ?? 0,
          };
    const item = new InventoryItem({
      ...itemData,
      organization: itemData.organization || product.organization || warehouse.organization,
      quantity: qty,
    });
    await item.save();
    return InventoryItem.findById(item._id).populate("product", "name sku pricing").populate("warehouse", "name location");
  },

  async updateInventoryItem(id, itemData) {
    await dbConnect();
    if (typeof itemData.quantity === "number") {
      itemData.quantity = { onHand: itemData.quantity, reserved: 0, available: itemData.quantity, damaged: 0 };
    }
    return InventoryItem.findByIdAndUpdate(id, { $set: itemData }, { new: true })
      .populate("product", "name sku pricing")
      .populate("warehouse", "name location");
  },

  async deleteInventoryItem(id) {
    await dbConnect();
    return !!(await InventoryItem.findByIdAndDelete(id));
  },

  async adjustQuantity(id, change, reason, { performedBy, organizationId } = {}) {
    await dbConnect();
    const item = await InventoryItem.findById(id);
    if (!item) throw new Error("Inventory item not found");
    const previousQuantity = onHand(item);
    const delta = Number(change);
    const newQuantity = previousQuantity + delta;
    if (newQuantity < 0) throw new Error("Insufficient inventory");
    item.quantity.onHand = newQuantity;
    item.lastMovement = new Date();
    if (performedBy) item.updatedBy = performedBy;
    await item.save();
    const org = organizationId || item.organization;
    if (org && performedBy) {
      await Transaction.create({
        organization: org,
        type: "adjust",
        reference: `ADJ-${Date.now()}`,
        referenceType: "adjustment",
        referenceId: item._id,
        inventoryItem: item._id,
        product: item.product,
        warehouse: item.warehouse,
        quantityChange: delta,
        previousQuantity,
        newQuantity,
        reason: reason || "Manual adjustment",
        performedBy,
      });
    }
    return InventoryItem.findById(id).populate("product", "name sku pricing").populate("warehouse", "name location");
  },

  async getProductInventory(productId) {
    await dbConnect();
    return InventoryItem.find({ product: productId })
      .populate("warehouse", "name location")
      .select("quantity minimumStock status lastMovement updatedAt");
  },

  async getWarehouseInventory(warehouseId, { page = 1, limit = 10 } = {}) {
    return this.getInventory({ page, limit, filter: { warehouse: warehouseId } });
  },

  async getLowStockItems(organizationId) {
    await dbConnect();
    const filter = { $expr: { $lte: ["$quantity.onHand", "$minimumStock"] }, status: "active" };
    if (organizationId) filter.organization = organizationId;
    return InventoryItem.find(filter)
      .populate("product", "name sku pricing")
      .populate("warehouse", "name location")
      .sort({ "quantity.onHand": 1 });
  },

  async performStockTake(warehouseId, counts, { organizationId, performedBy } = {}) {
    await dbConnect();
    const results = { updated: [], discrepancies: [] };
    for (const count of counts) {
      const { productId, countedQuantity, inventoryItemId } = count;
      let item = inventoryItemId
        ? await InventoryItem.findById(inventoryItemId)
        : await InventoryItem.findOne({ product: productId, warehouse: warehouseId });
      if (!item) {
        results.discrepancies.push({ productId, error: "Inventory item not found" });
        continue;
      }
      const expected = onHand(item);
      const counted = Number(countedQuantity);
      const discrepancy = counted - expected;
      if (discrepancy !== 0) {
        await this.adjustQuantity(item._id, discrepancy, "Stock take adjustment", {
          performedBy,
          organizationId: organizationId || item.organization,
        });
        results.discrepancies.push({ productId: item.product, inventoryItemId: item._id, expected, counted, discrepancy });
      }
      item = await InventoryItem.findById(item._id);
      item.lastCounted = new Date();
      await item.save();
      results.updated.push({ productId: item.product, inventoryItemId: item._id, quantity: counted });
    }
    return results;
  },
};
