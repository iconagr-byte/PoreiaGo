import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { Toaster } from 'react-hot-toast';
import FrontPage from './pages/FrontPage';
import StorefrontDemoPage from './pages/StorefrontDemoPage';
import BackOffice from './pages/BackOffice';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import SeatSelection from './pages/SeatSelection';
import TripDetails from './pages/TripDetails';
import SimpleWalletPage from './pages/SimpleWalletPage.jsx';
import InBusPortal from './pages/InBusPortal';
import PassengerTrackPage from './pages/PassengerTrackPage.jsx';
import DriverScan from './pages/DriverScan';
import DriverCommandCenter from './pages/driver/DriverCommandCenter';
import DriverAuthPage from './pages/driver/DriverAuthPage.jsx';
import FleetVehicleDetail from './pages/FleetVehicleDetail';
import TripEditorPage from './pages/admin/TripEditorPage';
import DriverDetailPage from './pages/admin/DriverDetailPage';
import PlatformAdminRedirect from './pages/admin/PlatformAdminRedirect';
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

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <BrandingBoot />
        <MaintenanceGate>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/ticket/print/:bookingId" element={<TicketPrintPage />} />
            <Route path="/wallet/receipt/:bookingId" element={<FiscalReceiptPrintPage />} />
            <Route path="/ticket/demo" element={<Navigate to="/ticket/print/demo" replace />} />
            <Route path="/wallet" element={<SimpleWalletPage />} />
            <Route path="/" element={<FrontPage />} />
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
            <Route path="/admin/trips/:tripId" element={<TripEditorPage />} />
            <Route path="/admin/drivers/:driverId" element={<DriverDetailPage />} />
            <Route path="/driver/auth" element={<DriverAuthPage />} />
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
          </Routes>
        </MaintenanceGate>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
