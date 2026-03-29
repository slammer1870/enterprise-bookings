"use client";

import { useCallback, useRef, Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

import Link from "next/link";

export default function UserPassLoginForm() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const searchParams = useSearchParams();

  const callbackUrl = useRef(searchParams?.get("callbackUrl"));

  const router = useRouter();

  const { login } = useAuth();

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  type FormData = z.infer<typeof loginSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const normalizedEmail = data.email.toLowerCase();
        await login({
          email: normalizedEmail,
          password: data.password,
        }).then(() => {
          router.push(callbackUrl.current || "/dashboard");
        });
      } catch (error: any) {
        form.setError("root", {
          message:
            error.message || "An unexpected error occurred. Please try again.",
        });
      }
    },
    [login, router, form]
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
        {form.formState.errors.root && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-light text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
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
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
              variant="default"
            >
              {form.formState.isSubmitting ? "Sending..." : "Submit"}
            </Button>
          </form>
        </Form>
        <CardFooter className="flex items-center justify-end mt-2 pr-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <p>Don&apos;t have an account?</p>
            <Link href="/register" className="text-foreground hover:text-primary">
              Click here to register
            </Link>
          </div>
        </CardFooter>
      </CardContent>
    </Card>
  );
}
