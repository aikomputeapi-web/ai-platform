import 'next-auth';
import { Plan } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      userId: string;
      email: string;
      name?: string | null;
      image?: string | null;
      planId?: string;
      plan?: Plan;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: Date | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
  }
}
