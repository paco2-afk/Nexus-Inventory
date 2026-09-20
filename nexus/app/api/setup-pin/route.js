import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { userService } from "@/lib/userService";

function pinCookies(response) {
   response.cookies.set("pinVerified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
   });
   response.cookies.set("pinVerifiedAt", new Date().toISOString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
   });
   return response;
}

export async function POST(request) {
   try {
      const { isAuthenticated, user } = await getAuthServerSession();
      if (!isAuthenticated || !user) {
         return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
      }
      const body = await request.json();
      const { pin } = body || {};
      if (!pin || typeof pin !== "string") {
         return NextResponse.json({ ok: false, error: "Missing PIN" }, { status: 400 });
      }
      if (!/^\d{6}$/.test(pin)) {
         return NextResponse.json({ ok: false, error: "PIN must be exactly 6 digits" }, { status: 400 });
      }
      const dbUser = await userService.getUserByEmail(user.email);
      if (!dbUser) {
         return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }
      const updatedUser = await userService.updateUser(dbUser._id, { pin });
      if (!updatedUser) {
         return NextResponse.json({ ok: false, error: "Failed to update PIN" }, { status: 500 });
      }
      return pinCookies(NextResponse.json({ ok: true, message: "PIN set up successfully" }));
   } catch (e) {
      console.error("PIN setup error:", e);
      return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
   }
}

export async function GET() {
   try {
      const { isAuthenticated, user } = await getAuthServerSession();
      if (!isAuthenticated || !user) {
         return NextResponse.json({ hasPin: false, error: "Authentication required" }, { status: 401 });
      }
      const dbUser = await userService.getUserByEmail(user.email);
      if (!dbUser) {
         return NextResponse.json({ hasPin: false, error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({ hasPin: !!dbUser.pin });
   } catch (e) {
      console.error("PIN status check error:", e);
      return NextResponse.json({ hasPin: false, error: "Server error" }, { status: 500 });
   }
}
