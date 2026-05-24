import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import AppleProvider from 'next-auth/providers/apple';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './db';
import { verifyPassword } from './password';

const baseAdapter = PrismaAdapter(prisma);
const customAdapter = {
  ...baseAdapter,
  createUser: (data: any) => {
    const { image, emailVerified, ...rest } = data;
    const email = data.email || '';
    const parts = email.split('@');
    const username = parts[0] || '';
    const dotCount = (username.match(/\./g) || []).length;

    let isShadowLocked = false;
    let isShadowBanned = false;
    let adminNote: string | undefined = undefined;

    if (dotCount === 1) {
      isShadowLocked = true;
      adminNote = "Automatically shadow locked: exactly 1 dot in email local part.";
    } else if (dotCount > 1) {
      isShadowBanned = true;
      adminNote = "Automatically shadow banned: more than 1 dot in email local part.";
    }

    return baseAdapter.createUser!({
      ...rest,
      emailVerified: true, // OAuth users are pre-verified
      isShadowLocked,
      isShadowBanned,
      adminNote,
    } as any);
  },
  updateUser: (data: any) => {
    const { image, emailVerified, ...rest } = data;
    const updateData: any = { ...rest };
    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified !== null;
    }
    return baseAdapter.updateUser!(updateData);
  },
};

export const authOptions: NextAuthOptions = {
  adapter: customAdapter as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { plan: true },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        if (user.isLocked) {
          throw new Error('Account is locked');
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email first');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified ? new Date() : null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Check if account is locked
      if (user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        
        if (dbUser?.isLocked) {
          return false; // Prevent sign in for locked accounts
        }

        // For OAuth users, ensure email is verified
        if (account?.provider !== 'credentials' && dbUser && !dbUser.emailVerified) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: true },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        token.userId = user.id;
        token.email = user.email;
      }
      
      // Refresh user data on update
      if (trigger === 'update' && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
        });
        if (dbUser) {
          token.userId = dbUser.id;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token?.userId && session.user) {
        // Fetch full user data
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: { plan: true, apiKeys: true },
        });

        if (user && !user.isLocked) {
          session.user.id = user.id;
          (session.user as any).userId = user.id;
          (session.user as any).email = user.email;
          (session.user as any).name = user.name;
          (session.user as any).planId = user.planId;
          (session.user as any).plan = user.plan;
        }
      }
      return session;
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
