import { NextResponse } from "next/server";
import { getAuthServerSession, hasRole } from "@/lib/apiAuth";
import { inventoryService } from "@/lib/inventoryService";

function orgId(user) {
   return user?.organization?._id || user?.organization || null;
}

/**
 * POST /api/inventory/stock-take
 * Body: { warehouseId, counts: [{ productId?, inventoryItemId?, countedQuantity }] }
 */
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
      if (!body.warehouseId || !Array.isArray(body.counts) || body.counts.length === 0) {
         return NextResponse.json(
            { error: "warehouseId and a non-empty counts array are required" },
            { status: 400 }
         );
      }

      const results = await inventoryService.performStockTake(body.warehouseId, body.counts, {
         organizationId: body.organization || orgId(user),
         performedBy: user._id || user.id,
      });

      return NextResponse.json({ success: true, data: results });
   } catch (error) {
      console.error("POST /api/inventory/stock-take:", error);
      return NextResponse.json({ error: error.message || "Stock take failed" }, { status: 500 });
   }
}
