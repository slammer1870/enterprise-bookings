import { AccessArgs, CollectionSlug } from "payload";

import { Access } from "payload";

import { BookingsPluginConfig } from "../types";

import { Booking, Lesson, User, Subscription, Plan } from "@repo/shared-types";

import { hasReachedSubscriptionLimit } from "@repo/shared-services";

import { checkRole } from "@repo/shared-utils";

export const renderCreateAccess = (
  pluginOptions: BookingsPluginConfig
): Access => {
  return async ({ req, data }: AccessArgs<Booking>) => {
    const user = req.user as User | null;

    if (!data?.lesson) return false;

    const lessonId =
      typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

    try {
      const lesson = (await req.payload.findByID({
        collection: "lessons",
        id: lessonId,
        depth: 3,
      })) as unknown as Lesson;

      if (!lesson) return false;

      if (!user) return false;

      if (checkRole(["admin"], user)) return true;

      if (
        lesson.bookingStatus === "closed" ||
        lesson.bookingStatus === "waitlist" ||
        lesson.bookingStatus === "booked"
      ) {
        return false;
      }

      if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
        return false;
      }

      if (pluginOptions.paymentMethods?.plans) {
        // Check if the lesson has an allowed plan payment method
        if (lesson.classOption.paymentMethods?.allowedPlans) {
          //TODO: Check if the user has a subscription plan that is allowed for this lesson

          //Import check if the user has a subscription plan that is allowed for this lesson from shared-services

          //TODO: Import check if the user has a subscription plan that is allowed for this lesson from shared-services

          try {
            const userSubscription = await req.payload.find({
              collection: "subscriptions" as CollectionSlug,
              where: {
                user: { equals: user.id },
                status: { equals: "active" },
                endDate: { greater_than: new Date() },
              },
              depth: 2,
              limit: 1,
            });

            if (userSubscription.docs.length === 0) return false;

            const subscription = userSubscription.docs[0] as Subscription & {
              plan: Plan;
            };

            if (
              !lesson.classOption.paymentMethods.allowedPlans.some(
                (plan) => plan.id == subscription.plan.id
              )
            ) {
              return false;
            }

            if (
              (subscription.endDate &&
                new Date(subscription.endDate) <= new Date()) ||
              (subscription.endDate &&
                new Date(subscription.endDate) <= new Date(lesson.startTime))
            ) {
              return false;
            }

            const reachedLimit = await hasReachedSubscriptionLimit(
              subscription,
              req.payload,
              new Date(lesson.startTime)
            );
            if (reachedLimit) return false;

            return true;
          } catch (error) {
            console.error("Error checking subscription:", error);
            return false;
          }
        }

        if (pluginOptions.paymentMethods?.dropIns) {
          // Check if the lesson has an allowed drop in payment method
          if (lesson.classOption.paymentMethods?.allowedDropIns) {
            //TODO: Check if the user has a drop in payment method that is allowed for this lesson
            return false;
          }
        }
      }

      if (pluginOptions.paymentMethods?.dropIns) {
        // Check if the lesson has an allowed drop in payment method
        if (lesson.classOption.paymentMethods?.allowedDropIns) {
          //TODO: Check if the user has a drop in payment method that is allowed for this lesson
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
};

export const renderUpdateAccess = (
  pluginOptions: BookingsPluginConfig
): Access => {
  return async ({ req, id }: AccessArgs<Booking>) => {
    const searchParams = req.searchParams;

    const lessonId = searchParams.get("where[and][0][lesson][equals]") || id;

    const userId =
      searchParams.get("where[and][1][user][equals]") || req.user?.id;

    if (!lessonId) return false;

    let booking: Booking | undefined;

    try {
      if (id) {
        booking = (await req.payload.findByID({
          collection: "bookings",
          id,
          depth: 3,
        })) as unknown as Booking;
      } else {
        const bookingQuery = await req.payload.find({
          collection: "bookings",
          where: {
            lesson: { equals: lessonId },
            user: { equals: userId },
          },
          depth: 3,
        });

        booking = bookingQuery.docs[0] as Booking | undefined;
      }

      if (!booking) return false;

      const lesson = (await req.payload.findByID({
        collection: "lessons",
        id: booking.lesson.id,
        depth: 3,
      })) as unknown as Lesson;

      const user = (await req.payload.findByID({
        collection: "users",
        id: userId || booking.user.id,
        depth: 3,
      })) as unknown as User;

      if (!lesson || !user) return false;

      if (checkRole(["admin"], user)) return true;

      if (req.user?.id !== user.id) return false;

      if (req.data?.status === "cancelled") return true;

      if (
        lesson.bookingStatus == "closed" ||
        lesson.bookingStatus == "waitlist"
      ) {
        return false;
      }

      if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
        return false;
      }

      if (pluginOptions.paymentMethods?.plans) {
        // Check if the lesson has an allowed plan payment method
        if (lesson.classOption.paymentMethods?.allowedPlans) {
          //TODO: Check if the user has a subscription plan that is allowed for this lesson

          //Import check if the user has a subscription plan that is allowed for this lesson from shared-services

          //TODO: Import check if the user has a subscription plan that is allowed for this lesson from shared-services

          try {
            const userSubscription = (await req.payload.find({
              collection: "subscriptions" as CollectionSlug,
              where: {
                user: { equals: user.id },
                status: { equals: "active" },
                endDate: { greater_than: new Date() },
              },
              depth: 2,
              limit: 1,
            })) as unknown as { docs: Subscription[] };

            if (userSubscription.docs.length === 0) return false;

            const subscription = userSubscription.docs[0] as Subscription & {
              plan: Plan;
            };

            if (
              !lesson.classOption.paymentMethods.allowedPlans.some(
                (plan) => plan.id == subscription.plan.id
              )
            ) {
              return false;
            }

            if (
              (subscription.endDate &&
                new Date(subscription.endDate) <= new Date()) ||
              (subscription.endDate &&
                new Date(subscription.endDate) <= new Date(lesson.startTime))
            ) {
              return false;
            }

            console.log("PASSING DATE CHECK");

            const reachedLimit = await hasReachedSubscriptionLimit(
              subscription,
              req.payload,
              new Date(lesson.startTime)
            );
            if (reachedLimit) return false;

            return true;
          } catch (error) {
            console.error("Error checking subscription:", error);
            return false;
          }
        }

        if (pluginOptions.paymentMethods?.dropIns) {
          // Check if the lesson has an allowed drop in payment method
          if (lesson.classOption.paymentMethods?.allowedDropIns) {
            //TODO: Check if the user has a drop in payment method that is allowed for this lesson
            return false;
          }
        }
      }

      if (pluginOptions.paymentMethods?.dropIns) {
        // Check if the lesson has an allowed drop in payment method
        if (lesson.classOption.paymentMethods?.allowedDropIns) {
          //TODO: Check if the user has a drop in payment method that is allowed for this lesson
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
};
