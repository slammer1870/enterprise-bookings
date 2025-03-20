// AdminDialog.tsx
import { DialogProps } from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@repo/ui/components/ui/dialog";
import React from "react";

export const AdminDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, style, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={className}
    style={{
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 9999, // Higher z-index to ensure it's above PayloadCMS elements
      ...style,
    }}
    {...props}
  />
));

AdminDialogContent.displayName = "AdminDialogContent";

// Export a wrapper component that uses the original Dialog but with the custom content
export const AdminDialog = ({ children, ...props }: DialogProps) => (
  <Dialog {...props}>{children}</Dialog>
);
