import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { productService } from "@/lib/productService";

export async function GET(_request, { params }) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { id } = await params;
      const categories = await productService.getCategories();
      const category = categories.find((c) => String(c._id) === String(id));
      if (!category) {
         return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: category });
   } catch (error) {
      console.error("GET /api/categories/[id]:", error);
      return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
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
      const category = await productService.updateCategory(id, {
         ...body,
         updatedBy: user._id || user.id,
      });
      if (!category) {
         return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: category });
   } catch (error) {
      console.error("PUT /api/categories/[id]:", error);
      return NextResponse.json({ error: error.message || "Failed to update category" }, { status: 500 });
   }
}

export async function DELETE(_request, { params }) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { id } = await params;
      await productService.deleteCategory(id);
      return NextResponse.json({ success: true });
   } catch (error) {
      console.error("DELETE /api/categories/[id]:", error);
      const status = error.message?.includes("Cannot delete") ? 409 : 500;
      return NextResponse.json({ error: error.message || "Failed to delete category" }, { status });
   }
}
