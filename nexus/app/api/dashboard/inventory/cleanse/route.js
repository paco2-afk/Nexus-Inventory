import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { cleanseInventory, parsePasses } from "@/lib/cleanse";

export async function GET(request) {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const { searchParams } = new URL(request.url);
      const report = await cleanseInventory({
         org: searchParams.get("org") || null,
         passes: parsePasses(searchParams.get("pass") || "all"),
         apply: false,
         limit: Number(searchParams.get("limit") || 0),
      });
      return NextResponse.json({ data: report });
   } catch (error) {
      return NextResponse.json({ error: error.message || "cleanse failed" }, { status: 400 });
   }
}

export async function POST(request) {
   try {
      const { isAuthenticated, isAdmin } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      if (!isAdmin) {
         return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const report = await cleanseInventory({
         org: body.org || null,
         passes: parsePasses(body.pass || "all"),
         apply: Boolean(body.apply),
         limit: Number(body.limit || 0),
      });
      return NextResponse.json({ data: report });
   } catch (error) {
      return NextResponse.json({ error: error.message || "cleanse failed" }, { status: 400 });
   }
}
