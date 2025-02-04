import { Field } from "payload";

export const userSubscription: Field = {
  name: "userSubscription",
  type: "join",
  collection: "subscriptions",
  on: "user",
};
