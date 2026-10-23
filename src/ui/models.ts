export interface CareService {
  id: number;
  name: string;
  description: string;
  price: number;
  icon: string;
  active?: number;
}

export interface SiteConfig {
  bookingEnabled?: boolean;
  phone?: string;
  email?: string;
  whatsapp?: string;
  hours?: string;
}

export const serviceImages: Record<string, { src: string; alt: string }> = {
  baby: { src: 'images/maternal.jpg', alt: 'A mother holding her newborn close' },
  heart: { src: 'images/nursing.jpg', alt: 'An older adult reviewing his daily care with a healthcare professional' },
  bandage: { src: 'care.jpg', alt: 'A caregiver offering hands-on support to an older woman' },
  activity: { src: 'images/monitoring.jpg', alt: 'A healthcare professional checking a patient’s blood pressure' },
  shield: { src: 'images/consultation.jpg', alt: 'A healthcare professional listening during a private consultation' },
  home: { src: 'images/home-care.jpg', alt: 'An older adult receiving support in a familiar home environment' },
};

export function serviceImage(service: CareService) {
  return serviceImages[service.icon] || serviceImages['home'];
}

export function formatRand(cents: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
}
