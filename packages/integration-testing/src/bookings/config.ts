// storage-adapter-import-placeholder
import { postgresAdapter } from "@payloadcms/db-postgres";
import { payloadCloudPlugin } from "@payloadcms/payload-cloud";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { Config } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { bookingsPlugin } from "@repo/bookings-plugin";
import { membershipsPlugin } from "@repo/memberships";
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
        hooks: ({ defaultHooks }) => ({
          ...(defaultHooks.afterChange || []),
          afterChange: [
            async ({ req, doc, context }) => {
              if (context.triggerAfterChange === false) {
                return;
              }

              const lessonId =
                typeof doc.lesson === "object" ? doc.lesson.id : doc.lesson;

              Promise.resolve().then(async () => {
                const lessonQuery = await req.payload.findByID({
                  collection: "lessons",
                  id: lessonId,
                  depth: 2,
                });

                const lesson = lessonQuery as Lesson;

                if (
                  lesson?.bookings?.docs?.some(
                    (booking: Booking) => booking.status === "confirmed"
                  )
                ) {
                  await req.payload.update({
                    collection: "lessons",
                    id: lessonId,
                    data: {
                      lockOutTime: 0,
                    },
                  });
                } else {
                  await req.payload.update({
                    collection: "lessons",
                    id: lessonId,
                    data: { lockOutTime: lesson.originalLockOutTime },
                  });
                }
              });
              return doc;
            },
          ],
        }),
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
    membershipsPlugin({
      enabled: true,
      paymentMethodSlugs: ["class-options"],
    }),
  ],
};
