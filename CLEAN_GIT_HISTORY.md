# Cleaning Git History of Exposed Secrets

⚠️ **CRITICAL**: The following secrets were found in git history and need to be removed:

- `OPENAI_API_KEY` - Found in commit history
- `SUPABASE_SERVICE_KEY` - Found in commit history  
- `FINNHUB_API_KEY` - Found in commit history
- `VITE_SUPABASE_ANON_KEY` - Found in commit history (less critical, but should be cleaned)

## ⚠️ IMPORTANT: Rotate Secrets First!

**Before cleaning git history, you MUST rotate all exposed secrets:**

1. **OpenAI API Key**: https://platform.openai.com/api-keys
   - Delete the old key
   - Create a new key
   - Update all environments

2. **Supabase Service Key**: https://app.supabase.com/project/_/settings/api
   - Generate a new service role key
   - Update backend `.env` files
   - Update production environments

3. **Finnhub API Key**: https://finnhub.io/account
   - Regenerate API key
   - Update backend `.env` files

4. **Supabase Anon Key**: https://app.supabase.com/project/_/settings/api
   - While anon keys are public-facing, consider rotating if concerned
   - Update frontend `.env` files

## Option 1: Using git-filter-repo (Recommended)

`git-filter-repo` is the modern, recommended tool for rewriting git history.

### Installation:

```bash
# macOS
brew install git-filter-repo

# Or via pip
pip install git-filter-repo
```

### Remove .env files from history:

```bash
# Backup your repository first!
cd /path/to/leaderboard
git clone --mirror . ../leaderboard-backup.git

# Remove all .env files from history
git filter-repo --path frontend/.env --invert-paths
git filter-repo --path backend/.env --invert-paths

# Force push (WARNING: This rewrites history!)
git push origin --force --all
git push origin --force --tags
```

### Remove specific secrets from history:

```bash
# Remove OpenAI API key
git filter-repo --replace-text <(echo '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==REDACTED')

# Remove Finnhub API key
git filter-repo --replace-text <(echo 'd4jvrhpr01qgcb0vt4o0d4jvrhpr01qgcb0vt4og==REDACTED')

# Remove Supabase service key (if different from anon key)
# Note: The one found appears to be the anon key, but check your actual service key
```

## Option 2: Using BFG Repo-Cleaner

BFG is another popular tool for cleaning git history.

### Installation:

```bash
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
# Or via Homebrew
brew install bfg
```

### Remove .env files:

```bash
# Clone a fresh copy
git clone --mirror https://github.com/yourusername/leaderboard.git leaderboard.git

# Remove .env files
bfg --delete-files frontend/.env leaderboard.git
bfg --delete-files backend/.env leaderboard.git

# Remove secrets (create passwords.txt with one secret per line)
bfg --replace-text passwords.txt leaderboard.git

# Clean up
cd leaderboard.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push
git push --force
```

## Option 3: Manual git filter-branch (Not Recommended)

⚠️ This is slower and more error-prone, but works if other tools aren't available.

```bash
# Remove .env files
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch frontend/.env backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Remove specific secrets
git filter-branch --force --tree-filter \
  "find . -type f -exec sed -i '' 's/OLD_SECRET/REDACTED/g' {} \;" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

## After Cleaning History

1. **Notify all collaborators** - They'll need to re-clone or reset their local repos
2. **Update CI/CD** - Ensure all pipelines use new secrets
3. **Verify** - Check that secrets are no longer in history:
   ```bash
   git log --all --source --full-history -p | grep -i "API_KEY\|SECRET"
   ```

## Prevention

To prevent future exposure:

1. ✅ `.env` files are now in `.gitignore`
2. ✅ Use `.env.example` files for documentation
3. ✅ Use Supabase secrets for edge functions
4. ✅ Use platform secret management for production
5. ✅ Regular audits: `git log --all -p | grep -i "secret\|password\|key"`

## Recovery

If something goes wrong:

```bash
# Restore from backup
cd /path/to/leaderboard
rm -rf .git
git clone ../leaderboard-backup.git .
```

## Additional Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [git-filter-repo documentation](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

