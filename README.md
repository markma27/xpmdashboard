# XPM Dashboard

Multi-tenant SaaS analytics platform for Xero Practice Manager.

## Features

- ✅ User authentication (Supabase Auth)
- ✅ Multi-tenant architecture (organization isolation)
- ✅ Row Level Security (RLS)
- ✅ Role-based access control (admin, member, viewer)
- ✅ Organization management
- ✅ Protected routes
- ✅ Modern UI (shadcn/ui + Tailwind CSS)

## Tech Stack

- **Frontend Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **State Management**: React Context / Server Components

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### 1. Clone the repository

```bash
git clone <repository-url>
cd xpmdashboard
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Set up Supabase

1. Create a new project in [Supabase](https://supabase.com)
2. Get your project URL and API keys:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon/Public Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)

### 4. Run database migrations

In Supabase Dashboard:

1. Go to **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste into SQL Editor and execute

Or use Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 5. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: `SUPABASE_SERVICE_ROLE_KEY` should ONLY be used server-side. Never expose it in client-side code.

### 6. Start the development server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
xpmdashboard/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Dashboard
│   │   ├── reports/           # Report pages
│   │   ├── settings/          # Settings pages
│   │   └── onboarding/        # Onboarding pages
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   ├── org-selector.tsx  # Organization selector
│   │   ├── sidebar.tsx        # Sidebar navigation
│   │   └── user-menu.tsx     # User menu
│   ├── lib/                   # Utility functions
│   │   ├── supabase/         # Supabase clients
│   │   ├── auth.ts           # Authentication helpers
│   │   └── rbac.ts           # Role-based access control
│   └── middleware.ts         # Next.js middleware
├── supabase/
│   └── migrations/           # Database migration files
└── public/                    # Static assets
```

## Database Schema

### Core Tables

- `organizations` - Organizations (tenants)
- `organization_members` - Organization member relationships

### Row Level Security (RLS)

All tables have RLS enabled, ensuring:
- Users can only access data from their own organizations
- Only admins can modify organization settings
- Member management permissions are controlled by roles

## Route Structure

### Public Routes

- `/` - Home page (redirects to `/dashboard` if logged in)
- `/auth/login` - Login page
- `/auth/signup` - Sign up page

### Protected Routes

- `/dashboard` - Dashboard
- `/reports/*` - Report pages
  - `/reports/revenue` - Revenue report
  - `/reports/billable` - Billable report
  - `/reports/workinprogress` - Work in progress report
  - `/reports/productivity` - Productivity analytics
- `/settings/*` - Settings pages (admin access required)
  - `/settings/organisation` - Organization settings
  - `/settings/members` - Member management
  - `/settings/xero` - Xero connection
  - `/settings/sync` - Sync settings
- `/profile` - User profile
- `/onboarding/create-org` - Create organization (first-time use)

## User Roles

- **admin** - Administrator: Can manage organization settings, members, Xero connections, etc.
- **member** - Member: Can view reports and data
- **viewer** - Viewer: Read-only access

## Development Guide

### Adding a New Page

1. Create a new route directory under `src/app/`
2. Use `requireOrg()` to ensure user has selected an organization
3. Use `isAdmin()` / `isMember()` to check permissions
4. Wrap page content with `AppLayout` component

### Adding a New API Route

1. Create a new route file under `src/app/api/`
2. Use `requireAuth()` to ensure user is authenticated
3. Use Supabase client for database operations
4. RLS will automatically handle data isolation

## Next Steps

- [ ] Xero OAuth 2.0 connection
- [ ] XPM data synchronization
- [ ] Reports and charts implementation
- [ ] Member invitation functionality
- [ ] Organization settings editing

## License

MIT

## Support

If you have any questions, please submit an Issue or contact the development team.
