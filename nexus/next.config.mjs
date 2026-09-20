/** @type {import('next').NextConfig} */
const nextConfig = {
   serverExternalPackages: ["mongoose", "bcrypt", "mongodb", "mongodb-memory-server"],
   images: {
      remotePatterns: [
         {
            protocol: "https",
            hostname: "lh3.googleusercontent.com",
         },
      ],
   },
};

export default nextConfig;
