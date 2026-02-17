"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";

import RegisterForm from "./register-form";

import LoginForm from "./login-form";

import type { SignInWithGoogle } from "./google-sign-in-button";

interface RegisterLoginTabsProps {
  value: "login" | "register";
  /** Pass from Better Auth context (e.g. useBetterAuth().signInWithGoogle) to show Google sign-in */
  signInWithGoogle?: SignInWithGoogle | null;
}

export function RegisterLoginTabs({
  value,
  signInWithGoogle,
}: RegisterLoginTabsProps) {
  return (
    <Tabs defaultValue={value} className="w-full max-w-[400px] px-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="register" className="w-full">
          Register
        </TabsTrigger>
        <TabsTrigger value="login" className="w-full">
          Login
        </TabsTrigger>
      </TabsList>
      <TabsContent value="register">
        <RegisterForm signInWithGoogle={signInWithGoogle} />
      </TabsContent>
      <TabsContent value="login">
        <LoginForm signInWithGoogle={signInWithGoogle} />
      </TabsContent>
    </Tabs>
  );
}
