/**
 * Resolved collection slugs for the bookings plugin.
 * Defaults preserve legacy names so other apps in the monorepo stay unchanged.
 */
export type BookingsPluginSlugs = {
  lessons: string;
  classOptions: string;
  instructors: string;
  bookings: string;
};

export const DEFAULT_BOOKINGS_PLUGIN_SLUGS: BookingsPluginSlugs = {
  lessons: "lessons",
  classOptions: "class-options",
  instructors: "instructors",
  bookings: "bookings",
};

export function resolveBookingsPluginSlugs(config: {
  slugs?: Partial<BookingsPluginSlugs>;
}): BookingsPluginSlugs {
  return {
    lessons: config.slugs?.lessons ?? DEFAULT_BOOKINGS_PLUGIN_SLUGS.lessons,
    classOptions:
      config.slugs?.classOptions ?? DEFAULT_BOOKINGS_PLUGIN_SLUGS.classOptions,
    instructors:
      config.slugs?.instructors ?? DEFAULT_BOOKINGS_PLUGIN_SLUGS.instructors,
    bookings: config.slugs?.bookings ?? DEFAULT_BOOKINGS_PLUGIN_SLUGS.bookings,
  };
}
