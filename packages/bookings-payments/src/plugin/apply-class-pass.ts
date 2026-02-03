import { classPassTypesCollection } from "../class-pass/collections/class-pass-types";
import { classPassesCollection } from "../class-pass/collections/class-passes";
import { classPassProductsProxy } from "../class-pass/endpoints/class-pass-products";
import type { ClassPassConfig } from "../types";
import type { PluginContext } from "./context";
import { injectAllowedClassPassesIntoCollection } from "./inject-payment-methods";

/**
 * Applies the class-pass feature: class-pass-types, class-passes collections,
 * Stripe class-pass-products endpoint, and allowedClassPasses injection into class-options.
 * Does not add transactions (handled by main plugin when classPass or payments enabled).
 */
export function applyClassPassFeature(
  ctx: PluginContext,
  classPass: ClassPassConfig
): void {
  const classOptionsSlug = classPass.classOptionsSlug ?? "class-options";
  const classPassTypesAdminGroup = classPass.adminGroup ?? "Products";
  const classPassesAdminGroup = classPass.adminGroup ?? "Billing";

  ctx.endpoints.push({
    path: "/stripe/class-pass-products",
    method: "get",
    handler: classPassProductsProxy,
  });

  ctx.collections.push(
    classPassTypesCollection({
      adminGroup: classPassTypesAdminGroup,
      overrides: classPass.classPassTypesOverrides,
    })
  );
  ctx.collections.push(
    classPassesCollection({
      classOptionsSlug,
      adminGroup: classPassesAdminGroup,
      overrides: classPass.classPassesOverrides,
    })
  );
  const target = ctx.collections.find((c) => c.slug === classOptionsSlug);
  if (target) {
    injectAllowedClassPassesIntoCollection(target, classOptionsSlug);
  }
}
