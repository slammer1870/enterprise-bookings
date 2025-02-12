import { Field } from "payload";

export const name: Field = {
  name: "name",
  label: "Name",
  type: "text",
  required: true,
  defaultValue: "",
  access: {
    read: () => true,
  },
};
