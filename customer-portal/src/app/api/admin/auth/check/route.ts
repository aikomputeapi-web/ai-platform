import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const isAuthenticated = await hasValidAdminSession(req);
  
  return NextResponse.json({ 
    authenticated: isAuthenticated 
  });
}
