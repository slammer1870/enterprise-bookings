import { checkRole } from "@repo/shared-utils";
import { Access } from "payload";
import { User } from "@repo/shared-types";

export const adminOrPublished: Access = ({ req }) => {
  // If there is a user logged in,
  // let them retrieve all documents
  if (checkRole(["admin"], req.user as User)) return true;

  // If there is no user,
  // restrict the documents that are returned
  // to only those where `_status` is equal to `published`
  // or where `_status` does not exist
  return {
    or: [
      {
        _status: {
          equals: "published",
        },
      },
      {
        _status: {
          exists: false,
        },
      },
    ],
  };
};
