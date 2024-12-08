import { Field } from "payload";

export const image: Field = {
  name: "image", // required
  type: "upload", // required
  relationTo: "media", // required
  access: {
    read: () => true,
  },
};
