import { coursesCollection } from "../course/collections/courses";
import { courseEnrollmentsCollection } from "../course/collections/course-enrollments";
import type { CoursesConfig } from "../types";
import type { PluginContext } from "./context";
import { injectAllowedCoursesIntoCollection } from "./inject-payment-methods";

/**
 * Applies the courses feature: courses + course-enrollments collections
 * and allowedCourses injection into event-types.
 */
export function applyCoursesFeature(
  ctx: PluginContext,
  courses: CoursesConfig,
): void {
  const eventTypesSlug = courses.eventTypesSlug ?? "event-types";
  const coursesAdminGroup = courses.adminGroup ?? "Products";
  const enrollmentsAdminGroup = courses.adminGroup ?? "Billing";

  ctx.collections.push(
    coursesCollection({
      eventTypesSlug,
      adminGroup: coursesAdminGroup,
      overrides: courses.coursesOverrides,
    }),
  );
  ctx.collections.push(
    courseEnrollmentsCollection({
      adminGroup: enrollmentsAdminGroup,
      overrides: courses.courseEnrollmentsOverrides,
    }),
  );

  const target = ctx.collections.find((c) => c.slug === eventTypesSlug);
  if (target) {
    injectAllowedCoursesIntoCollection(target, eventTypesSlug);
  }
}
