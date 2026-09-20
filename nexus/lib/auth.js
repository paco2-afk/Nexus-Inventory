import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function getAuthSession() {
   try {
      return await getServerSession(authOptions);
   } catch (error) {
      console.error("Error getting session:", error);
      return null;
   }
}

export async function isAuthenticated() {
   const session = await getAuthSession();
   return !!session;
}

export async function isAdmin() {
   const session = await getAuthSession();
   return session && session.user && session.user.role === "admin";
}

export async function getUser() {
   const session = await getAuthSession();
   return session?.user || null;
}
