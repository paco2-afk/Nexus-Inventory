import { dbConnect } from "./dbConnect";
import Setting from "../models/Setting";

export const settingsService = {
   async getSettings() {
      await dbConnect();
      const settings = await Setting.find();
      const settingsObject = {};
      settings.forEach((setting) => {
         settingsObject[setting.key] = setting.value;
      });
      return settingsObject;
   },
   async getSetting(key, defaultValue = null) {
      await dbConnect();
      const setting = await Setting.findOne({ key });
      return setting ? setting.value : defaultValue;
   },
   async updateSettings(settings) {
      await dbConnect();
      const updates = [];
      const settingsObject = {};
      for (const [key, value] of Object.entries(settings)) {
         updates.push(Setting.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true }));
      }
      const updatedSettings = await Promise.all(updates);
      updatedSettings.forEach((setting) => {
         settingsObject[setting.key] = setting.value;
      });
      return settingsObject;
   },
   async deleteSetting(key) {
      await dbConnect();
      const result = await Setting.findOneAndDelete({ key });
      return !!result;
   },
   getDefaults() {
      return {
         siteName: "Nexus Inventory",
         companyName: "Nexus Technologies",
         currency: "USD",
         dateFormat: "MM/DD/YYYY",
         timeZone: "UTC",
         lowStockThreshold: 10,
         enableEmailNotifications: true,
         theme: "light",
         itemsPerPage: 10,
      };
   },
};
