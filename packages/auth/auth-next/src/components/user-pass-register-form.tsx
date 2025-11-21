"use client";

import { useCallback } from "react";

import { useRouter } from "next/navigation";

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

import { z, ZodError } from "zod";

import { useForm } from "react-hook-form";

//import { zodResolver } from "@hookform/resolvers/zod";

//import { FaGoogle, FaGithub } from "react-icons/fa";

import { useAuth } from "../providers/auth";
import Link from "next/link";

export default function UserPassRegisterForm() {
  const router = useRouter();

  const { create } = useAuth();

  const registerSchema = z
    .object({
      name: z.string().min(1, "Name is required"),
      email: z.email("Invalid email address"),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters long"),
      passwordConfirm: z
        .string()
        .min(8, "Password confirmation must be at least 8 characters long"),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: "Passwords do not match",
      path: ["passwordConfirm"],
    });

  type FormData = z.infer<typeof registerSchema>;

  const customResolver = async (data: any) => {
    try {
      const validatedData = registerSchema.parse(data);
      return { values: validatedData, errors: {} };
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: any = {};
        error.issues.forEach((err: any) => {
          const fieldPath = err.path.join(".");
          fieldErrors[fieldPath] = {
            type: err.code,
            message: err.message,
          };
        });
        return { values: {}, errors: fieldErrors };
      }
      throw error;
    }
  };

  const form = useForm<FormData>({
    resolver: customResolver, // Use the custom resolver instead of zodResolver because zodResolver is not working as expected
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const normalizedEmail = data.email.toLowerCase();
        await create({
          name: data.name,
          email: normalizedEmail,
          password: data.password,
          passwordConfirm: data.passwordConfirm,
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
    [create, router]
  );

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>
          Enter your full name and email below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        {form.formState.errors.root && (
          <div className="bg-red-50 p-3 rounded-md mb-4 text-red-600 text-sm">
            {form.formState.errors.root.message}
          </div>
        )}
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
      <CardFooter className="flex items-center justify-end">
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <p>Already have an account?</p>
          <Link href="/login" className="text-black">
            Click here to login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
