import { AccessArgs } from "payload";

import { Access } from "payload";
import { Booking, Lesson, User } from "../types";

import { hasReachedSubscriptionLimit } from "@repo/shared-services";

export const isAdminOrMember: Access = async ({
  req,
  data,
}: AccessArgs<Booking>) => {
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

    if (user.roles?.includes("admin")) return true;

    if (lesson.bookingStatus !== "active") {
      return false;
    }

    if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
      return false;
    }

    // Check if the lesson has an allowed plan payment method
    if (lesson.classOption.paymentMethods?.allowedPlans) {
      //TODO: Check if the user has a subscription plan that is allowed for this lesson

      //Import check if the user has a subscription plan that is allowed for this lesson from shared-services

      //TODO: Import check if the user has a subscription plan that is allowed for this lesson from shared-services

      try {
        const userSubscription = await req.payload.find({
          collection: "subscriptions",
          where: {
            user: { equals: user.id },
            status: { equals: "active" },
            endDate: { greater_than: new Date() },
          },
          limit: 1,
        });

        if (userSubscription.docs.length === 0) return false;

        const subscription = userSubscription.docs[0];
        const reachedLimit = await hasReachedSubscriptionLimit(
          subscription,
          req.payload
        );
        if (reachedLimit) return false;

        return true;
      } catch (error) {
        console.error("Error checking subscription:", error);
        return false;
      }
    }

    // Check if the lesson has an allowed drop in payment method
    if (
      lesson.classOption.paymentMethods?.allowedDropIns?.length &&
      lesson.classOption.paymentMethods?.allowedDropIns?.length > 0
    ) {
      //TODO: Check if the user has a drop in payment method that is allowed for this lesson
      return false;
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};
