# PRD – XPM Dashboard (Multi-Tenant SaaS)

## 1. Project Overview

### 1.1 Project Objectives
Build a multi-tenant SaaS platform that provides accounting firms with analytics and reporting dashboards based on Xero Practice Manager (XPM) data. The platform automatically syncs XPM data to Supabase, delivering real-time business insights, productivity analysis, and financial reports.

### 1.2 Core Value Propositions
- **Automated Data Sync**: Automatically sync business data from XPM without manual exports
- **Real-time Dashboards**: Visual reports and analytics based on the latest data
- **Multi-tenant Architecture**: Each accounting firm has independent data space and configuration
- **Deep Analytics**: Multi-dimensional analysis of revenue, productivity, project profitability, and more

### 1.3 Target Users
- **Primary Users**: Accounting Firms
- **Initial Customer**: Developer's accounting firm (as Beta testing)
- **Future Expansion**: Other professional service companies using XPM

## 2. User Roles and Permissions

### 2.1 User Roles
1. **Organization Admin**
   - Manage organization settings
   - Connect/disconnect XPM connections
   - Manage team members
   - View all reports

2. **Team Member**
   - View assigned dashboards and reports
   - Export report data
   - Cannot modify organization settings

3. **Viewer (Read-only)**
   - View reports only
   - No export permissions

### 2.2 Permission Model
- User authentication based on Supabase Auth
- Data isolation based on Supabase RLS (Row Level Security)
- Complete data isolation for each organization (tenant)
- Users can only access data from their own organization

## 3. Functional Requirements

### 3.1 User Authentication and Management
- [ ] Supabase Auth integration (email/password login)
- [ ] User registration flow
- [ ] Organization creation and management
- [ ] Team member invitation and management
- [ ] User role assignment
- [ ] Password reset functionality

### 3.2 XPM Connection Management
- [ ] Xero OAuth 2.0 connection flow
- [ ] Support for `practicemanager` scope
- [ ] Multi-organization support (one user can connect multiple Xero organizations)
- [ ] Connection status display
- [ ] Reconnect/disconnect functionality
- [ ] Automatic token refresh

### 3.3 Data Synchronization
- [ ] Automatic incremental sync (based on XPM_SYNC_ARCHITECTURE.md)
- [ ] Sync 13 XPM tables:
  - Clients, Client Groups, Jobs, Tasks, Time Entries
  - Invoices, Staff, Quotes, Expense Claims
  - Categories, Costs, Custom Fields, Templates
- [ ] Sync status monitoring and logging
- [ ] Manual sync trigger functionality
- [ ] Sync error handling and retry mechanism
- [ ] Sync history records

### 3.4 Dashboards and Reports

#### 3.4.1 Revenue
- [ ] Total Revenue by Month, by Client Groups & by Partners
- [ ] Total Revenue by Month, by Client Groups & by Managers

#### 3.4.2 Billable
- [ ] Billable Hours by Month, by Client Groups & by Partners
- [ ] Billable $ Amount by Month, by Client Groups & by Managers

#### 3.4.3 Work In Progress
- [ ] Work In Progress by Client Groups & by Partners
- [ ] Work In Progress by Client Groups & by Managers

#### 3.4.4 Productivity Analytics
- [ ] To be built

### 3.5 Data Export
- [ ] Export reports as CSV
- [ ] Export reports as PDF (optional)
- [ ] Custom date range export

### 3.6 Settings and Configuration
- [ ] Organization settings (name, timezone, etc.)
- [ ] Sync frequency configuration
- [ ] Report preference settings
- [ ] Notification settings (optional)

## 4. Technical Architecture

### 4.1 Frontend Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 18+
- **Charting Library**: Recharts
- **Styling**: Tailwind CSS
- **State Management**: React Context / Zustand (if needed)
- **Form Handling**: React Hook Form + Zod

### 4.2 Backend Tech Stack
- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **SDK**: xero-node (Official Xero SDK)
- **Database Client**: @supabase/supabase-js

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

### 5.2 XPM Data Tables
Refer to table structures in `XPM_SYNC_ARCHITECTURE.md`. All tables need:
- `organization_id` field (linked to organizations)
- `xpm_id` field (XPM original ID)
- `tenant_id` field (Xero tenant ID, for sync)
- `raw_data jsonb` field (store complete JSON)
- `created_at`, `updated_at` timestamps

Main tables:
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

### 5.3 Sync Metadata Table
```sql
create table xpm_sync_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  tenant_id text not null,
  table_name text not null,
  last_sync_at timestamptz not null,
  last_sync_status text, -- 'success', 'failed', 'partial'
  last_sync_count integer,
  next_sync_at timestamptz,
  sync_frequency text, -- 'hourly', 'daily', 'weekly', 'monthly'
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, tenant_id, table_name)
);
```

### 5.4 Row Level Security (RLS) Policies
All tables enable RLS. Policy example:
```sql
-- Users can only access data from their own organization
create policy "users_access_own_org" on xpm_clients
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );
```

## 6. API Design

### 6.1 Authentication API
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (Supabase Auth)
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Get current session

### 6.2 Organization Management API
- `GET /api/organizations` - Get list of user's organizations
- `POST /api/organizations` - Create new organization
- `GET /api/organizations/[id]` - Get organization details
- `PUT /api/organizations/[id]` - Update organization settings
- `GET /api/organizations/[id]/members` - Get organization members
- `POST /api/organizations/[id]/members` - Invite member
- `DELETE /api/organizations/[id]/members/[userId]` - Remove member

### 6.3 Xero Connection API
- `GET /api/xero/connect?organizationId=xxx` - Initiate OAuth connection
- `GET /api/xero/callback` - OAuth callback handling
- `GET /api/xero/connections?organizationId=xxx` - Get connection list
- `DELETE /api/xero/connections/[id]` - Disconnect connection

### 6.4 Data Sync API
- `POST /api/xpm/sync?organizationId=xxx&table=clients` - Manually trigger sync
- `GET /api/xpm/sync/status?organizationId=xxx` - Get sync status
- `GET /api/xpm/sync/history?organizationId=xxx` - Get sync history

### 6.5 Data Query API
- `GET /api/xpm/clients?organizationId=xxx&dateFrom=xxx&dateTo=xxx`
- `GET /api/xpm/jobs?organizationId=xxx`
- `GET /api/xpm/invoices?organizationId=xxx`
- `GET /api/xpm/time-entries?organizationId=xxx`
- `GET /api/xpm/staff?organizationId=xxx`
- (Similar endpoints for other tables)

### 6.6 Reports API
- `GET /api/reports/revenue?organizationId=xxx&dateFrom=xxx&dateTo=xxx`
- `GET /api/reports/productivity?organizationId=xxx`
- `GET /api/reports/projects?organizationId=xxx`
- `GET /api/reports/clients?organizationId=xxx`
- `GET /api/reports/costs?organizationId=xxx`
- `GET /api/reports/dashboard?organizationId=xxx` - Dashboard overview data

## 7. UI/UX Requirements

### 7.1 Page Structure
```
/ (Home/Login)
├── /dashboard (Dashboard Overview)
├── /reports
│   ├── /revenue
│   ├── /billable
│   ├── /workinprogress
│   ├── /productivity
├── /settings
│   ├── /organisation (Organisation Settings)
│   ├── /xero (Xero Connection Management)
│   ├── /sync (Sync Settings)
│   └── /members (Member Management)
└── /profile (User Profile)
```

### 7.2 Design Principles
- **Responsive Design**: Support desktop, tablet, mobile devices
- **Modern UI**: Clean, professional, user-friendly
- **Data Visualization**: Use Recharts to create clear, meaningful charts
- **Loading States**: Show loading states for all async operations
- **Error Handling**: Friendly error messages and handling

### 7.3 Key UI Components
- Navigation bar (sidebar)
- Data tables (with sorting, filtering, pagination)
- Chart components (using Recharts)
- KPI cards
- Date picker
- Export buttons
- Sync status indicator

## 8. Security Requirements

### 8.1 Authentication and Authorization
- All API endpoints require authentication (except public endpoints)
- Use Supabase Auth JWT tokens
- RLS policies ensure data isolation
- Users can only access data from their own organization

### 8.2 Data Security
- Xero tokens encrypted storage (AES-256-GCM)
- Service Role key used only on server-side
- All API calls use HTTPS
- Sensitive data not logged

### 8.3 API Security
- Rate limiting
- Input validation and sanitization
- SQL injection protection (use parameterized queries)
- XSS protection

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
- Database query optimization (indexes, materialized views)

## 10. Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Supabase project and database
- [ ] Create database table structures (users, organizations, XPM tables)
- [ ] Implement Supabase Auth integration
- [ ] Implement basic RLS policies
- [ ] Set up development environment

### Phase 2: Xero Connection (Week 3)
- [ ] Implement Xero OAuth 2.0 flow
- [ ] Token encryption storage and automatic refresh
- [ ] Connection management UI
- [ ] Multi-organization connection support

### Phase 3: Data Synchronization (Week 4-5)
- [ ] Implement incremental sync logic
- [ ] Implement sync for all 13 tables
- [ ] Sync status monitoring and logging
- [ ] Error handling and retry mechanism
- [ ] Scheduled task setup (Vercel Cron or similar)

### Phase 4: Dashboards and Reports (Week 6-8)
- [ ] Overview dashboard
- [ ] Revenue analytics reports
- [ ] Productivity analytics reports
- [ ] Project management reports
- [ ] Client analytics reports
- [ ] Cost analytics reports
- [ ] Implement all charts using Recharts

### Phase 5: User Management (Week 9)
- [ ] Organization creation and management
- [ ] Member invitation and management
- [ ] Role and permission management
- [ ] User settings page

### Phase 6: Optimization and Testing (Week 10-11)
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Unit tests and integration tests
- [ ] User experience optimization
- [ ] Security audit

### Phase 7: Beta Testing (Week 12)
- [ ] Deploy to production environment
- [ ] Beta user testing (developer's accounting firm)
- [ ] Collect feedback
- [ ] Bug fixes

## 11. Success Metrics

### 11.1 Technical Metrics
- Data sync success rate > 99%
- API availability > 99.5%
- Average response time < 1 second

### 11.2 Business Metrics
- Beta user satisfaction > 4/5
- Daily active users count
- Data sync frequency (automatic sync execution count)

## 12. Risks and Mitigation

### 12.1 Technical Risks
- **Xero API Changes**: Regularly monitor Xero API updates and adapt promptly
- **Data Sync Failures**: Implement retry mechanism and alerts
- **Performance Bottlenecks**: Database index optimization, query optimization, caching strategy

### 12.2 Business Risks
- **Low User Adoption**: Collect feedback through Beta testing, rapid iteration
- **Data Privacy Issues**: Strictly comply with data protection regulations, clear privacy policy

## 13. Future Expansion

### 13.1 Feature Expansion
- Custom report builder
- Report scheduling and email delivery
- Mobile application (React Native)
- More data source integrations (beyond XPM)

### 13.2 Technical Expansion
- Real-time data updates (WebSocket)
- Advanced analytics (machine learning predictions)
- Data warehouse integration (for long-term analysis)

## 14. Dependencies and Assumptions

### 14.1 Dependencies
- Xero Practice Manager API availability and stability
- Supabase service availability
- Vercel or other deployment platform

### 14.2 Assumptions
- Users already have Xero Practice Manager accounts
- Users are familiar with basic accounting and project management concepts
- Initial phase primarily serves accounting firms (expandable in the future)

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-22  
**Status**: Draft
