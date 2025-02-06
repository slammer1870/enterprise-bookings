import { FieldHook } from "payload";

export const isSubscribed: FieldHook = async ({ req, data, context }) => {
  const { user, payload } = req;
  if (!user) return false;

  const subscribed = await payload.find({
    collection: "subscriptions",
    where: {
      user: {
        equals: user.id,
      },
      plan: {
        equals: data?.id,
      },
      end_date: {
        greater_than: new Date(),
      },
    },
  });

  return subscribed.docs.length > 0;
};
