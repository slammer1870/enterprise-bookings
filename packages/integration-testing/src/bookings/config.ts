// storage-adapter-import-placeholder
import { postgresAdapter } from "@payloadcms/db-postgres";
import { payloadCloudPlugin } from "@payloadcms/payload-cloud";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { Config } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { bookingsPlugin } from "@repo/bookings-plugin";
import { bookingsPaymentsPlugin } from "@repo/bookings-payments";
import { paymentsPlugin } from "@repo/payments-plugin";
import { rolesPlugin } from "@repo/roles";
import { checkRole } from "../../../shared-utils/src/check-role";
import { isAdminOrOwner } from "@repo/bookings-plugin/src/access/bookings";
import { Booking, Lesson, User } from "@repo/shared-types";

import {
  bookingCreateMembershipDropinAccess,
  bookingUpdateMembershipDropinAccess,
} from "@repo/shared-services/src/access/booking-membership-dropin";

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
        {
          name: "roles",
          type: "select",
          hasMany: true,
          defaultValue: ["customer"],
          options: [
            { label: "Admin", value: "admin" },
            { label: "Customer", value: "customer" },
          ],
          required: true,
        },
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
    bookingsPlugin({
      enabled: true,
      bookingOverrides: {
        access: ({ defaultAccess }) => ({
          ...defaultAccess,
          create: bookingCreateMembershipDropinAccess,
          update: bookingUpdateMembershipDropinAccess,
        }),
      },
    }),
    paymentsPlugin({
      enabled: true,
      enableDropIns: true,
      acceptedPaymentMethods: ["cash", "card"],
      paymentMethodSlugs: ["class-options"],
    }),
    bookingsPaymentsPlugin({
      membership: {
        enabled: true,
        paymentMethodSlugs: ["class-options"],
      },
    }),
  ],
};
