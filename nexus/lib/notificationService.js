import { dbConnect } from "./dbConnect";
import { User } from "../models/index";
import Notification from "../models/Notification";

export const notificationService = {
   async getUserNotifications({ userId, page = 1, limit = 10, unreadOnly = false } = {}) {
      await dbConnect();
      const skip = (page - 1) * limit;
      const filter = { user: userId };
      if (unreadOnly) filter.read = false;
      const [total, notifications] = await Promise.all([
         Notification.countDocuments(filter),
         Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ]);
      return { notifications, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
   },
   async getNotificationById(id) {
      await dbConnect();
      return Notification.findById(id);
   },
   async createNotification(notificationData) {
      await dbConnect();
      const notification = new Notification(notificationData);
      await notification.save();
      return notification;
   },
   async markAsRead(userId, notificationIds) {
      await dbConnect();
      const filter = { user: userId };
      if (notificationIds && notificationIds.length > 0) filter._id = { $in: notificationIds };
      const result = await Notification.updateMany(filter, { $set: { read: true } });
      return result.modifiedCount;
   },
   async deleteNotifications(userId, notificationIds) {
      await dbConnect();
      const filter = { user: userId };
      if (notificationIds && notificationIds.length > 0) filter._id = { $in: notificationIds };
      const result = await Notification.deleteMany(filter);
      return result.deletedCount;
   },
   async getUnreadCount(userId) {
      await dbConnect();
      return Notification.countDocuments({ user: userId, read: false });
   },
   async createSystemNotification({ title, message, type = "info", roles = [] } = {}) {
      await dbConnect();
      const filter = {};
      if (roles && roles.length > 0) filter.roles = { $in: roles };
      const users = await User.find(filter).select("_id");
      const notifications = users.map((user) => ({
         user: user._id, title, message, type, read: false,
      }));
      if (notifications.length > 0) {
         const result = await Notification.insertMany(notifications);
         return result.length;
      }
      return 0;
   },
};
