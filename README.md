# Phalga Online Registration Admin

Admin dashboard for managing participant registrations for the Phalga Online Registration system.

## Features

- Basic username/password authentication (not email-based)
- User management with role-based access control (admin and reviewer roles)
- Registration approval/rejection workflow with remarks
- **Email notifications** to participants when registration status is updated (APPROVED/REJECTED)
- Real-time countdown timer showing time left for payment proof submission (24 hours)
- Auto-rejection of registrations past 24 hours with email notification
- View registration details and participant information
- Filter and search registrations by status, TRANSID, email, or contact person

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Supabase project URL and anon key

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the root directory (copy from `.env.local.example`):

```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your configuration:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret_for_sessions
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Setup

### 1. Create Users Table

Run the migration script in your Supabase SQL Editor:

```sql
-- File: supabase/migrations/001_create_users_table.sql
```

This creates the `users` table with proper indexes and Row Level Security policies.

### 2. Create Initial Admin User

You can create an initial admin user using the seed script:

```bash
npx ts-node scripts/seed-admin.ts <username> <password> <fullname>
```

Example:
```bash
npx ts-node scripts/seed-admin.ts admin admin123 "Administrator"
```

Or manually insert via Supabase SQL Editor (remember to hash the password with bcrypt first):

```sql
INSERT INTO public.users (username, password_hash, fullname, role)
VALUES ('admin', '<bcrypt_hash>', 'Administrator', 'admin');
```

**Note:** The password must be hashed using bcrypt with 12 salt rounds. You can use an online bcrypt generator or the seed script.

## Running the Application

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
npm run build
npm start
```

## User Roles

- **Admin**: Full access including user management
- **Reviewer**: Can view and approve/reject registrations (cannot manage users)

## Routes

- `/login` - Login page
- `/dashboard` - Main dashboard (registration list)
- `/dashboard/registrations/[regnum]` - Registration detail page
- `/dashboard/users` - User management (admin only)

## API Routes

- `POST /api/auth/login` - Login with username and password
- `POST /api/auth/logout` - Logout
- `GET /api/registrations` - Get all registrations (with optional filters)
- `POST /api/registrations` - Update registration status and remarks
- `GET /api/registrations/[regnum]` - Get single registration details
- `GET /api/users` - Get all users (admin only)
- `POST /api/users` - Create new user (admin only)
- `PUT /api/users/[user_id]` - Update user (admin only)
- `DELETE /api/users/[user_id]` - Delete user (admin only)

## Security

- Passwords are hashed using bcrypt with 12 salt rounds
- Sessions are stored in HTTP-only cookies
- JWT tokens for session management
- Role-based access control on all API routes
- Input validation on all forms
- SQL injection protection via Supabase parameterized queries

## Email Notifications

The application sends automatic email notifications to participants when:
- Registration is **APPROVED** by an admin/reviewer
- Registration is **REJECTED** by an admin/reviewer (includes rejection remarks)
- Registration is **automatically rejected** after 24 hours without payment proof

Emails are sent using [Resend](https://resend.com) and include:
- Professional HTML email template matching the registration portal design
- Transaction ID and registration details
- Status-specific messaging (approved/rejected)
- Link to view registration details

**Note:** Email sending is non-blocking - if email fails, the status update will still succeed. Check server logs for email delivery status.

## Notes

- Registration status values are in **uppercase**: `PENDING`, `APPROVED`, or `REJECTED`
- Remarks are required when rejecting a registration
- Usernames must be unique
- Passwords must be at least 8 characters long
- Admin users cannot delete their own account
- Participants have **24 hours** from registration to submit payment proof
- Registrations past 24 hours without approval are automatically rejected


