import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getAuthSession } from "@/lib/auth";
import { userService } from "@/lib/userService";
import { dbConnect } from "@/lib/dbConnect";
import { User, Role, Organization } from "@/models/index";

export async function GET() {
   const session = await getAuthSession();

   if (!session || !session.user) {
      return NextResponse.json({
         authenticated: false,
         subscribed: false,
         user: null,
      });
   }

   try {
      const user = await userService.getUserByEmail(session.user.email);

      if (!user) {
         return NextResponse.json({
            authenticated: true,
            subscribed: false,
            user: session.user,
         });
      }

      return NextResponse.json({
         authenticated: true,
         subscribed: !!user.subscription,
         user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            subscription: user.subscription,
         },
      });
   } catch (error) {
      console.error("Error fetching user:", error);
      return NextResponse.json({
         authenticated: true,
         subscribed: false,
         user: session.user,
      });
   }
}

export async function POST(request) {
   try {
      await dbConnect();
      const body = await request.json();
      const { name, email, password, company, phone } = body || {};

      if (!name || !email || !password) {
         return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
      }

      if (String(password).length < 6) {
         return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
         return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
      }

      let role = await Role.findOne({ name: "admin" });
      if (!role) {
         role = await Role.create({
            name: "admin",
            description: "Organization administrator",
            permissions: [],
            isSystemRole: true,
            isDefault: true,
         });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await User.create({
         name: name.trim(),
         email: email.toLowerCase().trim(),
         password: hashedPassword,
         emailVerified: true,
         status: "active",
         role: role._id,
         profile: { phone: phone || undefined },
      });

      const organization = await Organization.create({
         name: company || `${name}'s Organization`,
         owner: user._id,
      });

      user.organization = organization._id;
      await user.save();

      return NextResponse.json(
         {
            ok: true,
            user: {
               id: user._id,
               name: user.name,
               email: user.email,
            },
         },
         { status: 201 }
      );
   } catch (error) {
      console.error("Signup error:", error);
      return NextResponse.json({ error: error.message || "Signup failed" }, { status: 500 });
   }
}
