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

//import { FaGoogle, FaGithub } from "react-icons/fa";

import { useAuth } from "../providers/auth";
import { getStoredUTMParams, useAnalyticsTracker } from "@repo/analytics";

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

  const { register, magicLink } = useAuth();
  const { trackEvent } = useAnalyticsTracker();

  const registerSchema = z.object({
    name: z.string().min(1),
    email: z.email(),
  });

  type FormData = z.infer<typeof registerSchema>;

  const form = useForm<z.infer<typeof registerSchema>>({
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

        await register({
          name: data.name,
          email: normalizedEmail,
        }).then(() => {
          // Track registration conversion with UTM attribution

          magicLink({
            email: normalizedEmail,
            callbackUrl: callbackUrl.current || "/dashboard",
            utmParams: utmParams, // Pass UTM params to magic link
          }).then(() => {
            trackEvent("Registration Completed");
            router.push("/magic-link-sent");
          });
        });
      } catch (error) {
        form.setError("email", {
          message: error as string,
        });
      }
    },
    [magicLink, register, router]
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
}
