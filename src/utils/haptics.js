/**
 * Haptic feedback utilities for native-like touch experience.
 * Uses the Vibration API where available, degrades gracefully.
 */

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/** Light tap — tab switch, toggle, chip press */
export function hapticLight() {
  if (canVibrate) navigator.vibrate(8);
}

/** Medium tap — button press, card tap */
export function hapticMedium() {
  if (canVibrate) navigator.vibrate(15);
}

/** Success — score submit, achievement */
export function hapticSuccess() {
  if (canVibrate) navigator.vibrate([10, 30, 10]);
}

/** Error — failed action */
export function hapticError() {
  if (canVibrate) navigator.vibrate([15, 50, 15, 50, 15]);
}
