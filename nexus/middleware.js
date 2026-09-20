import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
   function middleware(req) {
      const { pathname } = req.nextUrl;
      const skipPin = process.env.SKIP_PIN_VERIFICATION === "true";

      const protectedRoutes = ["/dashboard", "/inventory", "/products", "/orders", "/warehouse", "/reports"];
      const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

      if (isProtectedRoute && !skipPin) {
         const pinVerified = req.cookies.get("pinVerified")?.value;

         if (!pinVerified || pinVerified !== "true") {
            if (pathname.startsWith("/setup-pin")) {
               return NextResponse.next();
            }

            const verifyPinUrl = new URL("/verify-pin", req.url);
            verifyPinUrl.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(verifyPinUrl);
         }
      }

      return NextResponse.next();
   },
   {
      callbacks: {
         authorized: ({ token }) => !!token,
      },
   }
);

export const config = {
   matcher: [
      "/dashboard/:path*",
      "/inventory/:path*",
      "/products/:path*",
      "/orders/:path*",
      "/warehouse/:path*",
      "/reports/:path*",
      "/setup-pin",
   ],
};
