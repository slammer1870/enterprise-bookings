type AnyAsyncFn = (...args: any[]) => Promise<any> | any;

export type BetterAuth<GetPayload extends AnyAsyncFn> = Awaited<
  ReturnType<GetPayload>
>['betterAuth'];

export type BetterAuthSession<GetPayload extends AnyAsyncFn> = BetterAuth<
  GetPayload
>['$Infer']['Session'];

export type BetterAuthUser<GetPayload extends AnyAsyncFn> = BetterAuthSession<GetPayload>['user'];

export type BetterAuthAccount<GetPayload extends AnyAsyncFn> = Awaited<
  ReturnType<BetterAuth<GetPayload>['api']['listUserAccounts']>
>[number];

export type BetterAuthDeviceSession<GetPayload extends AnyAsyncFn> = Awaited<
  ReturnType<BetterAuth<GetPayload>['api']['listSessions']>
>[number];

export type BetterAuthApi<GetPayload extends AnyAsyncFn> = BetterAuth<
  GetPayload
>['api'];

export type BetterAuthMagicLinkHandler<GetPayload extends AnyAsyncFn> =
  BetterAuthApi<GetPayload> extends { signInMagicLink: infer Fn }
    ? Fn
    : (...args: any[]) => Promise<unknown>;

