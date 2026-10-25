import path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), "../../.env.local") });
export default {
  transpilePackages: [
    "@accessly/contracts",
    "@accessly/scanner",
    "@accessly/database",
    "@accessly/domain",
    "@accessly/ui",
  ],
  serverExternalPackages: ["postgres", "bullmq", "ioredis"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
