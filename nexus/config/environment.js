const optional = ["NODE_ENV", "MONGODB_URI", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];

optional.forEach((v) => {
   if (!process.env[v] && process.env.NODE_ENV === "production") {
      console.warn(`Missing environment variable: ${v}`);
   }
});

export const environment = {
   nodeEnv: process.env.NODE_ENV || "development",
   port: process.env.PORT || 3000,
   jwtSecret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nexus-dev-secret",
   mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nexusdb",
};
