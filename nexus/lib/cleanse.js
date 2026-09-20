import { dbConnect } from "./dbConnect.js";
import { InventoryItem, Product, Warehouse } from "../models/index.js";

const PASSES = ["orphans", "qty", "expiry", "drift", "zero"];

function orgFilter(org) {
   return org ? { organization: org } : {};
}

function finding(pass, id, reason, extra = {}) {
   return { pass, id: id ? String(id) : null, reason, ...extra };
}

export async function scanOrphans(org) {
   const items = await InventoryItem.find(orgFilter(org)).select("_id product warehouse organization").lean();
   const productIds = [...new Set(items.map((i) => String(i.product)).filter(Boolean))];
   const warehouseIds = [...new Set(items.map((i) => String(i.warehouse)).filter(Boolean))];
   const [products, warehouses] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select("_id").lean(),
      Warehouse.find({ _id: { $in: warehouseIds } }).select("_id").lean(),
   ]);
   const productSet = new Set(products.map((p) => String(p._id)));
   const warehouseSet = new Set(warehouses.map((w) => String(w._id)));
   return items
      .filter((i) => !productSet.has(String(i.product)) || !warehouseSet.has(String(i.warehouse)))
      .map((i) =>
         finding("orphans", i._id, !productSet.has(String(i.product)) ? "missing_product" : "missing_warehouse", {
            product: i.product ? String(i.product) : null,
            warehouse: i.warehouse ? String(i.warehouse) : null,
         })
      );
}

export async function scanQty(org) {
   const items = await InventoryItem.find(orgFilter(org))
      .select("_id quantity cost status")
      .lean();
   const out = [];
   for (const i of items) {
      const onHand = Number(i.quantity?.onHand || 0);
      const reserved = Number(i.quantity?.reserved || 0);
      const available = Number(i.quantity?.available || 0);
      const damaged = Number(i.quantity?.damaged || 0);
      const expectedAvailable = Math.max(0, onHand - reserved);
      if (onHand < 0 || reserved < 0 || damaged < 0) {
         out.push(finding("qty", i._id, "negative", { onHand, reserved, damaged }));
      }
      if (reserved > onHand) {
         out.push(finding("qty", i._id, "reserved_exceeds_on_hand", { onHand, reserved }));
      }
      if (available !== expectedAvailable) {
         out.push(finding("qty", i._id, "available_drift", { available, expectedAvailable }));
      }
   }
   return out;
}

export async function scanExpiry(org) {
   const now = new Date();
   const items = await InventoryItem.find({
      ...orgFilter(org),
      "expiry.date": { $exists: true, $ne: null },
   })
      .select("_id expiry")
      .lean();
   return items
      .filter((i) => {
         const expired = i.expiry.date < now;
         return expired !== Boolean(i.expiry.isExpired);
      })
      .map((i) => finding("expiry", i._id, "flag_stale", { date: i.expiry.date, isExpired: i.expiry.isExpired }));
}

export async function scanDrift(org) {
   const match = orgFilter(org);
   const [sums, products] = await Promise.all([
      InventoryItem.aggregate([
         { $match: match },
         { $group: { _id: "$product", onHand: { $sum: "$quantity.onHand" } } },
      ]),
      Product.find(match).select("_id sku inventory.currentStock").lean(),
   ]);
   const byProduct = new Map(sums.map((s) => [String(s._id), s.onHand]));
   const out = [];
   for (const p of products) {
      const rolled = byProduct.get(String(p._id)) || 0;
      const current = Number(p.inventory?.currentStock || 0);
      if (rolled !== current) {
         out.push(finding("drift", p._id, "product_stock_mismatch", { sku: p.sku, current, rolled }));
      }
   }
   return out;
}

export async function scanZero(org) {
   return InventoryItem.find({
      ...orgFilter(org),
      "quantity.onHand": 0,
      "quantity.reserved": 0,
      status: { $in: ["inactive", "discontinued", "out_of_stock"] },
   })
      .select("_id status")
      .lean()
      .then((rows) => rows.map((i) => finding("zero", i._id, "empty_inactive", { status: i.status })));
}

async function applyOrphans(findings) {
   const ids = findings.map((f) => f.id).filter(Boolean);
   if (!ids.length) return 0;
   const res = await InventoryItem.deleteMany({ _id: { $in: ids } });
   return res.deletedCount || 0;
}

async function applyQty(findings) {
   let applied = 0;
   const ids = [...new Set(findings.map((f) => f.id).filter(Boolean))];
   for (const id of ids) {
      const item = await InventoryItem.findById(id);
      if (!item) continue;
      item.quantity.onHand = Math.max(0, item.quantity.onHand || 0);
      item.quantity.reserved = Math.min(Math.max(0, item.quantity.reserved || 0), item.quantity.onHand);
      item.quantity.damaged = Math.max(0, item.quantity.damaged || 0);
      item.quantity.available = Math.max(0, item.quantity.onHand - item.quantity.reserved);
      await item.save();
      applied += 1;
   }
   return applied;
}

async function applyExpiry(findings) {
   let applied = 0;
   const now = new Date();
   for (const f of findings) {
      const item = await InventoryItem.findById(f.id);
      if (!item?.expiry?.date) continue;
      item.expiry.isExpired = item.expiry.date < now;
      const diff = item.expiry.date - now;
      item.expiry.daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
      await item.save();
      applied += 1;
   }
   return applied;
}

async function applyDrift(findings) {
   let applied = 0;
   for (const f of findings) {
      const res = await Product.updateOne({ _id: f.id }, { $set: { "inventory.currentStock": f.rolled } });
      applied += res.modifiedCount || 0;
   }
   return applied;
}

async function applyZero(findings) {
   const ids = findings.map((f) => f.id).filter(Boolean);
   if (!ids.length) return 0;
   const res = await InventoryItem.deleteMany({ _id: { $in: ids } });
   return res.deletedCount || 0;
}

const SCANNERS = {
   orphans: scanOrphans,
   qty: scanQty,
   expiry: scanExpiry,
   drift: scanDrift,
   zero: scanZero,
};

const APPLIERS = {
   orphans: applyOrphans,
   qty: applyQty,
   expiry: applyExpiry,
   drift: applyDrift,
   zero: applyZero,
};

export function parsePasses(value) {
   if (!value || value === "all") return [...PASSES];
   const requested = String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
   const unknown = requested.filter((p) => !PASSES.includes(p));
   if (unknown.length) {
      throw new Error(`unknown pass: ${unknown.join(",")} (want ${PASSES.join("|")}|all)`);
   }
   return requested;
}

export async function cleanseInventory({
   org = null,
   passes = PASSES,
   apply = false,
   limit = 0,
} = {}) {
   await dbConnect();
   const selected = Array.isArray(passes) ? passes : parsePasses(passes);
   const report = {
      startedAt: new Date().toISOString(),
      org: org || null,
      apply: Boolean(apply),
      passes: selected,
      findings: [],
      applied: {},
      counts: {},
   };

   for (const pass of selected) {
      let found = await SCANNERS[pass](org);
      if (limit > 0) found = found.slice(0, limit);
      report.findings.push(...found);
      report.counts[pass] = found.length;
      if (apply && found.length) {
         report.applied[pass] = await APPLIERS[pass](found);
      } else {
         report.applied[pass] = 0;
      }
   }

   report.total = report.findings.length;
   report.finishedAt = new Date().toISOString();
   return report;
}

export { PASSES };
