/**
 * Andryx Jump — costanti fisica + helpers AABB.
 *
 * Tutti i numeri sono in pixel logici / frame (60 fps target).
 */

export const PHYS = {
  /* Gravità */
  GRAVITY: 0.5,
  GRAVITY_WATER: 0.18,
  MAX_FALL: 11,
  MAX_FALL_WATER: 3,

  /* Salto */
  JUMP_VEL: -8.7,
  JUMP_RUN_BOOST: -0.6,        /* salto piu` alto durante la corsa */
  JUMP_VAR_CUT: 0.45,          /* moltiplica vy quando rilasci jump */
  COYOTE_FRAMES: 6,            /* frame dopo aver lasciato il bordo in cui puoi ancora saltare */
  JUMP_BUFFER_FRAMES: 6,       /* frame prima di toccare terra in cui un input di jump conta */

  /* Doppio salto (con piuma) */
  DOUBLE_JUMP_VEL: -7.4,

  /* Movimento orizzontale */
  WALK_SPEED: 2.4,
  RUN_SPEED: 4.1,
  ACCEL_GROUND: 0.32,
  ACCEL_AIR: 0.20,
  FRICTION_GROUND: 0.78,
  FRICTION_AIR: 0.94,
  FRICTION_ICE: 0.96,

  /* Stomp */
  STOMP_BOUNCE: -7.2,
  STOMP_BOUNCE_HOLD: -9.5,     /* se tieni jump, rimbalzi piu` alto */

  /* Fall-through one-way platforms (Down + Jump) */
  FALL_THROUGH_FRAMES: 8,

  /* Iframes dopo essere stato colpito */
  IFRAME_FRAMES: 90,
};

/** Restituisce true se due AABB si sovrappongono. */
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

/** Clamp di v fra lo e hi. */
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Sign ma con 0 → 0. */
export function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

/** Distanza euclidea quadrata. */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
