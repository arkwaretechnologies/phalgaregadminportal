import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { User } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Password comparison
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create JWT token
export async function createSession(user: User): Promise<string> {
  const token = await new SignJWT({
    user_id: user.user_id,
    username: user.username,
    fullname: user.fullname,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET_KEY);

  return token;
}

// Verify JWT token
export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return {
      user_id: payload.user_id as number,
      username: payload.username as string,
      fullname: payload.fullname as string,
      role: payload.role as 'admin' | 'reviewer',
      created_at: '',
      updated_at: '',
    };
  } catch (error) {
    return null;
  }
}

// Get session from cookie
export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

// Require authentication
export async function requireAuth(roles?: ('admin' | 'reviewer')[]): Promise<User> {
  const user = await getSession();

  if (!user) {
    throw new Error('Unauthorized');
  }

  if (roles && !roles.includes(user.role)) {
    throw new Error('Forbidden');
  }

  return user;
}

// Set auth cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}


