import { ForbiddenException } from '@nestjs/common';

// Thrown when a clinic (tenant) is disabled by the super-admin. Blocks login AND any
// active session immediately. Carries a support number so the UI can show a contact popup.
export function clinicSuspended(): ForbiddenException {
  return new ForbiddenException({
    code: 'CLINIC_SUSPENDED',
    message: 'আপনার ক্লিনিক অ্যাকাউন্ট সাময়িকভাবে বন্ধ করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।',
    whatsapp: process.env.SUPPORT_WHATSAPP || '',
  });
}
