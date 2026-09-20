import { NextResponse } from "next/server";
import { getAuthServerSession, hasRole } from "@/lib/apiAuth";
import { inventoryService } from "@/lib/inventoryService";

function orgId(user) {
   return user?.organization?._id || user?.organization || null;
}

export async function GET(request) {
   try {
      const { isAuthenticated, user } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const warehouseId = searchParams.get("warehouse");
      const productId = searchParams.get("product");
      const lowStock = searchParams.get("lowStock") === "true";
      const organization = searchParams.get("organization") || orgId(user);

      if (lowStock) {
         const lowStockItems = await inventoryService.getLowStockItems(organization);
         return NextResponse.json({
            success: true,
            data: lowStockItems,
            meta: {
               pagination: {
                  total: lowStockItems.length,
                  page: 1,
                  limit: lowStockItems.length,
                  pages: 1,
               },
            },
         });
      }

      const filter = {};
      if (organization) filter.organization = organization;
      if (warehouseId) filter.warehouse = warehouseId;
      if (productId) filter.product = productId;

      const { items, pagination } = await inventoryService.getInventory({ page, limit, filter });
      return NextResponse.json({ success: true, data: items, meta: { pagination } });
   } catch (error) {
      console.error("GET /api/inventory:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch inventory" }, { status: 500 });
   }
}

export async function POST(request) {
   try {
      const { isAuthenticated, isAdmin, user } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      if (!isAdmin && !hasRole(user, "inventory_manager") && !hasRole(user, "manager")) {
         return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }

      const body = await request.json().catch(() => ({}));
      if (!body.product || !body.warehouse) {
         return NextResponse.json({ error: "Product and warehouse are required" }, { status: 400 });
      }

      const organization = body.organization || orgId(user);
      const item = await inventoryService.createInventoryItem({
         ...body,
         organization,
         createdBy: user._id || user.id,
      });

      return NextResponse.json({ success: true, data: item }, { status: 201 });
   } catch (error) {
      console.error("POST /api/inventory:", error);
      const status = error.message?.includes("not found") || error.message?.includes("already exists") ? 400 : 500;
      return NextResponse.json({ success: false, error: error.message || "Failed to create inventory item" }, { status });
   }
}
