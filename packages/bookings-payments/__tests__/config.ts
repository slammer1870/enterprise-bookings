import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import type { Config } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { bookingsPaymentsPlugin } from "../src/plugin";
import { bookingsPlugin } from "@repo/bookings-plugin";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export const config: Config = {
  admin: {
    user: "users",
    importMap: { baseDir: path.resolve(dirname, "..") },
  },
  serverURL: "http://localhost:3000",
  collections: [
    {
      slug: "users",
      admin: { useAsTitle: "email" },
      auth: true,
      access: { create: () => true },
      fields: [],
    },
    {
      slug: "media",
      access: { read: () => true },
      fields: [{ name: "alt", type: "text", required: true }],
      upload: true,
    },
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "test-secret",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || "postgres://postgres:postgres@localhost:5432/payload" },
  }),
  sharp: sharp as unknown as import("payload").SharpDependency,
  plugins: [
    bookingsPlugin({ enabled: true }),
    bookingsPaymentsPlugin({ classPass: { enabled: true } }),
  ],
};
