// Server-side exports only
export { authPlugin } from "./plugin";
export type { PluginTypes } from "./types";

// Export server-side utilities
export { generatePasswordSaltHash } from "./utils/password"; 