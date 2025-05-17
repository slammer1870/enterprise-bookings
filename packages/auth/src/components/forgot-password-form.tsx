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

export const ForgotPasswordForm = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForgotPasswordFormContent />
    </Suspense>
  );
};

function ForgotPasswordFormContent() {

  const router = useRouter();

  const { forgotPassword } = useAuth();

  const forgotPasswordSchema = z.object({
    email: z.string().email(),
  });

  type FormData = z.infer<typeof forgotPasswordSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        await forgotPassword({
          email: data.email,
        });
      } catch (error: any) {
        form.setError("root", {
          message:
            error.message || "An unexpected error occurred. Please try again.",
        });
      }
    },
    [forgotPassword, router, form]
  );

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email below to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        {form.formState.errors.root && (
          <div className="bg-red-50 p-3 rounded-md mb-4 text-red-600 text-sm">
            {form.formState.errors.root.message}
          </div>
        )}
        {form.formState.isSubmitSuccessful ? (
          <div className="flex items-center justify-center">
            <p>Check your email for a link to reset your password</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Your Email" {...field} />
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
                {form.formState.isSubmitting ? "Sending..." : "Submit"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
