import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Login actions receive passwords and PINs; never print their arguments.
  logging: { serverFunctions: false },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ] }];
  },
};
export default config;
