import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import AppleProvider from 'next-auth/providers/apple';
import { Prisma } from '@prisma/client';
import prisma from './db';

// Check whether the email-dot auto-shadowban rule is active (defaults to off)
async function isEmailDotShadowbanEnabled(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>(
    Prisma.sql`SELECT value FROM admin_settings WHERE key = 'email_dot_shadowban' LIMIT 1`
  );
  const row = rows[0];
  if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) return false;
  return (row.value as Record<string, unknown>).enabled === true;
}

const baseAdapter = PrismaAdapter(prisma);
const customAdapter = {
  ...baseAdapter,
  createUser: async (data: any) => {
    try {
      const { image, emailVerified, ...rest } = data;
      const email = data.email || '';
      const parts = email.split('@');
      const username = parts[0] || '';
      const domain = parts[1] || '';
      const dotCount = (username.match(/\./g) || []).length;

      const isShadowLocked = false;
      let isShadowBanned = false;
      let adminNote: string | undefined = undefined;

      // Only apply auto-shadowban if the rule is enabled in admin settings (default: off)
      const dotRuleEnabled = await isEmailDotShadowbanEnabled();
      const isGmail = domain.toLowerCase() === 'gmail.com' || domain.toLowerCase() === 'googlemail.com';
      if (dotRuleEnabled && isGmail && dotCount >= 4) {
        isShadowBanned = true;
        adminNote = `Automatically shadow banned: Gmail account with ${dotCount} dots in email local part.`;
      }

      const res = await baseAdapter.createUser!({
        ...rest,
        emailVerified: true, // OAuth users are pre-verified
        isShadowLocked,
        isShadowBanned,
        adminNote,
      } as any);
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] createUser error:', e);
      throw e;
    }
  },
  updateUser: async (data: any) => {
    try {
      const { image, emailVerified, ...rest } = data;
      const updateData: any = { ...rest };
      if (emailVerified !== undefined) {
        updateData.emailVerified = emailVerified !== null;
      }
      const res = await baseAdapter.updateUser!(updateData);
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] updateUser error:', e);
      throw e;
    }
  },
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: customAdapter as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: false,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      try {
        if (!user.email) return false;

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // Block locked accounts
        if (dbUser?.isLocked) {
          return false;
        }

        // For OAuth sign-ins, mark email as verified if not already
        if (account?.provider !== 'credentials' && dbUser && !dbUser.emailVerified) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: true },
          });
        }

        return true;
      } catch (e) {
        console.error('[NextAuth Callback] signIn error:', e);
        return false;
      }
    },
    async session({ session, user }) {
      // With database strategy, `user` is the DB user object — no token lookups needed
      try {
        if (session.user && user) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { plan: true, apiKeys: true },
          });

          if (dbUser && !dbUser.isLocked) {
            session.user.id = dbUser.id;
            (session.user as any).userId = dbUser.id;
            (session.user as any).email = dbUser.email;
            (session.user as any).name = dbUser.name;
            (session.user as any).planId = dbUser.planId;
            (session.user as any).plan = dbUser.plan;
          }
        }
        return session;
      } catch (e) {
        console.error('[NextAuth Callback] session error:', e);
        return session;
      }
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser && account?.provider !== 'credentials') {
        console.log(`New OAuth user signed up: ${user.email} via ${account?.provider}`);
      }
    },
  },
  debug: false,
  logger: {
    error(code, metadata) {
      console.error('[NextAuth Error]', code, metadata);
    },
    warn(code) {
      console.warn('[NextAuth Warn]', code);
    },
  },
};
