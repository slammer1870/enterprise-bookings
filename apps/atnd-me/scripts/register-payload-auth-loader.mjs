import { register } from "node:module";

// Register the custom resolver so Node can load `payload-auth`'s published ESM output
// (which contains extensionless and directory specifiers).
// Important: register relative to *this file*, not `process.cwd()`, because Next
// can change the working directory or spawn workers with a different cwd.
register("./payload-auth-loader.mjs", import.meta.url);

