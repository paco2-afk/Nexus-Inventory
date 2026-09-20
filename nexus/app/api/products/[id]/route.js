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
      const product = await productService.getProductById(id);
      if (!product) {
         return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: product });
   } catch (error) {
      console.error("GET /api/products/[id]:", error);
      return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
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
      const product = await productService.updateProduct(id, {
         ...body,
         updatedBy: user._id || user.id,
      });
      if (!product) {
         return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: product });
   } catch (error) {
      console.error("PUT /api/products/[id]:", error);
      return NextResponse.json({ error: error.message || "Failed to update product" }, { status: 500 });
   }
}

export async function PATCH(request, context) {
   return PUT(request, context);
}

export async function DELETE(_request, { params }) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { id } = await params;
      const result = await productService.deleteProduct(id);
      if (!result) {
         return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
   } catch (error) {
      console.error("DELETE /api/products/[id]:", error);
      return NextResponse.json({ error: error.message || "Failed to delete product" }, { status: 500 });
   }
}
