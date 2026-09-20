import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import { User, Role } from "@/models/index";

export async function POST(request) {
   try {
      await dbConnect();

      const body = await request.json();
      const { email, name } = body || {};

      if (!email || !name) {
         return NextResponse.json(
            {
               ok: false,
               error: "Email and name are required",
            },
            { status: 400 }
         );
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
         return NextResponse.json({
            ok: true,
            message: "User already exists",
            user: {
               id: existingUser._id,
               email: existingUser.email,
               name: existingUser.name,
               hasPin: !!existingUser.pin,
            },
         });
      }

      let defaultRole = await Role.findOne({ name: "user" });
      if (!defaultRole) {
         defaultRole = new Role({
            name: "user",
            description: "Default user role",
            permissions: [],
            isSystemRole: true,
         });
         await defaultRole.save();
      }

      const bcrypt = (await import("bcrypt")).default;
      const hashedPassword = await bcrypt.hash("test123", 10);

      const newUser = new User({
         name,
         email,
         password: hashedPassword,
         emailVerified: true,
         status: "active",
         role: defaultRole._id,
      });

      const savedUser = await newUser.save();

      return NextResponse.json({
         ok: true,
         message: "Test user created successfully",
         user: {
            id: savedUser._id,
            email: savedUser.email,
            name: savedUser.name,
            hasPin: !!savedUser.pin,
         },
      });
   } catch (error) {
      console.error("Create test user error:", error);
      return NextResponse.json(
         {
            ok: false,
            error: "Failed to create test user",
            message: error.message,
         },
         { status: 500 }
      );
   }
}
