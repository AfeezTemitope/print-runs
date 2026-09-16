/**
 * Preflight pricing (Module 3 §7).
 *
 * Free for every order at launch, no exceptions. The fee hook exists now because adding a
 * payment step to a live flow later is harder than building it in and setting it to zero —
 * so switching the paid tier on becomes a one-line change here, not a rework of checkout.
 *
 * "Send directly to printer" is free always, whatever this is set to.
 */
export const PREFLIGHT_FEE_KOBO = 0;
