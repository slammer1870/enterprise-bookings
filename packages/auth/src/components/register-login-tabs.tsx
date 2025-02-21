import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";

import RegisterForm from "./register-form";

import LoginForm from "./login-form";

interface RegisterLoginTabsProps {
  value: "login" | "register";
}

export function RegisterLoginTabs({ value }: RegisterLoginTabsProps) {
  return (
    <Tabs defaultValue={value} className="w-[400px] px-4">
      <TabsList className="w-full">
        <TabsTrigger value="register" className="w-full">
          Register
        </TabsTrigger>
        <TabsTrigger value="login" className="w-full">
          Login
        </TabsTrigger>
      </TabsList>
      <TabsContent value="register">
        <RegisterForm />
      </TabsContent>
      <TabsContent value="login">
        <LoginForm />
      </TabsContent>
    </Tabs>
  );
}
