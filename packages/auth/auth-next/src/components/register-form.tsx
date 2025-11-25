"use client";

import { useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { getStoredUTMParams, useAnalyticsTracker } from "@repo/analytics";
import { useTRPC } from "@repo/trpc";
import { useMutation } from "@tanstack/react-query";

export default function RegisterForm() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterFormContent />
    </Suspense>
  );
}

function RegisterFormContent() {
  const searchParams = useSearchParams();
  const callbackUrl = useRef(searchParams?.get("callbackUrl") || "/dashboard");
  const router = useRouter();
  const trpc = useTRPC();
  const { trackEvent } = useAnalyticsTracker();

  const { mutateAsync: registerMutation, isPending } = useMutation(
    trpc.auth.registerPasswordless.mutationOptions()
  );
  const { mutateAsync: sendMagicLinkMutation } = useMutation(
    trpc.auth.signInMagicLink.mutationOptions()
  );

  const registerSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
  });

  type FormData = z.infer<typeof registerSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const normalizedEmail = data.email.toLowerCase();

        // Get UTM parameters for tracking and magic link
        const utmParams = getStoredUTMParams();

        // Register user via tRPC
        await registerMutation({
          name: data.name,
          email: normalizedEmail,
        });

        // Send magic link via tRPC (Better Auth under the hood)
        await sendMagicLinkMutation({
          email: normalizedEmail,
          callbackURL: callbackUrl.current,
        });

        trackEvent("Registration Completed");
        router.push("/magic-link-sent");
      } catch (error: any) {
        const errorMessage = error?.message || "An error occurred during login";
        form.setError("email", {
          message: errorMessage,
        });
      }
    },
    [registerMutation, sendMagicLinkMutation, router, trackEvent]
  );

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>
          Enter your full name and email below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                ? "Submitting..."
                : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
