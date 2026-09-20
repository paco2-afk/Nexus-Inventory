import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getAuthSession } from "@/lib/auth";
import { userService } from "@/lib/userService";
import { dbConnect } from "@/lib/dbConnect";
import { User, Role, Organization } from "@/models/index";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

function jsonError(error, status) {
   return NextResponse.json({ error }, { status });
}

async function getOrCreateRole(name, extras = {}) {
   let role = await Role.findOne({ name });
   if (!role) {
      role = await Role.create({
         name,
         permissions: [],
         isSystemRole: true,
         ...extras,
      });
   }
   return role;
}

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

/**
 * Email/password signup used by /signup.
 * Body: { name, email, password, company?, phone? }
 * Success: 201 { ok: true, user } so the page can auto-sign-in with credentials.
 * Errors: { error } with 400 / 409 / 500.
 */
export async function POST(request) {
   try {
      let body;
      try {
         body = await request.json();
      } catch {
         return jsonError("Invalid JSON body", 400);
      }

      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const company = typeof body?.company === "string" ? body.company.trim() : "";
      const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

      if (!name || !email || !password) {
         return jsonError("Name, email, and password are required", 400);
      }

      if (!EMAIL_RE.test(email)) {
         return jsonError("Enter a valid email address", 400);
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
         return jsonError("Password must be at least 6 characters", 400);
      }

      // bcrypt silently truncates past 72 bytes
      if (Buffer.byteLength(password, "utf8") > 72) {
         return jsonError("Password is too long", 400);
      }

      await dbConnect();

      const existing = await User.findOne({ email });
      if (existing) {
         return jsonError("An account with this email already exists", 409);
      }

      // Empty database: first account is admin so a fresh install is usable.
      // Later signups match the OAuth path and get the default "user" role.
      const isFirstUser = (await User.countDocuments()) === 0;
      const role = isFirstUser
         ? await getOrCreateRole("admin", {
              description: "Organization administrator",
           })
         : await getOrCreateRole("user", {
              description: "Default user role",
              isDefault: true,
           });

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const user = await User.create({
         name,
         email,
         password: hashedPassword,
         status: "active",
         role: role._id,
         profile: phone ? { phone } : undefined,
      });

      if (company) {
         try {
            const organization = await Organization.create({
               name: company,
               owner: user._id,
            });
            user.organization = organization._id;
            await user.save();
         } catch (orgError) {
            console.error("Signup: organization create failed:", orgError);
         }
      }

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
      if (error?.code === 11000) {
         return jsonError("An account with this email already exists", 409);
      }

      console.error("Signup error:", error);
      return jsonError("Signup failed. Please try again.", 500);
   }
}
