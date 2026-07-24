/**
 * WhatsApp Business approved-style message templates for hybrid delays.
 */

export const WHATSAPP_TEMPLATES = [
  {
    id: 'flight_delay_pickup',
    name: 'Καθυστέρηση πτήσης → νέο pickup',
    body: 'PoreiaGo: Η πτήση {{flight_number}} έχει καθυστέρηση +{{delay_minutes}}′. Νέα ώρα pickup: {{pickup_time}}. {{trip_title}}',
  },
  {
    id: 'connection_risk',
    name: 'Προειδοποίηση σύνδεσης',
    body: 'PoreiaGo: Στενή σύνδεση στην εκδρομή {{trip_title}} ({{layover_minutes}}′). Παρακαλούμε είστε έγκαιρα στο σημείο συνάντησης.',
  },
  {
    id: 'self_checkin_invite',
    name: 'Πρόσκληση self check-in',
    body: 'PoreiaGo: Επιβεβαιώστε παρουσία & αποσκευές για {{trip_title}}: {{checkin_url}}',
  },
];

export function renderWhatsAppTemplate(templateId, vars = {}) {
  const tpl = WHATSAPP_TEMPLATES.find((t) => t.id === templateId) || WHATSAPP_TEMPLATES[0];
  return tpl.body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null || v === '' ? '—' : String(v);
  });
}

export function listWhatsAppTemplates() {
  return WHATSAPP_TEMPLATES;
}
