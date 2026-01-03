"use client";

import { JSX, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";

import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

import {
  AdminDialog,
  AdminDialogContent,
} from "@repo/ui/components/ui/admin-dialog";

export const useConfirm = (
  title: string,
  message: string
): [() => JSX.Element, () => Promise<unknown>] => {
  const [promise, setPromise] = useState<{
    resolve: (_value: boolean) => void;
  } | null>(null);

  const confirm = () =>
    new Promise((resolve, _reject) => {
      setPromise({ resolve });
    });

  const handleClose = () => {
    setPromise(null);
  };

  const handleConfirm = () => {
    promise?.resolve(true);
    handleClose();
  };

  const handleCancel = () => {
    promise?.resolve(false);
    handleClose();
  };

  const ConfirmationDialog = () => (
    <AdminDialog open={promise !== null}>
      <AdminDialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button onClick={handleCancel} variant="outline" className="mb-2">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="destructive"
            className="mb-2"
          >
            Confirm
          </Button>
        </DialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );

  return [ConfirmationDialog, confirm];
};
