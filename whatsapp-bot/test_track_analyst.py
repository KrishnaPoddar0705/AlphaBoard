#!/usr/bin/env python3
"""
Test script to track analyst TUL9 in defence team
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Try parent directory
    load_dotenv(Path(__file__).parent.parent / ".env")

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

# Import with absolute path
from src.alphaboard_client import AlphaBoardClient
from src.config import Settings, get_settings

async def test_track_analyst():
    """Test tracking analyst TUL9 in defence team"""
    try:
        settings = get_settings()
    except Exception as e:
        print(f"❌ Failed to load settings: {e}")
        print("\nPlease ensure .env file exists with required variables:")
        print("  - SUPABASE_URL")
        print("  - SUPABASE_SERVICE_ROLE_KEY")
        print("  - META_WHATSAPP_ACCESS_TOKEN")
        print("  - META_WHATSAPP_PHONE_NUMBER_ID")
        print("  - META_WHATSAPP_VERIFY_TOKEN")
        return
    
    client = AlphaBoardClient(settings)
    
    try:
        print("=" * 60)
        print("Testing Track Analyst: TUL9 in Defence Team")
        print("=" * 60)
        
        # Step 1: Find analyst TUL9
        print("\n1. Searching for analyst TUL9...")
        profile_result = client.supabase.table("profiles") \
            .select("id, username, full_name, organization_id") \
            .ilike("username", "%TUL9%") \
            .execute()
        
        if not profile_result.data or len(profile_result.data) == 0:
            print("❌ Analyst TUL9 not found")
            # Try exact match
            profile_result = client.supabase.table("profiles") \
                .select("id, username, full_name, organization_id") \
                .eq("username", "TUL9") \
                .execute()
        
        if not profile_result.data or len(profile_result.data) == 0:
            print("❌ Analyst TUL9 not found (tried partial and exact match)")
            return
        
        analyst_profile = profile_result.data[0]
        analyst_id = analyst_profile["id"]
        analyst_username = analyst_profile.get("username", "Unknown")
        analyst_name = analyst_profile.get("full_name") or analyst_username
        org_id = analyst_profile.get("organization_id")
        
        print(f"✅ Found analyst: {analyst_name} (ID: {analyst_id})")
        print(f"   Username: {analyst_username}")
        print(f"   Organization ID: {org_id}")
        
        # Step 2: Find defence team
        print("\n2. Searching for Defence team...")
        if org_id:
            teams_result = client.supabase.table("teams") \
                .select("id, name, org_id") \
                .eq("org_id", org_id) \
                .ilike("name", "%defence%") \
                .execute()
            
            if not teams_result.data or len(teams_result.data) == 0:
                # Try "defense" spelling
                teams_result = client.supabase.table("teams") \
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
                team_members_result = client.supabase.table("team_members") \
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
                team_id = None
        else:
            print("⚠️  Analyst has no organization_id")
            team_id = None
        
        # Step 3: Get all recommendations
        print("\n3. Fetching recommendations...")
        recs = await client.get_analyst_recommendations_detailed(analyst_id, None)
        
        print(f"✅ Found {len(recs)} total recommendations")
        
        # Step 4: Get performance stats
        print("\n4. Fetching performance stats...")
        performance = await client.get_analyst_performance(analyst_id)
        
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
                target_irr = rec.get("target_irr")
                return_pct = rec.get("return_pct")
                entry_date = rec.get("entry_date", "")[:10] if rec.get("entry_date") else ""
                
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
                if target_irr is not None:
                    line += f" | IRR Target: {target_irr:,.1f}%"
                
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
        print("✅ Test completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(test_track_analyst())

