#!/usr/bin/env python3
"""
Simple test script to query analyst TUL9 recommendations directly from Supabase
"""
import os
from supabase import create_client
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv(Path(__file__).parent.parent / ".env")

# Get Supabase credentials
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    print("Please set these environment variables or add them to .env file")
    exit(1)

# Create Supabase client
supabase = create_client(supabase_url, supabase_key)

print("=" * 60)
print("Testing Track Analyst: TUL9 in Defence Team")
print("=" * 60)

# Step 1: Find analyst TUL9
print("\n1. Searching for analyst TUL9...")
profile_result = supabase.table("profiles") \
    .select("id, username, full_name, organization_id") \
    .ilike("username", "%TUL9%") \
    .execute()

if not profile_result.data or len(profile_result.data) == 0:
    # Try exact match
    profile_result = supabase.table("profiles") \
        .select("id, username, full_name, organization_id") \
        .eq("username", "TUL9") \
        .execute()

if not profile_result.data or len(profile_result.data) == 0:
    print("❌ Analyst TUL9 not found")
    print("\nAvailable analysts (first 10):")
    all_profiles = supabase.table("profiles") \
        .select("username, full_name") \
        .limit(10) \
        .execute()
    for p in all_profiles.data:
        print(f"  - {p.get('username')} ({p.get('full_name')})")
    exit(1)

analyst_profile = profile_result.data[0]
analyst_id = analyst_profile["id"]
analyst_username = analyst_profile.get("username", "Unknown")
analyst_name = analyst_profile.get("full_name") or analyst_username
org_id = analyst_profile.get("organization_id")

print(f"✅ Found analyst: {analyst_name}")
print(f"   Username: {analyst_username}")
print(f"   ID: {analyst_id}")
print(f"   Organization ID: {org_id}")

# Step 2: Find defence team
print("\n2. Searching for Defence team...")
if org_id:
    teams_result = supabase.table("teams") \
        .select("id, name, org_id") \
        .eq("org_id", org_id) \
        .ilike("name", "%defence%") \
        .execute()
    
    if not teams_result.data or len(teams_result.data) == 0:
        # Try "defense" spelling
        teams_result = supabase.table("teams") \
            .select("id, name, org_id") \
            .eq("org_id", org_id) \
            .ilike("name", "%defense%") \
            .execute()
    
    if teams_result.data and len(teams_result.data) > 0:
        defence_team = teams_result.data[0]
        team_id = defence_team["id"]
        team_name = defence_team["name"]
        print(f"✅ Found team: {team_name} (ID: {team_id})")
        
        # Verify analyst is in this team
        team_members_result = supabase.table("team_members") \
            .select("user_id") \
            .eq("team_id", team_id) \
            .eq("user_id", analyst_id) \
            .execute()
        
        if team_members_result.data and len(team_members_result.data) > 0:
            print(f"✅ Analyst {analyst_name} is a member of {team_name}")
        else:
            print(f"⚠️  Analyst {analyst_name} is NOT a member of {team_name}")
    else:
        print("⚠️  Defence team not found in organization")
        if org_id:
            all_teams = supabase.table("teams") \
                .select("id, name") \
                .eq("org_id", org_id) \
                .execute()
            if all_teams.data:
                print("Available teams:")
                for t in all_teams.data:
                    print(f"  - {t.get('name')}")
else:
    print("⚠️  Analyst has no organization_id")

# Step 3: Get all recommendations
print("\n3. Fetching recommendations...")
recs_result = supabase.table("recommendations") \
    .select("*") \
    .eq("user_id", analyst_id) \
    .order("entry_date", desc=True) \
    .limit(50) \
    .execute()

recs = recs_result.data if recs_result.data else []
print(f"✅ Found {len(recs)} total recommendations")

# Step 4: Get performance stats
print("\n4. Fetching performance stats...")
perf_result = supabase.table("performance") \
    .select("*") \
    .eq("user_id", analyst_id) \
    .limit(1) \
    .execute()

performance = perf_result.data[0] if perf_result.data and len(perf_result.data) > 0 else {}

# Step 5: Format and display results
print("\n" + "=" * 60)
print(f"📊 ANALYST REPORT: {analyst_name}")
print("=" * 60)

# Performance summary
if performance:
    win_rate = performance.get("win_rate")
    total_return = performance.get("total_return_pct")
    total_ideas = performance.get("total_ideas")
    alpha = performance.get("alpha_pct")
    
    perf_line = ""
    if total_ideas:
        perf_line += f"📊 {total_ideas} ideas"
    if win_rate is not None:
        perf_line += f" | Win: {win_rate:.0f}%"
    if total_return is not None:
        emoji = "🟢" if total_return >= 0 else "🔴"
        perf_line += f" | {emoji} {total_return:+.1f}%"
    if alpha is not None:
        perf_line += f" | Alpha: {alpha:+.1f}%"
    
    if perf_line:
        print(f"\n{perf_line}\n")

# Group by status
open_recs = [r for r in recs if r.get("status") == "OPEN"]
closed_recs = [r for r in recs if r.get("status") == "CLOSED"]
watchlist_recs = [r for r in recs if r.get("status") == "WATCHLIST"]

print(f"📈 Open Positions: {len(open_recs)}")
print(f"📉 Closed Positions: {len(closed_recs)}")
print(f"👀 Watchlist: {len(watchlist_recs)}")
print("\n" + "─" * 60)

# Show OPEN positions
if open_recs:
    print("\n📈 OPEN POSITIONS:")
    print("─" * 60)
    print("*Entry* → *CMP* | *Return* | *Target*\n")
    
    for i, rec in enumerate(open_recs[:15], 1):
        ticker = rec.get("ticker", "???")
        action = rec.get("action", "BUY")
        entry_price = rec.get("entry_price")
        current_price = rec.get("current_price")
        target_price = rec.get("target_price")
        entry_date = rec.get("entry_date", "")[:10] if rec.get("entry_date") else ""
        
        # Calculate return
        return_pct = None
        if entry_price and current_price and entry_price > 0:
            return_pct = ((current_price - entry_price) / entry_price) * 100
        
        # Action emoji
        action_emoji = "🟢" if action == "BUY" else "🔴" if action == "SELL" else "👀"
        
        # Build line
        line = f"{i}. {action_emoji} *{action} {ticker}*"
        
        # Date
        if entry_date:
            line += f"\n   📅 {entry_date}"
        
        # Prices
        if entry_price:
            line += f"\n   ₹{entry_price:,.0f}"
            if current_price:
                line += f" → ₹{current_price:,.0f}"
        
        # Return
        if return_pct is not None:
            ret_emoji = "🟢" if return_pct >= 0 else "🔴"
            line += f" | {ret_emoji} {return_pct:+.1f}%"
        
        # Target
        if target_price:
            line += f" | Target: ₹{target_price:,.0f}"
        
        print(line)
        print()

# Show CLOSED positions
if closed_recs:
    print("\n📉 CLOSED POSITIONS (Recent):")
    print("─" * 60)
    
    for i, rec in enumerate(closed_recs[:10], 1):
        ticker = rec.get("ticker", "???")
        action = rec.get("action", "BUY")
        entry_price = rec.get("entry_price")
        exit_price = rec.get("exit_price")
        final_return = rec.get("final_return_pct")
        entry_date = rec.get("entry_date", "")[:10] if rec.get("entry_date") else ""
        exit_date = rec.get("exit_date", "")[:10] if rec.get("exit_date") else ""
        
        action_emoji = "🟢" if action == "BUY" else "🔴" if action == "SELL" else "👀"
        
        line = f"{i}. {action_emoji} {action} {ticker}"
        if entry_date:
            line += f" ({entry_date}"
            if exit_date:
                line += f" → {exit_date}"
            line += ")"
        
        if entry_price and exit_price:
            line += f"\n   ₹{entry_price:,.0f} → ₹{exit_price:,.0f}"
        
        if final_return is not None:
            ret_emoji = "🟢" if final_return >= 0 else "🔴"
            line += f" | {ret_emoji} {final_return:+.1f}%"
        
        print(line)
        print()

print("=" * 60)
print("✅ Test completed!")
print("=" * 60)

