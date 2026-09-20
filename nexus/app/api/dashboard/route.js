import { NextResponse } from "next/server";
import { getAuthServerSession } from "@/lib/apiAuth";
import { dbConnect } from "@/lib/dbConnect";
import { Product, Order, InventoryItem, Supplier, User } from "@/models/index";
import Notification from "@/models/Notification";

export async function GET() {
   try {
      const { isAuthenticated } = await getAuthServerSession();
      if (!isAuthenticated) {
         return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      await dbConnect();
      const [productsCount, ordersCount, inventoryItemsCount, suppliersCount, usersCount, notificationsCount] =
         await Promise.all([
            Product.countDocuments(),
            Order.countDocuments(),
            InventoryItem.countDocuments(),
            Supplier.countDocuments(),
            User.countDocuments(),
            Notification.countDocuments({ read: false }),
         ]);
      const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).select("orderNumber total status createdAt");
      const summary = {
         counts: {
            products: productsCount,
            orders: ordersCount,
            inventory: inventoryItemsCount,
            suppliers: suppliersCount,
            users: usersCount,
            notifications: notificationsCount,
         },
         recentOrders,
      };
      return NextResponse.json({ data: summary });
   } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
   }
}
