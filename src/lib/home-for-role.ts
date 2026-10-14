import type { Session } from '@/lib/auth';

/**
 * Where "home" is for the person currently signed in (brief item #11).
 *
 * A printer who taps the logo expects their dashboard, not the customer storefront. Dropping
 * them into the customer view made it look as though their session had been forgotten, which
 * is alarming when you have money and orders on the platform.
 *
 * Deliberately NOT applied to the /products or /marketplace links — a printer may genuinely
 * want to shop, so only the logo and the Home link follow their role.
 */
export function homeForRole(role: Session['role'] | undefined): string {
  switch (role) {
    case 'printer': return '/dashboard';
    case 'designer': return '/studio';
    case 'admin': return '/admin';
    default: return '/';
  }
}

/** Label for the logo's accessible name, so the destination is never a surprise. */
export function homeLabelForRole(role: Session['role'] | undefined): string {
  switch (role) {
    case 'printer': return 'Print Runs — your dashboard';
    case 'designer': return 'Print Runs — your studio';
    case 'admin': return 'Print Runs — admin';
    default: return 'Print Runs — home';
  }
}
