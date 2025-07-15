// Server-side exports only
export { magicLinkPlugin } from "./plugin/magic-link";
export type { PluginTypes } from "./types";

// Export server-side utilities
export { generatePasswordSaltHash } from "./utils/password"; 