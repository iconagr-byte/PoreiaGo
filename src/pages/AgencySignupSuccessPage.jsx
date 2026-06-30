import { Link, useSearchParams } from 'react-router-dom';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';

export default function AgencySignupSuccessPage() {
  const [searchParams] = useSearchParams();
  const billingOk = searchParams.get('billing') === 'success';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <PlatformBrand variant="light" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6 rounded-[32px] border border-black/[0.06] bg-white shadow-lg p-8 md:p-10">
          <span className="material-symbols-outlined text-5xl text-emerald-600">check_circle</span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {billingOk ? 'Η πληρωμία ολοκληρώθηκε!' : 'Ευχαριστούμε!'}
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {billingOk
                ? 'Δημιουργούμε το γραφείο σας (tenant, admin, συνδρομή). Σε λίγα δευτερόλεπτα μπορείτε να συνδεθείτε με το email και τον κωδικό που ορίσατε.'
                : 'Η εγγραφή σας καταχωρήθηκε. Συνδεθείτε στο Control Panel όταν λάβετε email επιβεβαίωσης.'}
            </p>
          </div>

          <div className="rounded-2xl bg-surface-container-low p-4 text-left text-sm text-on-surface-variant space-y-2">
            <p className="font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">login</span>
              Επόμενο βήμα
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Περιμένετε 10–30 δευτ. για provisioning (webhook Stripe)</li>
              <li>Συνδεθείτε με το admin email της εγγραφής</li>
              <li>Χρησιμοποιήστε τον subdomain ως κωδικό γραφείου αν ζητηθεί</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90"
            >
              Σύνδεση Control Panel
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
            <Link
              to="/grafeia"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-full border border-gray-200 font-bold text-sm hover:bg-gray-50"
            >
              Συμβόλαια
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
