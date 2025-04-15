// storage-adapter-import-placeholder
import { postgresAdapter } from "@payloadcms/db-postgres";
import { payloadCloudPlugin } from "@payloadcms/payload-cloud";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { Config } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { bookingsPlugin } from "@repo/bookings";
import { membershipsPlugin } from "@repo/memberships";
import { paymentsPlugin } from "@repo/payments";
import { rolesPlugin } from "@repo/roles";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export const config: Config = {
  admin: {
    user: "users",
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  serverURL: "http://localhost:3000",
  collections: [
    {
      slug: "users",
      admin: {
        useAsTitle: "email",
      },
      auth: true,
      fields: [
        // Email added by default
        // Add more fields as needed
      ],
    },
    {
      slug: "media",
      access: {
        read: () => true,
      },
      fields: [
        {
          name: "alt",
          type: "text",
          required: true,
        },
      ],
      upload: true,
    },
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "sectre",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    rolesPlugin({
      enabled: true,
    }),
    paymentsPlugin({
      enabled: true,
      enableDropIns: true,
      acceptedPaymentMethods: ["cash", "card"],
    }),
    membershipsPlugin({
      enabled: true,
    }),
    bookingsPlugin({
      enabled: true,
      paymentMethods: {
        dropIns: true,
        plans: true,
        classPasses: false,
      },
    }),
  ],
};
