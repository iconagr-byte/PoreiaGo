import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { Toaster } from 'react-hot-toast';
import { captureRentalInstallPrompt, setupRentalPwa } from './lib/rental/registerRentalPwa.js';
import HomePage from './pages/HomePage.jsx';
import StorefrontDemoPage from './pages/StorefrontDemoPage';
import BackOffice from './pages/BackOffice';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import SeatSelection from './pages/SeatSelection';
import TripDetails from './pages/TripDetails';
import SimpleWalletPage from './pages/SimpleWalletPage.jsx';
import WalletMagicPage from './pages/WalletMagicPage.jsx';
import RentalCustomerApp from './pages/RentalCustomerApp.jsx';
import InBusPortal from './pages/InBusPortal';
import PassengerTrackPage from './pages/PassengerTrackPage.jsx';
import RentalShareTrackPage from './pages/RentalShareTrackPage.jsx';
import DriverScan from './pages/DriverScan';
import DriverCommandCenter from './pages/driver/DriverCommandCenter';
import DriverAuthPage from './pages/driver/DriverAuthPage.jsx';
import FleetVehicleDetail from './pages/FleetVehicleDetail';
import TripEditorPage from './pages/admin/TripEditorPage';
import DriverDetailPage from './pages/admin/DriverDetailPage';
import DriverFormPage from './pages/admin/DriverFormPage.jsx';
import RentalVehicleFormPage from './pages/admin/RentalVehicleFormPage.jsx';
import PlatformAdminRedirect from './pages/admin/PlatformAdminRedirect';
import TourLeaderLuggagePage from './pages/tour/TourLeaderLuggagePage.jsx';
import SharedItineraryPage from './pages/tour/SharedItineraryPage.jsx';
import PassengerSelfCheckinPage from './pages/tour/PassengerSelfCheckinPage.jsx';
import PartnerItineraryPage from './pages/tour/PartnerItineraryPage.jsx';
import PartnerLoginPage from './pages/partner/PartnerLoginPage.jsx';
import PartnerPortalPage from './pages/partner/PartnerPortalPage.jsx';
import AgencyPlansPage from './pages/AgencyPlansPage';
import AgencySignupPage from './pages/AgencySignupPage';
import AgencySignupSuccessPage from './pages/AgencySignupSuccessPage';
import CheckoutPage from './pages/CheckoutPage';
import BookingLookupPage from './pages/BookingLookupPage';
import CheckoutResumePage from './pages/CheckoutResumePage';
import TicketPrintPage from './pages/TicketPrintPage.jsx';
import FiscalReceiptPrintPage from './pages/FiscalReceiptPrintPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import BrandingBoot from './components/BrandingBoot.jsx';
import MaintenanceGate from './components/MaintenanceGate.jsx';

function RentalPwaBoot() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname || '';
    // Capture BIP as early as possible; register SW only on /rent so guests can install.
    captureRentalInstallPrompt();
    if (path === '/rent' || path.startsWith('/rent/')) {
      setupRentalPwa();
    }
  }, []);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <BrandingBoot />
        <RentalPwaBoot />
        <MaintenanceGate>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/ticket/print/:bookingId" element={<TicketPrintPage />} />
            <Route path="/wallet/receipt/:bookingId" element={<FiscalReceiptPrintPage />} />
            <Route path="/wallet/magic" element={<WalletMagicPage />} />
            <Route path="/wallet" element={<SimpleWalletPage />} />
            {/* Rent auth lives on /rent (share URL). /rent/login is an alias only. */}
            <Route path="/rent/login" element={<Navigate to="/rent" replace />} />
            <Route path="/rent/register" element={<RegisterPage />} />
            <Route path="/rent" element={<RentalCustomerApp />} />
            <Route path="/rent/*" element={<RentalCustomerApp />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/storefront" element={<StorefrontDemoPage />} />
            <Route path="/grafeia" element={<AgencyPlansPage />} />
            <Route path="/grafeia/signup" element={<AgencySignupPage />} />
            <Route path="/grafeia/signup/success" element={<AgencySignupSuccessPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/my-booking" element={<BookingLookupPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<BackOffice />} />
            <Route path="/admin/platform" element={<PlatformAdminRedirect />} />
            <Route path="/admin/fleet/:vehicleId" element={<FleetVehicleDetail />} />
            <Route path="/admin/fleet-rental/vehicles/new" element={<RentalVehicleFormPage />} />
            <Route
              path="/admin/fleet-rental/vehicles/:vehicleId/edit"
              element={<RentalVehicleFormPage />}
            />
            <Route path="/admin/trips/:tripId" element={<TripEditorPage />} />
            <Route path="/tour-leader/:tripId" element={<TourLeaderLuggagePage />} />
            <Route path="/itinerary/share" element={<SharedItineraryPage />} />
            <Route path="/itinerary/:tripId" element={<SharedItineraryPage />} />
            <Route path="/passenger-checkin" element={<PassengerSelfCheckinPage />} />
            <Route path="/partner/itinerary" element={<PartnerItineraryPage />} />
            <Route path="/partner/login" element={<PartnerLoginPage />} />
            <Route path="/partner/portal" element={<PartnerPortalPage />} />
            <Route path="/admin/drivers/new" element={<DriverFormPage />} />
            <Route path="/admin/drivers/:driverId/edit" element={<DriverFormPage />} />
            <Route path="/admin/drivers/:driverId" element={<DriverDetailPage />} />
            <Route path="/driver/auth" element={<DriverAuthPage />} />
            {/* Alias only — login UI lives in-place on /driver. */}
            <Route path="/driver/login" element={<Navigate to="/driver" replace />} />
            <Route path="/driver/dashboard" element={<Navigate to="/driver" replace />} />
            <Route path="/driver" element={<DriverCommandCenter />} />
            <Route path="/driver/scan" element={<DriverScan />} />
            <Route path="/select-seat/:tripId" element={<SeatSelection />} />
            <Route path="/select-seat" element={<SeatSelection />} />
            <Route path="/trip/:id" element={<TripDetails />} />
            <Route path="/checkout/:tripId" element={<CheckoutPage />} />
            <Route path="/checkout/resume/:token" element={<CheckoutResumePage />} />
            <Route path="/in-bus" element={<InBusPortal />} />
            <Route path="/track/trip/:tripId" element={<PassengerTrackPage />} />
            <Route path="/track/rental/:bookingId" element={<RentalShareTrackPage />} />
          </Routes>
        </MaintenanceGate>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
