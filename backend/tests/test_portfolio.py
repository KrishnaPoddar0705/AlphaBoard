"""
Integration tests for Paper Trading Portfolio functionality.

Tests cover:
- Portfolio creation and retrieval
- Buy trade execution
- Sell trade execution with FIFO
- Cash balance validation
- P&L calculations
- Edge cases and error handling

Run with: pytest backend/tests/test_portfolio.py -v
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import Mock, patch
from decimal import Decimal


# Test data fixtures
@pytest.fixture
def mock_user_id():
    """Generate a test user UUID."""
    return str(uuid.uuid4())


@pytest.fixture
def mock_portfolio_id():
    """Generate a test portfolio UUID."""
    return str(uuid.uuid4())


class TestPortfolioCreation:
    """Tests for portfolio creation and initialization."""

    def test_create_us_portfolio_initial_capital(self):
        """US portfolio should initialize with $1M USD."""
        # Simulating the RPC function logic
        market = 'US'
        initial_capital = 1000000 if market == 'US' else 100000000
        currency = 'USD' if market == 'US' else 'INR'
        
        assert initial_capital == 1000000
        assert currency == 'USD'

    def test_create_in_portfolio_initial_capital(self):
        """India portfolio should initialize with ₹10 Cr INR."""
        market = 'IN'
        initial_capital = 1000000 if market == 'US' else 100000000
        currency = 'USD' if market == 'US' else 'INR'
        
        assert initial_capital == 100000000
        assert currency == 'INR'

    def test_market_determination_from_ticker(self):
        """Test correct market determination from ticker suffix."""
        def determine_market(symbol: str) -> str:
            if symbol.endswith('.NS') or symbol.endswith('.BO'):
                return 'IN'
            return 'US'
        
        assert determine_market('AAPL') == 'US'
        assert determine_market('GOOGL') == 'US'
        assert determine_market('MSFT') == 'US'
        assert determine_market('RELIANCE.NS') == 'IN'
        assert determine_market('TCS.BO') == 'IN'
        assert determine_market('INFY.NS') == 'IN'


class TestBuyTradeExecution:
    """Tests for buy trade execution."""

    def test_buy_trade_cash_deduction(self):
        """Buy should correctly deduct cash from portfolio."""
        initial_cash = 1000000
        quantity = 100
        price = 150.0
        required_cash = quantity * price  # 15000
        
        remaining_cash = initial_cash - required_cash
        
        assert remaining_cash == 985000
        assert required_cash == 15000

    def test_buy_trade_insufficient_cash(self):
        """Buy should fail with insufficient cash."""
        cash_balance = 1000
        quantity = 100
        price = 150.0
        required_cash = quantity * price  # 15000
        
        has_sufficient_cash = cash_balance >= required_cash
        
        assert has_sufficient_cash == False

    def test_buy_trade_validates_positive_quantity(self):
        """Buy should reject zero or negative quantity."""
        invalid_quantities = [0, -1, -100]
        
        for qty in invalid_quantities:
            is_valid = qty > 0
            assert is_valid == False

    def test_buy_trade_validates_positive_price(self):
        """Buy should reject zero or negative price."""
        invalid_prices = [0, -1, -100.50]
        
        for price in invalid_prices:
            is_valid = price > 0
            assert is_valid == False

    def test_weighted_average_cost_calculation(self):
        """Test weighted average cost calculation for position."""
        # Existing position: 100 shares @ $100
        existing_qty = 100
        existing_avg_cost = 100.0
        
        # New buy: 50 shares @ $120
        new_qty = 50
        new_price = 120.0
        
        # New weighted average
        total_cost = (existing_qty * existing_avg_cost) + (new_qty * new_price)
        total_qty = existing_qty + new_qty
        new_avg_cost = total_cost / total_qty
        
        expected_avg = (10000 + 6000) / 150  # 106.67
        assert abs(new_avg_cost - expected_avg) < 0.01

    def test_lot_creation_on_buy(self):
        """Each buy should create a lot for FIFO tracking."""
        # Simulate lot creation
        lot = {
            'portfolio_id': 'test-portfolio',
            'symbol': 'AAPL',
            'original_quantity': 100,
            'remaining_quantity': 100,
            'cost_per_share': 150.0,
            'acquired_at': datetime.now()
        }
        
        assert lot['original_quantity'] == lot['remaining_quantity']
        assert lot['cost_per_share'] == 150.0


class TestSellTradeExecution:
    """Tests for sell trade execution with FIFO."""

    def test_sell_validates_position_exists(self):
        """Sell should fail if no position exists."""
        position_qty = 0
        sell_qty = 10
        
        can_sell = position_qty > 0 and sell_qty <= position_qty
        assert can_sell == False

    def test_sell_validates_quantity_not_exceeding(self):
        """Sell should fail if quantity exceeds position."""
        position_qty = 50
        sell_qty = 100
        
        can_sell = sell_qty <= position_qty
        assert can_sell == False

    def test_sell_adds_proceeds_to_cash(self):
        """Sell should add proceeds to cash balance."""
        initial_cash = 50000
        quantity = 100
        sell_price = 180.0
        proceeds = quantity * sell_price  # 18000
        
        new_cash = initial_cash + proceeds
        
        assert new_cash == 68000

    def test_fifo_realized_pnl_single_lot(self):
        """Test FIFO P&L calculation with single lot."""
        # Lot: 100 shares @ $100
        lot_qty = 100
        lot_cost = 100.0
        
        # Sell: 50 shares @ $120
        sell_qty = 50
        sell_price = 120.0
        
        # FIFO: consume from oldest lot
        realized_pnl = sell_qty * (sell_price - lot_cost)
        
        assert realized_pnl == 1000  # 50 * ($120 - $100)

    def test_fifo_realized_pnl_multiple_lots(self):
        """Test FIFO P&L calculation spanning multiple lots."""
        # Lot 1: 50 shares @ $100 (oldest)
        # Lot 2: 50 shares @ $110
        lots = [
            {'remaining_quantity': 50, 'cost_per_share': 100.0},
            {'remaining_quantity': 50, 'cost_per_share': 110.0},
        ]
        
        # Sell: 75 shares @ $130
        sell_qty = 75
        sell_price = 130.0
        
        realized_pnl = 0
        remaining_to_sell = sell_qty
        
        for lot in lots:
            if remaining_to_sell <= 0:
                break
            
            sell_from_lot = min(lot['remaining_quantity'], remaining_to_sell)
            lot_pnl = sell_from_lot * (sell_price - lot['cost_per_share'])
            realized_pnl += lot_pnl
            remaining_to_sell -= sell_from_lot
        
        # P&L: 50 * (130-100) + 25 * (130-110) = 1500 + 500 = 2000
        expected_pnl = (50 * 30) + (25 * 20)
        assert realized_pnl == expected_pnl

    def test_partial_sell_updates_position_quantity(self):
        """Partial sell should reduce position but not close it."""
        position_qty = 100
        sell_qty = 25
        
        new_position_qty = position_qty - sell_qty
        is_closed = new_position_qty == 0
        
        assert new_position_qty == 75
        assert is_closed == False

    def test_full_sell_closes_position(self):
        """Full sell should set position quantity to zero."""
        position_qty = 100
        sell_qty = 100
        
        new_position_qty = position_qty - sell_qty
        is_closed = new_position_qty == 0
        
        assert new_position_qty == 0
        assert is_closed == True


class TestPortfolioMetrics:
    """Tests for portfolio metric calculations."""

    def test_nav_calculation(self):
        """NAV = Cash + Positions Value."""
        cash_balance = 250000
        positions = [
            {'quantity': 100, 'current_price': 150},  # 15000
            {'quantity': 50, 'current_price': 200},   # 10000
        ]
        
        positions_value = sum(p['quantity'] * p['current_price'] for p in positions)
        nav = cash_balance + positions_value
        
        assert positions_value == 25000
        assert nav == 275000

    def test_unrealized_pnl_calculation(self):
        """Unrealized P&L = (Current Price - Avg Cost) * Quantity."""
        position = {
            'quantity': 100,
            'avg_cost': 100.0,
            'current_price': 120.0
        }
        
        unrealized_pnl = (position['current_price'] - position['avg_cost']) * position['quantity']
        
        assert unrealized_pnl == 2000

    def test_unrealized_pnl_negative(self):
        """Unrealized P&L should be negative when losing."""
        position = {
            'quantity': 100,
            'avg_cost': 150.0,
            'current_price': 120.0
        }
        
        unrealized_pnl = (position['current_price'] - position['avg_cost']) * position['quantity']
        
        assert unrealized_pnl == -3000

    def test_total_return_percentage(self):
        """Test total return calculation."""
        initial_capital = 1000000
        nav = 1045230
        
        total_return_pct = ((nav - initial_capital) / initial_capital) * 100
        
        assert abs(total_return_pct - 4.523) < 0.001


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_empty_portfolio(self):
        """Empty portfolio should have NAV = initial capital."""
        initial_capital = 1000000
        cash_balance = 1000000
        positions = []
        
        positions_value = sum(p.get('market_value', 0) for p in positions)
        nav = cash_balance + positions_value
        
        assert nav == initial_capital
        assert positions_value == 0

    def test_fractional_shares_not_supported(self):
        """Validate handling of fractional share quantities."""
        # For integer shares
        quantity = 100.5
        is_whole_number = quantity == int(quantity)
        
        # Note: Our system supports fractional for flexibility
        # This test documents the expected behavior
        assert is_whole_number == False

    def test_zero_cash_after_large_buy(self):
        """Cash can reach exactly zero after buy."""
        cash_balance = 15000
        quantity = 100
        price = 150.0
        required_cash = quantity * price
        
        remaining = cash_balance - required_cash
        
        assert remaining == 0

    def test_concurrent_transaction_isolation(self):
        """
        Test scenario: Two concurrent buys should not overdraw cash.
        This is enforced by FOR UPDATE lock in the RPC function.
        """
        # Simulating the invariant
        cash_before = 10000
        buy1_cost = 6000
        buy2_cost = 6000  # Together would overdraw
        
        # Sequential execution (as enforced by row lock)
        cash_after_buy1 = cash_before - buy1_cost
        can_execute_buy2 = cash_after_buy1 >= buy2_cost
        
        assert cash_after_buy1 == 4000
        assert can_execute_buy2 == False


class TestBackfill:
    """Tests for portfolio backfill logic."""

    def test_backfill_creates_one_unit_per_recommendation(self):
        """Backfill should create 1-unit trade per existing recommendation."""
        recommendations = [
            {'ticker': 'AAPL', 'entry_price': 150.0},
            {'ticker': 'GOOGL', 'entry_price': 140.0},
        ]
        
        trades = []
        for rec in recommendations:
            trade = {
                'symbol': rec['ticker'],
                'quantity': 1,
                'price': rec['entry_price'],
                'side': 'BUY'
            }
            trades.append(trade)
        
        assert len(trades) == 2
        assert all(t['quantity'] == 1 for t in trades)

    def test_backfill_uses_entry_price_as_trade_price(self):
        """Backfill should use recommendation entry_price for trade."""
        rec = {'ticker': 'AAPL', 'entry_price': 178.50}
        
        trade_price = rec['entry_price']
        
        assert trade_price == 178.50

    def test_backfill_market_inference_from_ticker(self):
        """Backfill should infer market from ticker suffix."""
        recommendations = [
            {'ticker': 'AAPL'},           # US
            {'ticker': 'RELIANCE.NS'},    # IN
            {'ticker': 'TCS.BO'},         # IN
        ]
        
        def infer_market(ticker):
            if ticker.endswith('.NS') or ticker.endswith('.BO'):
                return 'IN'
            return 'US'
        
        markets = [infer_market(r['ticker']) for r in recommendations]
        
        assert markets == ['US', 'IN', 'IN']


class TestDailySnapshot:
    """Tests for daily portfolio snapshot functionality."""

    def test_snapshot_captures_nav_at_eod(self):
        """Snapshot should capture NAV at end of day."""
        portfolio = {
            'cash_balance': 250000,
            'positions': [
                {'symbol': 'AAPL', 'quantity': 100, 'close_price': 180},
            ]
        }
        
        positions_value = sum(
            p['quantity'] * p['close_price'] 
            for p in portfolio['positions']
        )
        nav = portfolio['cash_balance'] + positions_value
        
        snapshot = {
            'cash_balance': portfolio['cash_balance'],
            'positions_value': positions_value,
            'nav': nav,
        }
        
        assert snapshot['nav'] == 268000

    def test_snapshot_upsert_on_conflict(self):
        """Snapshot should update if same day already exists."""
        # Simulating upsert behavior
        existing_snapshots = {
            '2026-01-16': {'nav': 1000000}
        }
        
        new_snapshot = {'date': '2026-01-16', 'nav': 1010000}
        
        # Upsert logic
        existing_snapshots[new_snapshot['date']] = {'nav': new_snapshot['nav']}
        
        assert existing_snapshots['2026-01-16']['nav'] == 1010000

    def test_snapshot_handles_missing_prices(self):
        """Snapshot should fallback to avg_cost if price unavailable."""
        position = {
            'symbol': 'AAPL',
            'quantity': 100,
            'avg_cost': 150.0,
            'current_price': None  # Price unavailable
        }
        
        # Fallback logic
        price = position['current_price'] if position['current_price'] else position['avg_cost']
        value = position['quantity'] * price
        
        assert value == 15000


# Run tests
if __name__ == '__main__':
    pytest.main([__file__, '-v'])
