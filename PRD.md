# PRD – XPM Dashboard (Multi-Tenant SaaS)

## 1. Project Overview

### 1.1 Project Objectives
Build a multi-tenant SaaS platform that provides accounting firms with analytics and reporting dashboards based on Xero Practice Manager (XPM) data. The platform supports both automated XPM data synchronization and manual data uploads, delivering real-time business insights, productivity analysis, and financial reports.

### 1.2 Core Value Propositions
- **Flexible Data Input**: Support both automated XPM API sync and manual CSV uploads for timesheets, invoices, and WIP data
- **Real-time Dashboards**: Visual reports and analytics based on the latest data
- **Multi-tenant Architecture**: Each accounting firm has independent data space and configuration
- **Deep Analytics**: Multi-dimensional analysis of revenue, productivity, billable hours, work in progress, and recoverability
- **Staff Performance Tracking**: Monitor staff productivity, billable rates, and capacity utilization

### 1.3 Target Users
- **Primary Users**: Accounting Firms
- **Initial Customer**: Developer's accounting firm (as Beta testing)
- **Future Expansion**: Other professional service companies using XPM

## 2. User Roles and Permissions

### 2.1 User Roles
1. **Organization Admin**
   - Manage organization settings
   - Connect/disconnect Xero connections
   - Manage team members and staff settings
   - View all reports and dashboards
   - Upload and manage data files
   - Configure staff target billable rates

2. **Team Member**
   - View assigned dashboards and reports
   - Export report data (CSV)
   - Cannot modify organization settings
   - Cannot upload data files

3. **Viewer (Read-only)**
   - View reports only
   - No export permissions
   - No data upload permissions

### 2.2 Permission Model
- User authentication based on Supabase Auth
- Data isolation based on Supabase RLS (Row Level Security)
- Complete data isolation for each organization (tenant)
- Users can only access data from their own organization

## 3. Functional Requirements

### 3.1 User Authentication and Management
- [x] Supabase Auth integration (email/password login)
- [x] User registration flow
- [x] Organization creation and management
- [x] Team member invitation and management
- [x] User role assignment
- [ ] Password reset functionality

### 3.2 Xero Connection Management
- [x] Xero OAuth 2.0 connection flow
- [x] Support for `practicemanager` scope
- [x] Multi-organization support (one user can connect multiple Xero organizations)
- [x] Connection status display
- [x] Reconnect/disconnect functionality
- [x] Automatic token refresh

### 3.3 Data Synchronization
- [x] Manual sync trigger functionality
- [x] Sync status monitoring
- [ ] Automatic incremental sync (scheduled sync)
- [ ] Sync 13 XPM tables:
  - Clients, Client Groups, Jobs, Tasks, Time Entries
  - Invoices, Staff, Quotes, Expense Claims
  - Categories, Costs, Custom Fields, Templates
- [ ] Sync error handling and retry mechanism
- [ ] Sync history records

### 3.4 Data Upload Functionality
- [x] Timesheet CSV upload
- [x] WIP (Work In Progress) timesheet CSV upload
- [x] Recoverability timesheet CSV upload
- [x] Invoice CSV upload
- [x] Upload history tracking
- [x] Last upload date display

### 3.5 Dashboards and Reports

#### 3.5.1 Dashboard Overview
- [x] KPI cards showing:
  - Revenue (current year vs last year)
  - Billable amount (current year vs last year)
  - Productivity metrics
  - Recoverability metrics
- [x] Revenue by Client Group chart
- [x] Revenue by Partner chart
- [x] Billable by Client Group chart
- [x] Billable by Partner chart
- [x] Staff Performance table

#### 3.5.2 Revenue Report
- [x] Monthly revenue chart (with partner/client manager filters)
- [x] Revenue by Client Groups table
- [x] Filter by Partner
- [x] Filter by Client Manager
- [x] Month selection
- [x] CSV export

#### 3.5.3 Billable Report
- [x] Monthly billable hours chart
- [x] Monthly billable amount chart
- [x] Billable by Client Groups table
- [x] Billable by Partners table
- [x] Billable by Staff table
- [x] Filter by Partner, Client Manager, Client Group, Staff
- [x] Date range selection
- [x] Saved filters functionality
- [x] CSV export

#### 3.5.4 Work In Progress (WIP) Report
- [x] WIP by Client Groups table
- [x] WIP by Partners chart
- [x] WIP by Client Managers chart
- [x] WIP Aging Summary (bar and pie charts)
- [x] Filter by Partner, Client Manager, Client Group
- [x] CSV export

#### 3.5.5 Productivity Analytics
- [x] Productivity KPI cards:
  - YTD Billable Percentage
  - Last Year Billable Percentage
  - YTD Average Rate
  - Last Year Average Rate
- [x] Monthly productivity chart (billable percentage)
- [x] Total hours chart
- [x] Standard hours chart
- [x] Capacity reducing chart
- [x] Productivity by Client Groups table
- [x] Productivity by Staff table
- [x] Filter by Partner, Client Manager, Client Group, Staff
- [x] Date range selection
- [x] CSV export

#### 3.5.6 Recoverability Report
- [x] Recoverability KPI cards:
  - Current Year Amount
  - Last Year Amount
  - Percentage Change
  - Current Year Percentage
  - Last Year Percentage
- [x] Monthly recoverability chart
- [x] Recoverability by Client Groups table
- [x] Filter by Partner, Client Manager, Client Group
- [x] Saved filters functionality
- [x] Date range selection
- [x] CSV export

### 3.6 Staff Management
- [x] Staff list with settings
- [x] Target billable rate configuration
- [x] Staff job title and team assignment
- [x] Staff email and report configuration
- [x] Staff visibility control (is_hidden flag)
- [x] Effective date ranges for staff settings

### 3.7 Data Export
- [x] Export reports as CSV
- [ ] Export reports as PDF (optional)
- [x] Custom date range export
- [x] Filtered data export

### 3.8 Settings and Configuration
- [x] Organization settings (name, etc.)
- [x] Member management
- [x] Staff settings management
- [x] Xero connection management
- [ ] Sync frequency configuration
- [ ] Report preference settings
- [ ] Notification settings (optional)

## 4. Technical Architecture

### 4.1 Frontend Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 18+
- **Charting Library**: Recharts
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui
- **State Management**: React Context / Server Components
- **Data Fetching**: SWR (stale-while-revalidate)
- **Form Handling**: React Hook Form + Zod
- **Date Handling**: date-fns
- **CSV Export**: papaparse
- **PDF Export**: jspdf + html2canvas

### 4.2 Backend Tech Stack
- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **SDK**: xero-node (Official Xero SDK)
- **Database Client**: @supabase/supabase-js, @supabase/ssr
- **HTTP Client**: axios

### 4.3 Database and Infrastructure
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (if needed)
- **Realtime**: Supabase Realtime (optional)
- **Deployment**: Vercel (recommended) or other platforms

### 4.4 Third-party Integrations
- **Xero Practice Manager API**: v3.0
- **OAuth 2.0**: Xero OAuth flow

## 5. Data Model

### 5.1 User and Organization Tables
```sql
-- Organizations table (Tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organization members table (many-to-many relationship)
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'viewer', -- 'admin', 'member', 'viewer'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- Xero connections table (one organization can have multiple Xero connections)
create table xero_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null, -- Xero tenant ID
  tenant_name text,
  token_set_enc text not null, -- encrypted token set
  expires_at timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, tenant_id)
);
```

### 5.2 Data Upload Tables
- `timesheet_uploads` - Timesheet CSV uploads
- `wip_timesheet_uploads` - WIP timesheet CSV uploads
- `recoverability_timesheet_uploads` - Recoverability timesheet CSV uploads
- `invoice_uploads` - Invoice CSV uploads

### 5.3 Staff Settings Table
- `staff_settings` - Staff configuration including target billable rates, job titles, teams, email, report settings, and effective date ranges

### 5.4 Saved Filters Tables
- `saved_filters` - User-saved filter configurations for reports (billable, recoverability)

### 5.5 XPM Data Tables
Refer to table structures in migration files. All tables need:
- `organization_id` field (linked to organizations)
- `xpm_id` field (XPM original ID, if synced from XPM)
- `tenant_id` field (Xero tenant ID, for sync)
- `raw_data jsonb` field (store complete JSON, if applicable)
- `created_at`, `updated_at` timestamps

Main tables (if XPM sync is implemented):
- `xpm_clients`
- `xpm_client_groups`
- `xpm_jobs`
- `xpm_tasks`
- `xpm_time_entries`
- `xpm_invoices`
- `xpm_staff`
- `xpm_quotes`
- `xpm_expense_claims`
- `xpm_categories`
- `xpm_costs`
- `xpm_custom_fields`
- `xpm_templates`

### 5.6 Row Level Security (RLS) Policies
All tables enable RLS. Policy example:
```sql
-- Users can only access data from their own organization
create policy "users_access_own_org" on timesheet_uploads
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );
```

## 6. API Design

### 6.1 Authentication API
- `POST /api/auth/register` - User registration (handled by Supabase Auth)
- `POST /api/auth/login` - User login (handled by Supabase Auth)
- `POST /api/auth/logout` - User logout (handled by Supabase Auth)
- Session management via Supabase SSR

### 6.2 Organization Management API
- `GET /api/organizations` - Get list of user's organizations
- `POST /api/organizations` - Create new organization
- `GET /api/organizations/[id]/members` - Get organization members
- `POST /api/organizations/[id]/members` - Add member
- `DELETE /api/organizations/[id]/members/[userId]` - Remove member
- `POST /api/org/set-active` - Set active organization

### 6.3 Xero Connection API
- `GET /api/xero/connect?organizationId=xxx` - Initiate OAuth connection
- `GET /api/xero/callback` - OAuth callback handling
- `GET /api/xero/connections?organizationId=xxx` - Get connection list
- `DELETE /api/xero/connections/[id]` - Disconnect connection
- `POST /api/xero/refresh` - Refresh Xero token

### 6.4 Data Sync API
- `POST /api/xpm/sync?organizationId=xxx&table=clients` - Manually trigger sync
- `GET /api/xpm/sync/status?organizationId=xxx` - Get sync status

### 6.5 Data Upload API
- `POST /api/timesheet/upload` - Upload timesheet CSV
- `GET /api/timesheet/last-upload` - Get last upload date
- `POST /api/wip-timesheet/upload` - Upload WIP timesheet CSV
- `GET /api/wip/last-upload` - Get last WIP upload date
- `POST /api/recoverability-timesheet/upload` - Upload recoverability timesheet CSV
- `GET /api/recoverability/last-upload` - Get last recoverability upload date
- `POST /api/invoice/upload` - Upload invoice CSV
- `GET /api/invoice/last-upload` - Get last invoice upload date

### 6.6 Staff Management API
- `GET /api/staff/target-billable` - Get staff target billable settings
- `POST /api/staff/target-billable` - Update staff target billable settings

### 6.7 Dashboard API
- `GET /api/dashboard/kpi` - Get dashboard KPI data
- `GET /api/dashboard/revenue-by-client-group` - Get revenue by client group
- `GET /api/dashboard/revenue-by-partner` - Get revenue by partner
- `GET /api/dashboard/billable-by-client-group` - Get billable by client group
- `GET /api/dashboard/billable-by-partner` - Get billable by partner
- `GET /api/dashboard/staff-performance` - Get staff performance data

### 6.8 Reports API

#### Revenue
- `GET /api/revenue/monthly` - Get monthly revenue data
- `GET /api/revenue/client-groups` - Get revenue by client groups

#### Billable
- `GET /api/billable/monthly` - Get monthly billable data
- `GET /api/billable/client-groups` - Get billable by client groups
- `GET /api/billable/partners` - Get billable by partners
- `GET /api/billable/client-managers` - Get billable by client managers
- `GET /api/billable/staff` - Get billable by staff
- `GET /api/billable/filter-options` - Get filter options
- `GET /api/billable/saved-filters` - Get saved filters
- `POST /api/billable/saved-filters` - Save filter

#### Work In Progress
- `GET /api/wip/client-groups` - Get WIP by client groups
- `GET /api/wip/by-partner` - Get WIP by partners
- `GET /api/wip/by-client-manager` - Get WIP by client managers
- `GET /api/wip/aging-summary` - Get WIP aging summary
- `GET /api/wip/last-upload` - Get last WIP upload date

#### Productivity
- `GET /api/productivity/kpi` - Get productivity KPI data
- `GET /api/productivity/monthly` - Get monthly productivity data
- `GET /api/productivity/client-groups` - Get productivity by client groups
- `GET /api/productivity/staff` - Get productivity by staff
- `GET /api/productivity/standard-hours/monthly` - Get standard hours monthly data
- `GET /api/productivity/capacity-reducing/monthly` - Get capacity reducing monthly data

#### Recoverability
- `GET /api/recoverability/kpi` - Get recoverability KPI data
- `GET /api/recoverability/monthly` - Get monthly recoverability data
- `GET /api/recoverability/client-groups` - Get recoverability by client groups
- `GET /api/recoverability/filter-options` - Get filter options
- `GET /api/recoverability/saved-filters` - Get saved filters
- `POST /api/recoverability/saved-filters` - Save filter

## 7. UI/UX Requirements

### 7.1 Page Structure
```
/ (Home/Login)
├── /dashboard (Dashboard Overview)
├── /reports
│   ├── /revenue (Revenue/Invoice Report)
│   ├── /billable (Billable Report)
│   ├── /workinprogress (Work In Progress Report)
│   ├── /productivity (Productivity Analytics)
│   └── /recoverability (Recoverability Report)
├── /settings
│   ├── /organisation (Organisation Settings)
│   ├── /members (Member Management)
│   ├── /staff (Staff Settings)
│   ├── /xero (Xero Connection Management)
│   ├── /sync (Sync Settings)
│   ├── /timesheet (Timesheet Upload)
│   ├── /wip-timesheet (WIP Timesheet Upload)
│   ├── /recoverability-timesheet (Recoverability Timesheet Upload)
│   └── /invoice (Invoice Upload)
└── /profile (User Profile)
```

### 7.2 Design Principles
- **Responsive Design**: Support desktop, tablet, mobile devices
- **Modern UI**: Clean, professional, user-friendly using shadcn/ui components
- **Data Visualization**: Use Recharts to create clear, meaningful charts
- **Loading States**: Show loading states for all async operations
- **Error Handling**: Friendly error messages and handling
- **Consistent Navigation**: Sidebar navigation with clear sections

### 7.3 Key UI Components
- Navigation sidebar with sections (Dashboard, Reports, Settings, Upload)
- Data tables (with sorting, filtering, pagination)
- Chart components (using Recharts)
- KPI cards with percentage changes
- Date picker and date range selector
- Filter components (Partner, Client Manager, Client Group, Staff)
- Export buttons (CSV)
- Upload forms with file validation
- Sync status indicator
- Organization selector
- User menu

## 8. Security Requirements

### 8.1 Authentication and Authorization
- All API endpoints require authentication (except public endpoints)
- Use Supabase Auth JWT tokens
- RLS policies ensure data isolation
- Users can only access data from their own organization
- Role-based access control for admin/member/viewer

### 8.2 Data Security
- Xero tokens encrypted storage (AES-256-GCM)
- Service Role key used only on server-side
- All API calls use HTTPS
- Sensitive data not logged
- File upload validation and sanitization

### 8.3 API Security
- Rate limiting (to be implemented)
- Input validation and sanitization
- SQL injection protection (use parameterized queries)
- XSS protection
- CSV file validation for uploads

## 9. Performance Requirements

### 9.1 Response Time
- Page load time < 2 seconds
- API response time < 500ms (simple queries)
- API response time < 2 seconds (complex reports)

### 9.2 Data Synchronization
- Incremental sync completion time < 5 minutes (single table)
- Initial full sync completion time < 30 minutes (all tables)

### 9.3 Scalability
- Support at least 100 organizations (initial target)
- Each organization supports at least 10,000 records
- Database query optimization (indexes, materialized views, aggregation functions)

## 10. Implementation Status

### Phase 1: Foundation ✅
- [x] Set up Supabase project and database
- [x] Create database table structures (users, organizations, upload tables)
- [x] Implement Supabase Auth integration
- [x] Implement basic RLS policies
- [x] Set up development environment

### Phase 2: Xero Connection ✅
- [x] Implement Xero OAuth 2.0 flow
- [x] Token encryption storage and automatic refresh
- [x] Connection management UI
- [x] Multi-organization connection support

### Phase 3: Data Upload ✅
- [x] Implement CSV upload for timesheets
- [x] Implement CSV upload for WIP timesheets
- [x] Implement CSV upload for recoverability timesheets
- [x] Implement CSV upload for invoices
- [x] Upload history tracking

### Phase 4: Dashboards and Reports ✅
- [x] Overview dashboard with KPIs
- [x] Revenue analytics reports
- [x] Billable analytics reports
- [x] Productivity analytics reports
- [x] Work In Progress reports
- [x] Recoverability reports
- [x] Implement all charts using Recharts
- [x] CSV export functionality

### Phase 5: User Management ✅
- [x] Organization creation and management
- [x] Member invitation and management
- [x] Role and permission management
- [x] Staff settings management

### Phase 6: Data Synchronization (Partial)
- [x] Manual sync trigger functionality
- [x] Sync status monitoring
- [ ] Automatic incremental sync (scheduled)
- [ ] Sync for all 13 XPM tables
- [ ] Sync error handling and retry mechanism
- [ ] Sync history records

### Phase 7: Optimization and Testing (Ongoing)
- [x] Performance optimization (indexes, aggregation functions)
- [x] Error handling improvements
- [ ] Unit tests and integration tests
- [x] User experience optimization
- [ ] Security audit

## 11. Success Metrics

### 11.1 Technical Metrics
- Data upload success rate > 99%
- API availability > 99.5%
- Average response time < 1 second

### 11.2 Business Metrics
- Beta user satisfaction > 4/5
- Daily active users count
- Data upload frequency
- Report usage statistics

## 12. Risks and Mitigation

### 12.1 Technical Risks
- **Xero API Changes**: Regularly monitor Xero API updates and adapt promptly
- **Data Upload Failures**: Implement validation and error handling
- **Performance Bottlenecks**: Database index optimization, query optimization, caching strategy
- **CSV Format Variations**: Robust CSV parsing with error handling

### 12.2 Business Risks
- **Low User Adoption**: Collect feedback through Beta testing, rapid iteration
- **Data Privacy Issues**: Strictly comply with data protection regulations, clear privacy policy
- **Data Quality**: Validate uploaded data and provide clear error messages

## 13. Future Expansion

### 13.1 Feature Expansion
- Custom report builder
- Report scheduling and email delivery
- Mobile application (React Native)
- More data source integrations (beyond XPM)
- Advanced filtering and search
- Data visualization customization

### 13.2 Technical Expansion
- Real-time data updates (WebSocket)
- Advanced analytics (machine learning predictions)
- Data warehouse integration (for long-term analysis)
- Automated XPM sync scheduling
- PDF export functionality
- Bulk data operations

## 14. Dependencies and Assumptions

### 14.1 Dependencies
- Xero Practice Manager API availability and stability
- Supabase service availability
- Vercel or other deployment platform
- CSV file format compliance from users

### 14.2 Assumptions
- Users can provide data in CSV format for manual uploads
- Users are familiar with basic accounting and project management concepts
- Initial phase primarily serves accounting firms (expandable in the future)
- Users have access to Xero Practice Manager (for API sync) or can export data as CSV

---

**Document Version**: 2.0  
**Last Updated**: 2025-01-27  
**Status**: Active Development
