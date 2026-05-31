import { TreatmentTab } from '@/components/TreatmentTab';
import { BillingTab } from '@/components/BillingTab';
import type { Patient } from '@/lib/patients';

// One tab: plan procedures (total = the charge/due) → collect payment in installments below.
export function TreatmentBillingTab({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">Treatment plan</h2>
        <TreatmentTab patientId={patient.id} patientName={patient.fullName} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Account &amp; payments</h2>
        <BillingTab patient={patient} />
      </section>
    </div>
  );
}
