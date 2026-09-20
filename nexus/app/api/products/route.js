import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { productService } from "@/lib/productService";

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
      const search = searchParams.get("search") || searchParams.get("q");
      const category = searchParams.get("category");
      const status = searchParams.get("status");
      const organization = searchParams.get("organization") || orgId(user);

      if (search) {
         const searchResults = await productService.searchProducts(search);
         const filtered = organization
            ? searchResults.filter((p) => String(p.organization) === String(organization))
            : searchResults;
         return NextResponse.json({
            success: true,
            data: filtered,
            meta: { pagination: { total: filtered.length, page: 1, limit: filtered.length, pages: 1 } },
         });
      }

      const filter = {};
      if (organization) filter.organization = organization;
      if (category) filter.category = category;
      if (status) filter.status = status;

      const { products, pagination } = await productService.getProducts({ page, limit, filter });
      return NextResponse.json({ success: true, data: products, meta: { pagination } });
   } catch (error) {
      console.error("GET /api/products:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
   }
}

export async function POST(request) {
   try {
      const { isAuthenticated, user } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const body = await request.json().catch(() => ({}));
      if (!body.name || !body.sku) {
         return NextResponse.json({ error: "Product name and SKU are required" }, { status: 400 });
      }

      const organization = body.organization || orgId(user);
      if (!organization) {
         return NextResponse.json({ error: "Organization is required" }, { status: 400 });
      }
      if (!body.category) {
         return NextResponse.json({ error: "Category is required" }, { status: 400 });
      }

      // Normalize pricing from flat or nested payloads
      const pricing = body.pricing || {
         costPrice: body.costPrice ?? body.cost_price ?? 0,
         sellingPrice: body.sellingPrice ?? body.price ?? body.basePrice ?? 0,
         currency: body.currency || "USD",
      };

      const product = await productService.createProduct({
         ...body,
         pricing,
         organization,
         createdBy: user._id || user.id,
      });

      return NextResponse.json({ success: true, data: product }, { status: 201 });
   } catch (error) {
      console.error("POST /api/products:", error);
      return NextResponse.json(
         { success: false, error: error.message || "Failed to create product" },
         { status: 500 }
      );
   }
}
