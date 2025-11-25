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
import { useAnalyticsTracker } from "@repo/analytics";
import { useTRPC } from "@repo/trpc";
import { useMutation } from "@tanstack/react-query";

export default function LoginForm() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const callbackUrl = useRef(searchParams?.get("callbackUrl") || "/dashboard");
  const router = useRouter();
  const { trackEvent } = useAnalyticsTracker();
  const trpc = useTRPC();
  const { mutateAsync: signInMagicLink, isPending } = useMutation(
    trpc.auth.signInMagicLink.mutationOptions()
  );

  const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
  });

  type FormData = z.infer<typeof loginSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const normalizedEmail = data.email.toLowerCase();

        // Request magic-link via tRPC so better-auth handles delivery server-side
        await signInMagicLink({
          email: normalizedEmail,
          callbackURL: callbackUrl.current,
        });

        trackEvent("Login Completed");
        router.push("/magic-link-sent");
      } catch (error: any) {
        const errorMessage = error?.message || "An error occurred during login";
        form.setError("email", {
          message: errorMessage,
        });
      }
    },
    [signInMagicLink, router, trackEvent]
  );

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Log in to your account</CardTitle>
        <CardDescription>
          Enter your email below to log in to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              disabled={form.formState.isSubmitting || isPending}
              className="w-full bg-black text-white hover:bg-gray-800"
              variant="default"
            >
              {form.formState.isSubmitting || isPending
                ? "Sending..."
                : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
