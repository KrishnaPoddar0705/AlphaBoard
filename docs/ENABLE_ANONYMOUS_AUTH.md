# Enable Anonymous Authentication in Supabase

To allow anonymous users to vote, you need to enable anonymous authentication in your Supabase project.

## Steps to Enable Anonymous Sign-Ins

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard/project/[your-project-id]

2. **Open Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on **Providers** in the submenu

3. **Enable Anonymous Provider**
   - Scroll down to find **Anonymous** provider
   - Toggle the switch to **Enable** anonymous sign-ins
   - Optionally configure:
     - **Enable anonymous sign-ins**: ON
     - **Enable email confirmation**: OFF (recommended for anonymous users)
     - **Enable phone confirmation**: OFF (not applicable for anonymous)

4. **Save Changes**
   - Click **Save** to apply the changes

## Verification

After enabling, anonymous users will be able to:
- Vote on posts, comments, and stocks
- Have their votes tracked with a unique anonymous user ID
- Maintain vote state across page reloads (session persists)

## Security Considerations

- Anonymous users are still subject to RLS policies
- Each anonymous user gets a unique UUID in `auth.users`
- Anonymous sessions can be rate-limited if needed
- Consider enabling CAPTCHA for anonymous sign-ins to prevent abuse (optional)

## Troubleshooting

If you see the error: `"Anonymous sign-ins are disabled"`:
1. Verify anonymous provider is enabled in Dashboard
2. Wait a few seconds for changes to propagate
3. Clear browser cache and try again
4. Check Supabase project logs for any additional errors

