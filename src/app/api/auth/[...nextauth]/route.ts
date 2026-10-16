import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { allowLogin } from "@/lib/auth-rate-limit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-post", type: "email" },
        password: { label: "Passord", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        if (credentials.email.length > 254 || credentials.password.length > 1024 || !allowLogin(credentials.email)) return null;

        const user = await db.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sessionVersion = user.sessionVersion ?? 0;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const user = token.sub ? await db.user.findUnique({
          where: { id: token.sub }, select: { sessionVersion: true },
        }) : null;
        if (!user || user.sessionVersion !== (token.sessionVersion ?? 0)) {
          session.authInvalidated = true;
          Reflect.deleteProperty(session, "user");
          return session;
        }
        session.user.id = token.sub!;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
