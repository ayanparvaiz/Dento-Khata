// Tutorial video registry. The overview video is live now; per-section videos will be
// recorded later — drop their YouTube IDs in and they light up automatically.
export interface Tutorial {
  key: string;
  title: string; // Bangla label shown to the clinic
  desc: string;
  videoId?: string; // undefined = "coming soon"
}

// Main "how to use the whole system" walkthrough.
export const OVERVIEW_VIDEO_ID = 'jFBJq74gU9I';

export const TUTORIALS: Tutorial[] = [
  { key: 'overview', title: 'সম্পূর্ণ পরিচিতি', desc: 'পুরো সিস্টেম কীভাবে ব্যবহার করবেন — শুরু থেকে শেষ', videoId: OVERVIEW_VIDEO_ID },
  { key: 'patients', title: 'রোগী ব্যবস্থাপনা', desc: 'রোগী যোগ, খোঁজা ও তথ্য সংরক্ষণ' },
  { key: 'appointments', title: 'অ্যাপয়েন্টমেন্ট', desc: 'অ্যাপয়েন্টমেন্ট নেওয়া ও ক্যালেন্ডার' },
  { key: 'charting', title: 'ডেন্টাল চার্ট', desc: 'দাঁতের অবস্থা চার্টে মার্ক করা' },
  { key: 'prescription', title: 'প্রেসক্রিপশন', desc: 'বাংলা প্রেসক্রিপশন তৈরি ও প্রিন্ট' },
  { key: 'billing', title: 'বিলিং ও পেমেন্ট', desc: 'চার্জ, পেমেন্ট ও বাকির হিসাব' },
  { key: 'reports', title: 'রিপোর্ট', desc: 'দৈনিক/মাসিক আয় ও রিপোর্ট' },
];

export const ytEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
export const ytThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
