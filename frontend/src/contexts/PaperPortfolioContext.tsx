/**
 * Paper Portfolio Context
 *
 * One shared answer to "should this user see share quantities and paper NAV?",
 * driven by `organizations.paper_portfolio_enabled`.
 *
 * It exists as a context rather than a hook call per component because the
 * answer gates network requests as well as rendering. The paper-portfolio
 * endpoints price every open position through an uncached yfinance lookup, so
 * the goal is for an opted-out organization to never issue those requests at
 * all -- which means every consumer has to agree, from one fetch.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useOrganization } from '../hooks/useOrganization';

interface PaperPortfolioContextType {
  /** Show quantity inputs, share counts, paper trades and NAV. */
  paperPortfolioEnabled: boolean;
  /** False while auth or the organization row is still resolving. */
  ready: boolean;
}

const PaperPortfolioContext = createContext<PaperPortfolioContextType>({
  paperPortfolioEnabled: false,
  ready: false,
});

export function PaperPortfolioProvider({ children }: { children: ReactNode }) {
  // useOrganization stays loading until auth has resolved too, so its flag is
  // the whole readiness signal. Calling useAuth here as well would spin up a
  // second instance of its Clerk/Supabase sync for nothing.
  const { organization, loading } = useOrganization();

  const value = useMemo<PaperPortfolioContextType>(() => {
    // Withheld until we know. Erring the other way would fire the NAV request
    // we are trying to avoid, and would flash quantity fields that then vanish
    // for an opted-out organization. The organization row is a single indexed
    // Supabase read; the request it gates is far slower, so waiting costs
    // nothing worth having.
    if (loading) {
      return { paperPortfolioEnabled: false, ready: false };
    }

    // No organization means a solo user, who keeps the paper portfolio.
    return {
      paperPortfolioEnabled: organization ? organization.paperPortfolioEnabled : true,
      ready: true,
    };
  }, [loading, organization]);

  return (
    <PaperPortfolioContext.Provider value={value}>
      {children}
    </PaperPortfolioContext.Provider>
  );
}

export function usePaperPortfolio() {
  return useContext(PaperPortfolioContext);
}
