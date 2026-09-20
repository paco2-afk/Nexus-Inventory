import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { inventoryService } from "@/lib/inventoryService";

export async function GET(_request, { params }) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { id } = await params;
      const item = await inventoryService.getInventoryItemById(id);
      if (!item) {
         return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: item });
   } catch (error) {
      console.error("GET /api/inventory/[id]:", error);
      return NextResponse.json({ error: "Failed to fetch inventory item" }, { status: 500 });
   }
}

export async function PUT(request, { params }) {
   try {
      const { isAuthenticated, user } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const item = await inventoryService.updateInventoryItem(id, {
         ...body,
         updatedBy: user._id || user.id,
      });
      if (!item) {
         return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: item });
   } catch (error) {
      console.error("PUT /api/inventory/[id]:", error);
      return NextResponse.json({ error: error.message || "Failed to update inventory item" }, { status: 500 });
   }
}

export async function DELETE(_request, { params }) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { id } = await params;
      const result = await inventoryService.deleteInventoryItem(id);
      if (!result) {
         return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
   } catch (error) {
      console.error("DELETE /api/inventory/[id]:", error);
      return NextResponse.json({ error: error.message || "Failed to delete inventory item" }, { status: 500 });
   }
}
