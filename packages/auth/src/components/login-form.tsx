"use client";

import { useCallback, useRef } from "react";

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

//import { FaGoogle, FaGithub } from "react-icons/fa";

import { useAuth } from "../providers/auth";

export default function LoginForm() {
  const searchParams = useSearchParams();

  const callbackUrl = useRef(searchParams.get("callbackUrl"));

  const router = useRouter();

  const { magicLink } = useAuth();

  const loginSchema = z.object({
    email: z.string().email(),
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
        await magicLink({
          email: data.email,
          callbackUrl: callbackUrl.current || "/",
        }).then(() => {
          router.push("/magic-link-sent");
        });
      } catch (error) {
        form.setError("email", {
          message: error as string,
        });
      }
    },
    [magicLink, router]
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
                    <Input placeholder="Your email" {...field} />
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
      </CardContent>
    </Card>
  );
}
