import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { productService } from "@/lib/productService";
import { dbConnect } from "@/lib/dbConnect";
import { Category } from "@/models/index";

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
      const tree = searchParams.get("tree") === "true";
      const organization = searchParams.get("organization") || orgId(user);

      await dbConnect();

      const filter = {};
      if (organization) filter.organization = organization;
      if (searchParams.get("includeInactive") !== "true") filter.isActive = true;

      let categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });

      if (tree) {
         const byId = new Map(categories.map((c) => [String(c._id), { ...c.toObject(), children: [] }]));
         const roots = [];
         for (const cat of byId.values()) {
            if (cat.parent && byId.has(String(cat.parent))) {
               byId.get(String(cat.parent)).children.push(cat);
            } else {
               roots.push(cat);
            }
         }
         return NextResponse.json({ success: true, data: roots });
      }

      return NextResponse.json({ success: true, data: categories });
   } catch (error) {
      console.error("GET /api/categories:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 });
   }
}

export async function POST(request) {
   try {
      const { isAuthenticated, user, isAdmin } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const body = await request.json().catch(() => ({}));
      if (!body.name) {
         return NextResponse.json({ error: "Category name is required" }, { status: 400 });
      }

      const organization = body.organization || orgId(user);
      if (!organization) {
         return NextResponse.json(
            { error: "Organization is required. Set user.organization or pass organization in body." },
            { status: 400 }
         );
      }

      const category = await productService.createCategory({
         ...body,
         organization,
         createdBy: user._id || user.id,
      });

      return NextResponse.json({ success: true, data: category }, { status: 201 });
   } catch (error) {
      console.error("POST /api/categories:", error);
      if (error.message?.includes("already exists")) {
         return NextResponse.json({ success: false, error: error.message }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message || "Failed to create category" }, { status: 500 });
   }
}
