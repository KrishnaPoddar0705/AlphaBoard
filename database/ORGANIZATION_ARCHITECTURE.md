# Multi-Organization Architecture

## Overview
AlphaPod supports multi-tenancy where users can belong to organizations (funds). This document explains how organization data is structured and accessed.

## Key Principle: Profile-Based Organization Membership

**Recommendations, price targets, and portfolio weights follow the USER, not the organization.**

- A user's `profile.organization_id` determines their current organization
- User data (recommendations, etc.) does **NOT** have `organization_id` set
- When a user moves to a different organization, all their data moves with them
- RLS policies check `profile.organization_id` to determine visibility, not the data's `organization_id`

## Database Schema

### Core Tables

#### `organizations`
```sql
- id (uuid, PK)
- name (text)
- join_code (text, unique) -- 10-12 alphanumeric code for joining
- created_at (timestamp)
- created_by (uuid) -- creator becomes admin
```

#### `user_organization_membership`
```sql
- user_id (uuid, PK)
- organization_id (uuid, FK -> organizations.id)
- role (text) -- 'admin' or 'analyst'
- joined_at (timestamp)
```

**Constraint**: A user can only be in ONE organization at a time.

#### `profiles`
```sql
- id (uuid, PK)
- username (text)
- organization_id (uuid, nullable) -- Current organization
- is_private (boolean) -- If true, data only visible to user and their org admin
- email (text) -- Synced from auth.users
```

#### `recommendations`
```sql
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- ticker (text)
- action (text) -- BUY/SELL
- entry_price (numeric)
- exit_price (numeric, nullable)
- status (text) -- OPEN/CLOSED
- thesis (text)
- entry_date (timestamp)
- images (jsonb) -- Screenshots
- organization_id (uuid, nullable) -- DEPRECATED, set to NULL
```

#### `price_targets`
```sql
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- ticker (text)
- target_price (numeric)
- target_date (date)
- created_at (timestamp)
- organization_id (uuid, nullable) -- DEPRECATED, set to NULL
```

## RLS Policies

### Recommendations SELECT Policy
```sql
-- Users can see recommendations if:
-- 1. They own it
-- 2. They're in the same organization as the recommendation owner (via profile)
-- 3. They're an admin of the recommendation owner's organization
-- 4. The recommendation owner is public (no org or not private)
```

### Price Targets SELECT Policy
Same logic as recommendations - follows the user's current organization.

### Key Security Functions
```sql
-- These are SECURITY DEFINER functions to bypass RLS recursion:
- is_org_admin(user_id, org_id) -> boolean
- get_user_organization_id(user_id) -> uuid
- user_belongs_to_org(user_id, org_id) -> boolean
```

## User Flows

### Creating an Organization
1. User calls `create-organization` Edge Function with organization name
2. Function generates a unique join code
3. Creates organization record
4. Creates membership record with role='admin'
5. Updates user's `profile.organization_id`

### Joining an Organization
1. User calls `join-organization` Edge Function with join code
2. Function validates code and creates membership with role='analyst'
3. Updates user's `profile.organization_id`
4. **All user's recommendations automatically become visible to org admin**

### Moving Between Organizations
1. Admin removes user from organization (clears `profile.organization_id`)
2. User joins new organization with new join code
3. User's `profile.organization_id` updates
4. **All recommendations now visible to new organization's admin**
5. Recommendations are NOT modified - they follow the user

## Admin Capabilities

Admins of an organization can:
- View all members (username, email, role)
- See organization join code
- Remove analysts from the organization
- View all recommendations, price targets, and performance of org members
- See aggregated organization performance metrics

## Visibility Rules

### Analyst (non-admin)
- Can see their own data
- Can see other analysts' data in their organization
- **Cannot** see data from other organizations
- If `is_private=true`, only they and their admin can see their data

### Admin
- Can see all data from analysts in their organization
- Can see organization-wide aggregated metrics
- Can manage membership (add/remove analysts)

### Public Users (no organization)
- Their data is visible to everyone unless `is_private=true`
- They can see other public users' data
- They **cannot** see organization-scoped data

## Backend Implementation

### Creating Recommendations
```python
# DON'T set organization_id
rec_data = {
    "user_id": user_id,
    "ticker": ticker,
    # ... other fields
    # organization_id is NOT set
}
```

### Querying Recommendations for Admin Dashboard
```typescript
// Query all recommendations for a user - RLS handles visibility
const { data } = await supabase
  .from('recommendations')
  .select('*')
  .eq('user_id', userId);
// RLS policy checks if current user (admin) can see this user's data
```

## Migrations Applied

1. `migration_add_organizations.sql` - Initial org schema
2. `migration_fix_rls_recursion.sql` - Fixed RLS infinite recursion
3. `migration_decouple_recommendations_from_org.sql` - Made recommendations follow profile
4. `migration_decouple_price_targets_from_org.sql` - Made price targets follow profile

## Important Notes

⚠️ **DO NOT** set `organization_id` on recommendations, price_targets, or portfolio_weights
⚠️ **ALWAYS** use `profile.organization_id` to determine user's current organization
⚠️ **RLS policies** handle all visibility logic - don't filter by organization in queries
⚠️ When a user joins a new org, their data follows them automatically

