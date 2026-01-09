/**
 * Seed script to create an initial admin user
 * 
 * Usage:
 * 1. Set environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
 * 2. Run: npx ts-node scripts/seed-admin.ts
 * 
 * Or manually insert via Supabase SQL Editor:
 * INSERT INTO public.users (username, password_hash, fullname, role)
 * VALUES ('admin', '<bcrypt_hash_of_password>', 'Administrator', 'admin');
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const fullname = process.argv[4] || 'Administrator';

  console.log(`Creating admin user: ${username}`);

  // Hash password
  const password_hash = await bcrypt.hash(password, 12);

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      console.error(`Error: User with username "${username}" already exists`);
      process.exit(1);
    }

    // Create admin user
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash,
        fullname,
        role: 'admin',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating admin user:', error);
      process.exit(1);
    }

    console.log('Admin user created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('Please change the password after first login.');
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

seedAdmin();


