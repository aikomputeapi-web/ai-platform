import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import AppleProvider from 'next-auth/providers/apple';
import prisma from './db';

const baseAdapter = PrismaAdapter(prisma);
const customAdapter = {
  ...baseAdapter,
  getUser: async (id: string) => {
    console.log('[NextAuth Adapter] getUser called with:', id);
    try {
      const res = await baseAdapter.getUser!(id);
      console.log('[NextAuth Adapter] getUser returned:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] getUser error:', e);
      throw e;
    }
  },
  getUserByEmail: async (email: string) => {
    console.log('[NextAuth Adapter] getUserByEmail called with:', email);
    try {
      const res = await baseAdapter.getUserByEmail!(email);
      console.log('[NextAuth Adapter] getUserByEmail returned:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] getUserByEmail error:', e);
      throw e;
    }
  },
  getUserByAccount: async (provider_providerAccountId: any) => {
    console.log('[NextAuth Adapter] getUserByAccount called with:', JSON.stringify(provider_providerAccountId));
    try {
      const res = await baseAdapter.getUserByAccount!(provider_providerAccountId);
      console.log('[NextAuth Adapter] getUserByAccount returned:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] getUserByAccount error:', e);
      throw e;
    }
  },
  createUser: async (data: any) => {
    console.log('[NextAuth Adapter] createUser called with:', JSON.stringify(data));
    try {
      const { image, emailVerified, ...rest } = data;
      const email = data.email || '';
      const parts = email.split('@');
      const username = parts[0] || '';
      const domain = parts[1] || '';
      const dotCount = (username.match(/\./g) || []).length;

      let isShadowLocked = false;
      let isShadowBanned = false;
      let adminNote: string | undefined = undefined;

      const isGmail = domain.toLowerCase() === 'gmail.com' || domain.toLowerCase() === 'googlemail.com';
      if (isGmail && dotCount >= 4) {
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
      console.log('[NextAuth Adapter] createUser returned:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] createUser error:', e);
      throw e;
    }
  },
  updateUser: async (data: any) => {
    console.log('[NextAuth Adapter] updateUser called with:', JSON.stringify(data));
    try {
      const { image, emailVerified, ...rest } = data;
      const updateData: any = { ...rest };
      if (emailVerified !== undefined) {
        updateData.emailVerified = emailVerified !== null;
      }
      const res = await baseAdapter.updateUser!(updateData);
      console.log('[NextAuth Adapter] updateUser returned:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] updateUser error:', e);
      throw e;
    }
  },
  linkAccount: async (account: any) => {
    console.log('[NextAuth Adapter] linkAccount called with:', JSON.stringify(account));
    try {
      const res = await baseAdapter.linkAccount!(account);
      console.log('[NextAuth Adapter] linkAccount returned:', JSON.stringify(res));
      return res;
    } catch (e) {
      console.error('[NextAuth Adapter] linkAccount error:', e);
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
  debug: true, // Enable debug for troubleshooting
  logger: {
    error(code, metadata) {
      console.error('[NextAuth Error]', code, metadata);
    },
    warn(code) {
      console.warn('[NextAuth Warn]', code);
    },
    debug(code, metadata) {
      console.log('[NextAuth Debug]', code, metadata);
    },
  },
};
