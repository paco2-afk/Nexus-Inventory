import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { productService } from "@/lib/productService";

export async function GET(request) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "10", 10);
      const search = searchParams.get("search");
      const category = searchParams.get("category");
      const supplier = searchParams.get("supplier");
      const filter = {};
      if (category) filter.category = category;
      if (supplier) filter.supplier = supplier;
      if (search) {
         const searchResults = await productService.searchProducts(search);
         return NextResponse.json({
            data: searchResults,
            pagination: { total: searchResults.length, page: 1, limit: searchResults.length, pages: 1 },
         });
      }
      const { products, pagination } = await productService.getProducts({ page, limit, filter });
      return NextResponse.json({ data: products, pagination });
   } catch (error) {
      console.error("Error fetching products:", error);
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
   }
}

export async function POST(request) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const body = await request.json().catch(() => ({}));
      if (!body.name || !body.sku) {
         return NextResponse.json({ error: "Product name and SKU are required" }, { status: 400 });
      }
      const product = await productService.createProduct(body);
      return NextResponse.json({ data: product }, { status: 201 });
   } catch (error) {
      console.error("Error creating product:", error);
      return NextResponse.json({ error: error.message || "Failed to create product" }, { status: 500 });
   }
}

export async function PUT(request) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const body = await request.json().catch(() => ({}));
      const { id, ...updateData } = body;
      if (!id) return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
      const product = await productService.updateProduct(id, updateData);
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      return NextResponse.json({ data: product });
   } catch (error) {
      console.error("Error updating product:", error);
      return NextResponse.json({ error: error.message || "Failed to update product" }, { status: 500 });
   }
}

export async function DELETE(request) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
      const result = await productService.deleteProduct(id);
      if (!result) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      return NextResponse.json({ success: true });
   } catch (error) {
      console.error("Error deleting product:", error);
      return NextResponse.json({ error: error.message || "Failed to delete product" }, { status: 500 });
   }
}
