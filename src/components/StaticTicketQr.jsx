import TicketQrCode from './TicketQrCode.jsx';

/** QR εισιτηρίου πελάτη — rotating JWT ή bt1 fallback (σαρώσιμο από driver). */
export default function StaticTicketQr(props) {
  return <TicketQrCode {...props} />;
}
