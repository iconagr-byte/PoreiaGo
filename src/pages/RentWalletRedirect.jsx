/**
 * Legacy /rent/wallet → unified My Wallet rentals tab.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { UNIFIED_WALLET_RENTALS_PATH } from '../lib/wallet/unifiedWalletPaths.js';

export default function RentWalletRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={UNIFIED_WALLET_RENTALS_PATH}
      replace
      state={{
        ...(location.state || {}),
        walletTab: 'rentals',
        openRentWallet: true,
      }}
    />
  );
}
