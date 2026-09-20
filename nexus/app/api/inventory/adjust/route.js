import { NextResponse } from "next/server";
import { getAuthServerSession, hasRole } from "@/lib/apiAuth";
import { inventoryService } from "@/lib/inventoryService";

function orgId(user) {
   return user?.organization?._id || user?.organization || null;
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
      const id = body.id || body.inventoryItemId;
      const change = body.change ?? body.quantity;
      const reason = body.reason;

      if (!id || change === undefined || change === null || !reason) {
         return NextResponse.json(
            { error: "Inventory item ID, quantity change, and reason are required" },
            { status: 400 }
         );
      }

      const delta = Number(change);
      if (Number.isNaN(delta)) {
         return NextResponse.json({ error: "Quantity change must be a number" }, { status: 400 });
      }

      const updatedItem = await inventoryService.adjustQuantity(id, delta, reason, {
         performedBy: user._id || user.id,
         organizationId: orgId(user),
      });

      return NextResponse.json({ success: true, data: updatedItem });
   } catch (error) {
      console.error("POST /api/inventory/adjust:", error);
      if (error.message?.includes("not found")) {
         return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message?.includes("Insufficient")) {
         return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to adjust inventory" }, { status: 500 });
   }
}
