"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { User } from "@repo/shared-types";

// eslint-disable-next-line no-unused-vars
type ResetPassword = (args: {
  password: string;
  passwordConfirm: string;
  token: string;
}) => Promise<void>;

type ForgotPassword = (args: { email: string }) => Promise<void>; // eslint-disable-line no-unused-vars

type Create = (args: {
  name?: string;
  email: string;
  password: string;
  passwordConfirm: string;
}) => Promise<void>; // eslint-disable-line no-unused-vars

type Register = (args: { name: string; email: string }) => Promise<void>; // eslint-disable-line no-unused-vars

type Login = (args: { email: string; password: string }) => Promise<User>; // eslint-disable-line no-unused-vars

type Logout = () => Promise<void>;

type MagicLink = (args: {
  email: string;
  callbackUrl?: string;
}) => Promise<User>;

type AuthContext = {
  user?: User | null;
  setUser: (user: User | null) => void; // eslint-disable-line no-unused-vars
  logout: Logout;
  login: Login;
  create: Create;
  register: Register;
  magicLink: MagicLink;
  resetPassword: ResetPassword;
  forgotPassword: ForgotPassword;
  status: undefined | "loggedOut" | "loggedIn";
};

const Context = createContext({} as AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>();

  // used to track the single event of logging in or logging out
  // useful for `useEffect` hooks that should only run once
  const [status, setStatus] = useState<undefined | "loggedOut" | "loggedIn">();
  const create = useCallback<Create>(async (args) => {
    try {
      const res = await fetch(`/api/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: args.name,
          email: args.email,
          password: args.password,
          passwordConfirm: args.passwordConfirm,
        }),
      });

      if (res.ok) {
        const { data, errors } = await res.json();
        if (errors) throw new Error(errors[0].message);
        setUser(data?.loginUser?.user);
        setStatus("loggedIn");
      } else {
        const { errors } = await res.json();
        throw new Error(
          errors[0].message || "An error occurred while registering user."
        );
      }
    } catch (e) {
      throw new Error(
        (e as string) || "An error occurred while attempting to login."
      );
    }
  }, []);

  const register = useCallback<Register>(async (args) => {
    const res = await fetch(`/api/users/register`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        email: args.email,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.errors[0].message || "An error occurred while registering user."
      );
    }

    return data;
  }, []);

  const login = useCallback<Login>(async (args) => {
    try {
      const res = await fetch(`/api/users/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: args.email,
          password: args.password,
        }),
      });

      if (res.ok) {
        const { user, errors } = await res.json();
        if (errors) throw new Error(errors[0].message);
        setUser(user);
        setStatus("loggedIn");
        return user;
      }

      const { user, errors } = await res.json();

      throw new Error(errors[0].message || "Invalid login");
    } catch (e) {
      throw new Error(
        (e as string) || "An error occurred while attempting to login."
      );
    }
  }, []);

  const magicLink = useCallback<MagicLink>(async (args) => {
    const res = await fetch(`/api/users/send-magic-link`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.email,
        callbackUrl: args.callbackUrl || "/",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.errors[0].message ||
          "An error occurred while attempting to send magic link."
      );
    }

    return data;
  }, []);

  const logout = useCallback<Logout>(async () => {
    try {
      const res = await fetch(`/api/users/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        setUser(null);
        setStatus("loggedOut");
      } else {
        throw new Error("An error occurred while attempting to logout.");
      }
    } catch (e) {
      throw new Error("An error occurred while attempting to logout.");
    }
  }, []);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch(`/api/users/me`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const { user: meUser } = await res.json();
          setUser(meUser || null);
          setStatus(meUser ? "loggedIn" : undefined);
        } else {
          throw new Error("An error occurred while fetching your account.");
        }
      } catch (e) {
        setUser(null);
        throw new Error("An error occurred while fetching your account.");
      }
    };

    fetchMe();
  }, []);

  const forgotPassword = useCallback<ForgotPassword>(async (args) => {
    try {
      const res = await fetch("/api/users/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: args.email,
        }),
      });

      if (res.ok) {
        const { data, errors } = await res.json();
        if (errors) throw new Error(errors[0].message);
        setUser(data?.loginUser?.user);
      } else {
        throw new Error("Invalid login");
      }
    } catch (e) {
      throw new Error("An error occurred while attempting to login.");
    }
  }, []);

  const resetPassword = useCallback<ResetPassword>(async (args) => {
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: args.password,
          passwordConfirm: args.passwordConfirm,
          token: args.token,
        }),
      });

      if (res.ok) {
        const { data, errors } = await res.json();
        if (errors) throw new Error(errors[0].message);
        setUser(data?.loginUser?.user);
        setStatus(data?.loginUser?.user ? "loggedIn" : undefined);
      } else {
        throw new Error("Invalid login");
      }
    } catch (e) {
      throw new Error("An error occurred while attempting to login.");
    }
  }, []);

  return (
    <Context
      value={{
        user,
        setUser,
        login,
        logout,
        create,
        register,
        magicLink,
        resetPassword,
        forgotPassword,
        status,
      }}
    >
      {children}
    </Context>
  );
};

type UseAuth<T = User> = () => AuthContext; // eslint-disable-line no-unused-vars

export const useAuth: UseAuth = () => useContext(Context);
