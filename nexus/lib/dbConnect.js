import { connectDB, disconnectDB, mongoose } from "../config/database";

let cached = global.mongoose;

if (!cached) {
   cached = global.mongoose = { conn: null, promise: null };
}

async function ensureMemoryServer() {
   if (process.env.MONGODB_URI && process.env.MONGODB_URI !== "memory") {
      return;
   }

   if (global.__NEXUS_MEMORY_MONGO__) {
      process.env.MONGODB_URI = global.__NEXUS_MEMORY_MONGO__;
      return;
   }

   try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri("nexusdb");
      global.__NEXUS_MEMORY_MONGO__ = uri;
      global.__NEXUS_MEMORY_MONGO_SERVER__ = mongod;
      process.env.MONGODB_URI = uri;
      console.log("Using in-memory MongoDB");
   } catch (error) {
      console.warn("mongodb-memory-server unavailable, falling back to localhost:", error.message);
      process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nexusdb";
   }
}

async function dbConnect() {
   if (cached.conn) {
      return cached.conn;
   }

   if (!cached.promise) {
      cached.promise = (async () => {
         if (!process.env.MONGODB_URI || process.env.MONGODB_URI === "memory") {
            await ensureMemoryServer();
         }
         return connectDB();
      })().catch((err) => {
         console.error("MongoDB connection error:", err);
         cached.promise = null;
         throw err;
      });
   }

   try {
      cached.conn = await cached.promise;
   } catch (e) {
      cached.promise = null;
      throw e;
   }

   return cached.conn;
}

function isConnected() {
   return mongoose.connection.readyState === 1;
}

export { dbConnect, isConnected, mongoose, disconnectDB };
