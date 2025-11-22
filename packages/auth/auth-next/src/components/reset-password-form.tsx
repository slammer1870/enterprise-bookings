"use client";

import { useCallback, useRef, Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";

import { Button } from "@repo/ui/components/ui/button";

import { Input } from "@repo/ui/components/ui/input";

import { z } from "zod";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../providers/auth";

export const ResetPasswordForm = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordFormContent />
    </Suspense>
  );
};

function ResetPasswordFormContent() {
  const router = useRouter();

  const { resetPassword } = useAuth();

  const searchParams = useSearchParams();

  const token = useRef(searchParams?.get("token"));

  if (!token.current) {
    router.push("/login");
  }

  const resetPasswordSchema = z
    .object({
      password: z.string().min(8),
      passwordConfirm: z.string().min(8),
      token: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: "Passwords do not match",
      path: ["passwordConfirm"],
    });

  type FormData = z.infer<typeof resetPasswordSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirm: "",
      token: token.current || "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        await resetPassword({
          password: data.password,
          passwordConfirm: data.passwordConfirm,
          token: token.current || "",
        }).then(() => {
          router.push("/dashboard");
        });
      } catch (error: any) {
        form.setError("root", {
          message:
            error.message || "An unexpected error occurred. Please try again.",
        });
      }
    },
    [resetPassword, router]
  );

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your new password below to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        {form.formState.errors.root && (
          <div className="bg-red-50 p-3 rounded-md mb-4 text-red-600 text-sm">
            {form.formState.errors.root.message}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Your Password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm Password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full bg-black text-white hover:bg-gray-800"
              variant="default"
            >
              {form.formState.isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
