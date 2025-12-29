#!/usr/bin/env python3
"""
Script to refresh the performance table with cumulative portfolio returns.
This will calculate and update cumulative_portfolio_return_pct for all users.
"""
import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.performance import update_all_users_cumulative_returns
from datetime import datetime

if __name__ == "__main__":
    print(f"[{datetime.now().isoformat()}] Starting performance table refresh...")
    print("This will update cumulative_portfolio_return_pct for all users with recommendations.")
    print("This may take a while depending on the number of users...\n")
    
    try:
        result = update_all_users_cumulative_returns()
        
        print(f"\n[{datetime.now().isoformat()}] Performance table refresh completed!")
        print(f"Updated: {result.get('updated', 0)} users")
        print(f"Errors: {result.get('errors', 0)} users")
        
        if result.get('errors', 0) > 0:
            print("\nWarning: Some users had errors during update. Check logs for details.")
            sys.exit(1)
        else:
            print("\nSuccess: All users updated successfully!")
            sys.exit(0)
            
    except Exception as e:
        print(f"\nError: Failed to refresh performance table: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

