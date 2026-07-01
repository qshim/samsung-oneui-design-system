import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Fix Turbopack picking the wrong workspace root when multiple lockfiles exist.
    root: __dirname,
  },
};

export default nextConfig;
