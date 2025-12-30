# XPM Dashboard

Multi-tenant SaaS analytics platform for Xero Practice Manager (XPM) data. Provides comprehensive reporting and analytics dashboards for accounting firms, supporting both automated XPM API synchronization and manual CSV data uploads.

## Features

### Core Features
- ✅ **User Authentication** - Supabase Auth with email/password
- ✅ **Multi-tenant Architecture** - Organization-based data isolation
- ✅ **Row Level Security (RLS)** - Automatic data access control
- ✅ **Role-based Access Control** - Admin, Member, and Viewer roles
- ✅ **Organization Management** - Create and manage organizations
- ✅ **Protected Routes** - Secure page access with middleware
- ✅ **Modern UI** - Built with shadcn/ui and Tailwind CSS

### Data Management
- ✅ **Xero OAuth Integration** - Connect Xero Practice Manager accounts
- ✅ **Manual Data Uploads** - CSV upload for timesheets, invoices, WIP, and recoverability data
- ✅ **Upload History** - Track last upload dates for each data type
- ✅ **Data Synchronization** - Manual XPM data sync (automated sync in development)

### Reports & Analytics
- ✅ **Dashboard Overview** - KPI cards and summary charts
- ✅ **Revenue Report** - Monthly revenue by client groups, partners, and managers
- ✅ **Billable Report** - Billable hours and amounts with advanced filtering
- ✅ **Work In Progress (WIP)** - WIP analysis with aging reports
- ✅ **Productivity Analytics** - Staff productivity metrics and capacity analysis
- ✅ **Recoverability Report** - Recoverability tracking and analysis
- ✅ **Staff Performance** - Staff performance tracking and target billable rates

### Data Export
- ✅ **CSV Export** - Export all reports as CSV files
- ✅ **Filtered Exports** - Export filtered data with custom date ranges

### Settings & Configuration
- ✅ **Staff Management** - Configure staff settings, target billable rates, job titles, teams
- ✅ **Member Management** - Invite and manage organization members
- ✅ **Organization Settings** - Manage organization details
- ✅ **Saved Filters** - Save and reuse filter configurations for reports

## Tech Stack

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui
- **Charting**: Recharts
- **Data Fetching**: SWR (stale-while-revalidate)
- **Form Handling**: React Hook Form + Zod
- **Date Handling**: date-fns
- **CSV Export**: papaparse
- **PDF Export**: jspdf + html2canvas

### Backend
- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **SDK**: xero-node (Xero SDK)
- **HTTP Client**: axios

### Infrastructure
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Deployment**: Vercel (recommended) or other platforms

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Xero Developer account (for XPM API integration)

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
2. Run all migration files in order from `supabase/migrations/`:
   - `001_initial_schema.sql`
   - `002_xero_connections.sql`
   - `003_xpm_tables.sql`
   - ... (and all subsequent migrations)

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

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Xero Configuration (for OAuth)
XERO_CLIENT_ID=your-xero-client-id
XERO_CLIENT_SECRET=your-xero-client-secret
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback

# Encryption Key (for Xero token encryption)
ENCRYPTION_KEY=your-32-character-encryption-key
```

**Important**: 
- `SUPABASE_SERVICE_ROLE_KEY` should ONLY be used server-side. Never expose it in client-side code.
- `ENCRYPTION_KEY` should be a 32-character string for AES-256-GCM encryption
- Generate a secure encryption key: `openssl rand -base64 32`

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
│   │   │   ├── dashboard/     # Dashboard API endpoints
│   │   │   ├── revenue/       # Revenue report APIs
│   │   │   ├── billable/      # Billable report APIs
│   │   │   ├── productivity/ # Productivity report APIs
│   │   │   ├── wip/          # WIP report APIs
│   │   │   ├── recoverability/ # Recoverability report APIs
│   │   │   ├── timesheet/    # Timesheet upload APIs
│   │   │   ├── invoice/      # Invoice upload APIs
│   │   │   ├── staff/        # Staff management APIs
│   │   │   ├── xero/         # Xero OAuth APIs
│   │   │   └── xpm/          # XPM sync APIs
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Dashboard page
│   │   ├── reports/           # Report pages
│   │   ├── settings/          # Settings pages
│   │   └── onboarding/        # Onboarding pages
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   ├── charts/           # Chart and report components
│   │   ├── org-selector.tsx  # Organization selector
│   │   ├── sidebar.tsx        # Sidebar navigation
│   │   └── user-menu.tsx     # User menu
│   ├── lib/                   # Utility functions
│   │   ├── supabase/         # Supabase clients
│   │   ├── xero/             # Xero client and crypto
│   │   ├── xpm/              # XPM sync utilities
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
- `xero_connections` - Xero OAuth connections

### Data Upload Tables

- `timesheet_uploads` - Timesheet CSV uploads
- `wip_timesheet_uploads` - WIP timesheet CSV uploads
- `recoverability_timesheet_uploads` - Recoverability timesheet CSV uploads
- `invoice_uploads` - Invoice CSV uploads

### Configuration Tables

- `staff_settings` - Staff configuration (target billable rates, job titles, teams, etc.)
- `saved_filters` - User-saved filter configurations

### Row Level Security (RLS)

All tables have RLS enabled, ensuring:
- Users can only access data from their own organizations
- Only admins can modify organization settings
- Member management permissions are controlled by roles
- Data isolation is enforced at the database level

## Route Structure

### Public Routes

- `/` - Home page (redirects to `/dashboard` if logged in)
- `/auth/login` - Login page
- `/auth/signup` - Sign up page

### Protected Routes

- `/dashboard` - Dashboard overview with KPIs and charts
- `/reports/*` - Report pages
  - `/reports/revenue` - Revenue/Invoice report
  - `/reports/billable` - Billable report
  - `/reports/workinprogress` - Work in progress report
  - `/reports/productivity` - Productivity analytics
  - `/reports/recoverability` - Recoverability report
- `/settings/*` - Settings pages (admin access required for most)
  - `/settings/organisation` - Organization settings
  - `/settings/members` - Member management
  - `/settings/staff` - Staff settings and target billable rates
  - `/settings/xero` - Xero connection management
  - `/settings/sync` - Sync settings
  - `/settings/timesheet` - Timesheet upload
  - `/settings/wip-timesheet` - WIP timesheet upload
  - `/settings/recoverability-timesheet` - Recoverability timesheet upload
  - `/settings/invoice` - Invoice upload
- `/profile` - User profile
- `/onboarding/create-org` - Create organization (first-time use)

## User Roles

- **admin** - Administrator: Can manage organization settings, members, Xero connections, staff settings, and upload data
- **member** - Member: Can view reports and data, export reports
- **viewer** - Viewer: Read-only access to reports

## Data Upload Formats

### Timesheet Upload
CSV format with columns: Date, Staff, Client, Job, Task, Hours, Billable Hours, etc.

### WIP Timesheet Upload
CSV format with WIP-related columns: Date, Staff, Client, Job, WIP Amount, etc.

### Recoverability Timesheet Upload
CSV format with recoverability data: Date, Staff, Client, Job, Recoverable Amount, etc.

### Invoice Upload
CSV format with invoice data: Invoice Date, Client, Amount, etc.

Refer to the upload forms in `/settings/*` for detailed column requirements.

## Development Guide

### Adding a New Page

1. Create a new route directory under `src/app/`
2. Use `requireOrg()` to ensure user has selected an organization
3. Use `isAdmin()` / `isMember()` to check permissions
4. Wrap page content with `AppLayout` component

Example:
```typescript
import { requireOrg, loadUserOrganizations, getActiveOrgId } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'

export default async function MyPage() {
  const org = await requireOrg()
  const organizations = await loadUserOrganizations()
  const activeOrgId = await getActiveOrgId()

  return (
    <AppLayout 
      organizations={organizations} 
      activeOrgId={activeOrgId}
    >
      {/* Page content */}
    </AppLayout>
  )
}
```

### Adding a New API Route

1. Create a new route file under `src/app/api/`
2. Use `requireAuth()` or server-side Supabase client to ensure user is authenticated
3. Use Supabase client for database operations
4. RLS will automatically handle data isolation

Example:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Your API logic here
  return NextResponse.json({ data: 'success' })
}
```

### Adding a New Report

1. Create a new page under `src/app/reports/[report-name]/page.tsx`
2. Create report components under `src/components/charts/`
3. Create API routes under `src/app/api/[report-name]/`
4. Add navigation item to `src/components/sidebar.tsx`

## Xero Integration

### Setting up Xero OAuth

1. Create a Xero app in [Xero Developer Portal](https://developer.xero.com)
2. Configure redirect URI: `http://localhost:3000/api/xero/callback` (development)
3. Add scopes: `openid`, `profile`, `email`, `offline_access`, `practicemanager`
4. Add Client ID and Client Secret to `.env.local`
5. Connect Xero account from `/settings/xero`

See `XPM_API_Connection_Guide.md` for detailed instructions.

## Performance Optimization

The project includes several performance optimizations:

- Database indexes on frequently queried columns
- Aggregation functions for complex calculations
- SWR for client-side data fetching with caching
- Server-side data fetching where possible
- Optimized SQL queries with proper joins

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Ensure user is a member of the organization
2. **Xero Connection Issues**: Check OAuth scopes include `practicemanager`
3. **Upload Failures**: Verify CSV format matches expected columns
4. **Token Expiration**: Xero tokens are automatically refreshed, but check connection status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

If you have any questions or issues, please submit an Issue or contact the development team.

---

**Version**: 0.1.0  
**Last Updated**: 2025-01-27
