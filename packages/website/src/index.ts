// Export collections
export { Posts } from "./collections/posts";

// Export other utilities if needed in the future
export * from "./utils/generate-metadata";
export * from "./utils/generate-post-metadata";
export * from "./utils/sitemap";

// Export access controls
export * from "./access/authenticated";
export * from "./access/admin-or-published";

// Export blocks
export { FormBlock } from "./blocks/form/config";
export { Faqs } from "./blocks/faqs/config";

// Export hooks
export { revalidatePage, revalidateDelete } from "./hooks/revalidate-page"; 