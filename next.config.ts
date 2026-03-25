import type { NextConfig } from "next";
import os from "os";

// Get all local network IP addresses
const interfaces = os.networkInterfaces();
const localIps = Object.values(interfaces)
  .flat()
  .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
  .map((iface) => iface!.address);

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "standalone",
  // Automatically allow all local IPs for development testing across devices
  allowedDevOrigins: ['localhost:3000', ...localIps],
};

export default nextConfig;
