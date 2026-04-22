/**
 * Andryx Jump — costanti fisica + helpers AABB.
 * 60 fps target; tutte le velocita sono in pixel/frame.
 */

export const PHYS = {
  /* Gravita per fase del salto - tarate per feel "SMB classico" */
  GRAVITY_RISE: 0.40,           // salendo senza tenere il tasto
  GRAVITY_FALL: 0.85,           // cadendo (più reattivo)
  GRAVITY_FAST_FALL: 1.30,      // tieni giu
  MAX_FALL: 11,

  /* Salto variabile */
  JUMP_VEL: -9.6,               // salto base ~ 7 tile
  JUMP_VEL_RUN_BONUS: -1.2,     // se sta correndo, salto +X (Mario-style)
  JUMP_HOLD_FRAMES: 17,         // frame max in cui il tasto allunga il salto
  JUMP_HOLD_GRAVITY_FACTOR: 0.30, // gravity_rise * questo durante hold

  /* Coyote time + buffer (qualita di vita) */
  COYOTE_FRAMES: 7,
  JUMP_BUFFER_FRAMES: 10,

  /* Doppio salto (piuma) */
  DOUBLE_JUMP_VEL: -8.2,

  /* Movimento orizzontale - SMB-like (ma in pixel/frame, non subpixel) */
  WALK_SPEED: 2.6,
  RUN_SPEED: 5.2,
  ACCEL_GROUND: 0.24,
  ACCEL_RUN: 0.32,
  /* Friction "skid": meno sticky → vera scivolata Mario quando rilasci tasto */
  FRICTION_GROUND: 0.86,
  FRICTION_AIR: 0.97,           // quasi inerzia totale in aria
  FRICTION_ICE: 0.992,
  /* Skid forte se freni nel verso opposto al moto */
  SKID_DECEL: 0.35,

  /* Stomp rimbalzo */
  STOMP_BOUNCE: -5.0,
  STOMP_BOUNCE_HOLD: -9.0,

  /* Fall-through one-way platforms */
  FALL_THROUGH_FRAMES: 8,

  /* Iframes dopo danno */
  IFRAME_FRAMES: 120,

  /* Koopa shell */
  SHELL_SPEED: 7.0,

  /* Palla di fuoco */
  FIREBALL_VX: 5.0,
  FIREBALL_VY_INIT: -3.0,
  FIREBALL_GRAVITY: 0.35,
  FIREBALL_BOUNCE_VY: -4.5,
  FIREBALL_MAX_BOUNCES: 2,
};

/** True se due AABB si sovrappongono. */
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

/** Clamp di v fra lo e hi. */
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Segno con 0 → 0. */
export function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

/** Distanza euclidea quadrata. */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
