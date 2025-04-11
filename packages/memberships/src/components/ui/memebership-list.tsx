import { Plan } from "@repo/shared-types";
import { MembershipDetail } from "./membership-detail";
export const MembershipList = ({ memberships }: { memberships: Plan[] }) => {
  return (
    <div className="flex flex-col gap-4">
      {memberships.map((membership) => (
        <MembershipDetail key={membership.id} membership={membership} />
      ))}
    </div>
  );
};
