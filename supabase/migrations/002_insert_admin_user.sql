-- Insert initial admin user
-- Username: arkware
-- Password: hackmenot (hashed with bcrypt, 12 rounds)
-- Fullname: Arkware Technologies
-- Role: admin

INSERT INTO public.users (username, password_hash, fullname, role)
VALUES (
  'arkware',
  '$2a$12$9/KoGXCdXmeU/bPW1pCrE.MMdrq01s9fL4wKhbNUkE8ESX4SqfwJO',
  'Arkware Technologies',
  'admin'
)
ON CONFLICT (username) DO NOTHING;

