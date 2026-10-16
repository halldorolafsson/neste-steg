import "next-auth";

declare module "next-auth" {
  interface Session {
    authInvalidated?: boolean;
    user: {
      id: string;
      email: string;
      name?: string | null;
    };
  }
  interface User {
    sessionVersion?: number;
  }
}
