-- Migration: Add Paper Trading Portfolio System
-- Created: 2026-01-16
-- Description: Implements full brokerage-like portfolio with positions, trades, FIFO lots, and daily snapshots

-- ============================================================================
-- 1. PORTFOLIOS TABLE (One per user per market)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portfolios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  market text NOT NULL CHECK (market IN ('US', 'IN')),
  base_currency text NOT NULL CHECK (base_currency IN ('USD', 'INR')),
  initial_capital numeric NOT NULL,
  cash_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, market)
);

COMMENT ON TABLE public.portfolios IS 'Paper trading portfolios - one per user per market (US/IN)';
COMMENT ON COLUMN public.portfolios.market IS 'US = United States, IN = India';
COMMENT ON COLUMN public.portfolios.initial_capital IS 'Starting capital: $1M for US, ₹10Cr for IN';

-- ============================================================================
-- 2. PORTFOLIO POSITIONS TABLE (Aggregated position per symbol)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_positions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  exchange text,
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  realized_pnl numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(portfolio_id, symbol)
);

COMMENT ON TABLE public.portfolio_positions IS 'Current holdings per symbol in a portfolio';
COMMENT ON COLUMN public.portfolio_positions.avg_cost IS 'Weighted average cost basis per share';
COMMENT ON COLUMN public.portfolio_positions.realized_pnl IS 'Cumulative realized P&L from sells on this position';

-- ============================================================================
-- 3. PORTFOLIO TRADES TABLE (Immutable trade ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  symbol text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL CHECK (price > 0),
  notional numeric GENERATED ALWAYS AS (quantity * price) STORED,
  executed_at timestamptz NOT NULL DEFAULT now(),
  price_source text, -- 'realtime', 'close', 'fallback_current', 'entry_price'
  realized_pnl numeric, -- Only populated for SELL trades
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.portfolio_trades IS 'Immutable trade history - all buys and sells';
COMMENT ON COLUMN public.portfolio_trades.price_source IS 'Where the execution price came from';
COMMENT ON COLUMN public.portfolio_trades.realized_pnl IS 'P&L realized on this trade (SELL only)';

-- ============================================================================
-- 4. PORTFOLIO TRADE LOTS TABLE (FIFO lot tracking for cost basis)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_trade_lots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  buy_trade_id uuid REFERENCES public.portfolio_trades(id) ON DELETE CASCADE NOT NULL,
  original_quantity numeric NOT NULL,
  remaining_quantity numeric NOT NULL,
  cost_per_share numeric NOT NULL,
  acquired_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CHECK (remaining_quantity >= 0 AND remaining_quantity <= original_quantity)
);

COMMENT ON TABLE public.portfolio_trade_lots IS 'FIFO lot tracking for accurate cost basis and P&L calculation';
COMMENT ON COLUMN public.portfolio_trade_lots.remaining_quantity IS 'Shares remaining in this lot (decremented on sells)';

-- ============================================================================
-- 5. PORTFOLIO DAILY SNAPSHOTS TABLE (EOD NAV history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_daily_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  cash_balance numeric NOT NULL,
  positions_value numeric NOT NULL,
  nav numeric NOT NULL,
  realized_pnl_to_date numeric NOT NULL DEFAULT 0,
  unrealized_pnl numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(portfolio_id, snapshot_date)
);

COMMENT ON TABLE public.portfolio_daily_snapshots IS 'End-of-day portfolio valuations for performance tracking';
COMMENT ON COLUMN public.portfolio_daily_snapshots.nav IS 'Net Asset Value = cash_balance + positions_value';

-- ============================================================================
-- 6. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_portfolio_id ON public.portfolio_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_portfolio_id_executed_at ON public.portfolio_trades(portfolio_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_symbol ON public.portfolio_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_portfolio_trade_lots_symbol_remaining ON public.portfolio_trade_lots(portfolio_id, symbol) WHERE remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_portfolio_date ON public.portfolio_daily_snapshots(portfolio_id, snapshot_date DESC);

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_trade_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Portfolios: users can view their own, service role has full access
CREATE POLICY "Users can view own portfolios" ON public.portfolios
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role full access to portfolios" ON public.portfolios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Positions: via portfolio join
CREATE POLICY "Users can view own positions" ON public.portfolio_positions
  FOR SELECT USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to positions" ON public.portfolio_positions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trades: via portfolio join
CREATE POLICY "Users can view own trades" ON public.portfolio_trades
  FOR SELECT USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to trades" ON public.portfolio_trades
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lots: via portfolio join
CREATE POLICY "Users can view own lots" ON public.portfolio_trade_lots
  FOR SELECT USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to lots" ON public.portfolio_trade_lots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Snapshots: via portfolio join
CREATE POLICY "Users can view own snapshots" ON public.portfolio_daily_snapshots
  FOR SELECT USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to snapshots" ON public.portfolio_daily_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. TRIGGERS FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_portfolio_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_portfolios_updated_at ON public.portfolios;
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION update_portfolio_updated_at();

DROP TRIGGER IF EXISTS update_portfolio_positions_updated_at ON public.portfolio_positions;
CREATE TRIGGER update_portfolio_positions_updated_at
  BEFORE UPDATE ON public.portfolio_positions
  FOR EACH ROW EXECUTE FUNCTION update_portfolio_updated_at();

-- ============================================================================
-- 9. RPC FUNCTIONS
-- ============================================================================

-- 9.1 create_or_get_portfolio: Creates a portfolio for user/market if not exists
DROP FUNCTION IF EXISTS public.create_or_get_portfolio(uuid, text);
CREATE OR REPLACE FUNCTION public.create_or_get_portfolio(
  p_user_id uuid,
  p_market text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio_id uuid;
  v_initial_capital numeric;
  v_currency text;
  v_result jsonb;
BEGIN
  -- Determine initial capital based on market
  IF p_market = 'US' THEN
    v_initial_capital := 1000000;  -- $1M USD
    v_currency := 'USD';
  ELSIF p_market = 'IN' THEN
    v_initial_capital := 100000000; -- ₹10 Cr INR
    v_currency := 'INR';
  ELSE
    RAISE EXCEPTION 'Invalid market: %. Must be US or IN', p_market;
  END IF;

  -- Try to get existing portfolio
  SELECT id INTO v_portfolio_id
  FROM public.portfolios
  WHERE user_id = p_user_id AND market = p_market;

  -- Create if not exists
  IF v_portfolio_id IS NULL THEN
    INSERT INTO public.portfolios (user_id, market, base_currency, initial_capital, cash_balance)
    VALUES (p_user_id, p_market, v_currency, v_initial_capital, v_initial_capital)
    RETURNING id INTO v_portfolio_id;
  END IF;

  -- Return portfolio data
  SELECT row_to_json(p.*)::jsonb INTO v_result
  FROM public.portfolios p
  WHERE p.id = v_portfolio_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_or_get_portfolio IS 'Gets existing portfolio or creates new one with initial capital based on market';

-- 9.2 execute_buy: Executes a buy trade with FIFO lot tracking
DROP FUNCTION IF EXISTS public.execute_buy(uuid, text, numeric, numeric, text, uuid);
CREATE OR REPLACE FUNCTION public.execute_buy(
  p_portfolio_id uuid,
  p_symbol text,
  p_quantity numeric,
  p_price numeric,
  p_price_source text DEFAULT 'realtime',
  p_recommendation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio portfolios%ROWTYPE;
  v_required_cash numeric;
  v_trade_id uuid;
  v_current_qty numeric;
  v_current_avg_cost numeric;
  v_new_avg_cost numeric;
  v_result jsonb;
BEGIN
  -- Lock portfolio row to prevent concurrent modifications
  SELECT * INTO v_portfolio
  FROM public.portfolios
  WHERE id = p_portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found: %', p_portfolio_id;
  END IF;

  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive, got: %', p_quantity;
  END IF;
  IF p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be positive, got: %', p_price;
  END IF;

  v_required_cash := p_quantity * p_price;

  IF v_portfolio.cash_balance < v_required_cash THEN
    RAISE EXCEPTION 'Insufficient cash. Required: %, Available: %', v_required_cash, v_portfolio.cash_balance;
  END IF;

  -- Insert trade record
  INSERT INTO public.portfolio_trades (portfolio_id, recommendation_id, side, symbol, quantity, price, price_source, executed_at)
  VALUES (p_portfolio_id, p_recommendation_id, 'BUY', p_symbol, p_quantity, p_price, p_price_source, now())
  RETURNING id INTO v_trade_id;

  -- Insert lot for FIFO tracking
  INSERT INTO public.portfolio_trade_lots (portfolio_id, symbol, buy_trade_id, original_quantity, remaining_quantity, cost_per_share, acquired_at)
  VALUES (p_portfolio_id, p_symbol, v_trade_id, p_quantity, p_quantity, p_price, now());

  -- Get current position for weighted average cost calculation
  SELECT quantity, avg_cost INTO v_current_qty, v_current_avg_cost
  FROM public.portfolio_positions
  WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;

  IF v_current_qty IS NULL THEN
    v_current_qty := 0;
    v_current_avg_cost := 0;
  END IF;

  -- Calculate new weighted average cost
  v_new_avg_cost := CASE
    WHEN v_current_qty + p_quantity = 0 THEN 0
    ELSE ((v_current_qty * v_current_avg_cost) + (p_quantity * p_price)) / (v_current_qty + p_quantity)
  END;

  -- Upsert position
  INSERT INTO public.portfolio_positions (portfolio_id, symbol, quantity, avg_cost)
  VALUES (p_portfolio_id, p_symbol, p_quantity, p_price)
  ON CONFLICT (portfolio_id, symbol) DO UPDATE SET
    quantity = portfolio_positions.quantity + p_quantity,
    avg_cost = v_new_avg_cost,
    updated_at = now();

  -- Decrement cash balance
  UPDATE public.portfolios
  SET cash_balance = cash_balance - v_required_cash, updated_at = now()
  WHERE id = p_portfolio_id;

  -- Return result
  SELECT jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'symbol', p_symbol,
    'side', 'BUY',
    'quantity', p_quantity,
    'price', p_price,
    'notional', v_required_cash,
    'cash_remaining', v_portfolio.cash_balance - v_required_cash
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.execute_buy IS 'Executes a buy trade, creates lot for FIFO tracking, updates position and cash';

-- 9.3 execute_sell: Executes a sell trade with FIFO P&L calculation
DROP FUNCTION IF EXISTS public.execute_sell(uuid, text, numeric, numeric, text);
CREATE OR REPLACE FUNCTION public.execute_sell(
  p_portfolio_id uuid,
  p_symbol text,
  p_quantity numeric,
  p_price numeric,
  p_price_source text DEFAULT 'realtime'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio portfolios%ROWTYPE;
  v_position portfolio_positions%ROWTYPE;
  v_trade_id uuid;
  v_realized_pnl numeric := 0;
  v_remaining_to_sell numeric;
  v_lot RECORD;
  v_sell_from_lot numeric;
  v_lot_pnl numeric;
  v_proceeds numeric;
  v_result jsonb;
BEGIN
  -- Lock portfolio row
  SELECT * INTO v_portfolio
  FROM public.portfolios
  WHERE id = p_portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found: %', p_portfolio_id;
  END IF;

  -- Get and lock position
  SELECT * INTO v_position
  FROM public.portfolio_positions
  WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol
  FOR UPDATE;

  IF NOT FOUND OR v_position.quantity <= 0 THEN
    RAISE EXCEPTION 'No position in %', p_symbol;
  END IF;

  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive, got: %', p_quantity;
  END IF;

  IF p_quantity > v_position.quantity THEN
    RAISE EXCEPTION 'Cannot sell % shares, only % available', p_quantity, v_position.quantity;
  END IF;

  v_proceeds := p_quantity * p_price;
  v_remaining_to_sell := p_quantity;

  -- FIFO: consume lots oldest first
  FOR v_lot IN
    SELECT * FROM public.portfolio_trade_lots
    WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol AND remaining_quantity > 0
    ORDER BY acquired_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_sell <= 0;

    v_sell_from_lot := LEAST(v_lot.remaining_quantity, v_remaining_to_sell);
    v_lot_pnl := v_sell_from_lot * (p_price - v_lot.cost_per_share);
    v_realized_pnl := v_realized_pnl + v_lot_pnl;

    UPDATE public.portfolio_trade_lots
    SET remaining_quantity = remaining_quantity - v_sell_from_lot
    WHERE id = v_lot.id;

    v_remaining_to_sell := v_remaining_to_sell - v_sell_from_lot;
  END LOOP;

  -- Insert sell trade with realized P&L
  INSERT INTO public.portfolio_trades (portfolio_id, side, symbol, quantity, price, price_source, realized_pnl, executed_at)
  VALUES (p_portfolio_id, 'SELL', p_symbol, p_quantity, p_price, p_price_source, v_realized_pnl, now())
  RETURNING id INTO v_trade_id;

  -- Update position (reduce quantity, add to realized P&L)
  UPDATE public.portfolio_positions
  SET
    quantity = quantity - p_quantity,
    realized_pnl = realized_pnl + v_realized_pnl,
    updated_at = now()
  WHERE id = v_position.id;

  -- Increment cash balance
  UPDATE public.portfolios
  SET cash_balance = cash_balance + v_proceeds, updated_at = now()
  WHERE id = p_portfolio_id;

  -- Return result
  SELECT jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'symbol', p_symbol,
    'side', 'SELL',
    'quantity', p_quantity,
    'price', p_price,
    'proceeds', v_proceeds,
    'realized_pnl', v_realized_pnl,
    'cash_balance', v_portfolio.cash_balance + v_proceeds
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.execute_sell IS 'Executes a sell trade with FIFO cost basis, calculates realized P&L';

-- 9.4 create_daily_snapshots: Creates EOD snapshots for all portfolios
DROP FUNCTION IF EXISTS public.create_daily_snapshots();
CREATE OR REPLACE FUNCTION public.create_daily_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio RECORD;
  v_position RECORD;
  v_positions_value numeric;
  v_unrealized_pnl numeric;
  v_realized_pnl numeric;
  v_nav numeric;
  v_snapshot_date date := CURRENT_DATE;
  v_count int := 0;
BEGIN
  FOR v_portfolio IN SELECT * FROM public.portfolios
  LOOP
    v_positions_value := 0;
    v_unrealized_pnl := 0;
    v_realized_pnl := 0;

    FOR v_position IN
      SELECT * FROM public.portfolio_positions
      WHERE portfolio_id = v_portfolio.id AND quantity > 0
    LOOP
      -- Note: In production, this should use actual close prices
      -- For now, use avg_cost as a placeholder (positions_value based on cost)
      -- The Edge Function will update with real prices
      v_positions_value := v_positions_value + (v_position.quantity * v_position.avg_cost);
      v_realized_pnl := v_realized_pnl + v_position.realized_pnl;
    END LOOP;

    v_nav := v_portfolio.cash_balance + v_positions_value;

    INSERT INTO public.portfolio_daily_snapshots (
      portfolio_id, snapshot_date, cash_balance, positions_value, nav, realized_pnl_to_date, unrealized_pnl
    ) VALUES (
      v_portfolio.id, v_snapshot_date, v_portfolio.cash_balance, v_positions_value, v_nav, v_realized_pnl, v_unrealized_pnl
    )
    ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
      cash_balance = EXCLUDED.cash_balance,
      positions_value = EXCLUDED.positions_value,
      nav = EXCLUDED.nav,
      realized_pnl_to_date = EXCLUDED.realized_pnl_to_date,
      unrealized_pnl = EXCLUDED.unrealized_pnl;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('snapshots_created', v_count, 'date', v_snapshot_date);
END;
$$;

COMMENT ON FUNCTION public.create_daily_snapshots IS 'Creates end-of-day NAV snapshots for all portfolios';

-- 9.5 backfill_portfolios_from_recommendations: Migrates existing recommendations to portfolios
DROP FUNCTION IF EXISTS public.backfill_portfolios_from_recommendations();
CREATE OR REPLACE FUNCTION public.backfill_portfolios_from_recommendations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_rec RECORD;
  v_portfolio_id uuid;
  v_market text;
  v_price numeric;
  v_price_source text;
  v_count int := 0;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  -- Process each user with OPEN recommendations
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.recommendations WHERE status = 'OPEN'
  LOOP
    -- Process each recommendation for this user
    FOR v_rec IN
      SELECT * FROM public.recommendations
      WHERE user_id = v_user.user_id AND status = 'OPEN'
      ORDER BY entry_date ASC
    LOOP
      BEGIN
        -- Determine market from ticker suffix
        IF v_rec.ticker LIKE '%.NS' OR v_rec.ticker LIKE '%.BO' THEN
          v_market := 'IN';
        ELSE
          v_market := 'US';
        END IF;

        -- Create or get portfolio for this user/market
        SELECT (public.create_or_get_portfolio(v_user.user_id, v_market))->>'id' INTO v_portfolio_id;

        -- Use entry_price as the buy price, with fallback
        v_price := COALESCE(v_rec.entry_price, 100);
        v_price_source := CASE WHEN v_rec.entry_price IS NOT NULL THEN 'entry_price' ELSE 'fallback' END;

        -- Execute buy for 1 unit
        PERFORM public.execute_buy(
          v_portfolio_id::uuid,
          v_rec.ticker,
          1, -- 1 unit per existing recommendation
          v_price,
          v_price_source,
          v_rec.id
        );

        v_count := v_count + 1;

      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue processing
        v_errors := array_append(v_errors, format('Error processing rec %s: %s', v_rec.id, SQLERRM));
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'backfilled_trades', v_count,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

COMMENT ON FUNCTION public.backfill_portfolios_from_recommendations IS 'One-time migration: creates portfolios and 1-unit trades for all existing OPEN recommendations';

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.create_or_get_portfolio(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_portfolio(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_buy(uuid, text, numeric, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_buy(uuid, text, numeric, numeric, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_sell(uuid, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sell(uuid, text, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_daily_snapshots() TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_portfolios_from_recommendations() TO service_role;
