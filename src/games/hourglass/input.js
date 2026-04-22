/**
 * Andryx Hourglass — Input adapter sui ref standard di GamePage.
 *
 * GamePage espone:
 *   – keysRef.current[key]      → bool, mappa tastiera (WASD/frecce/SPAZIO/I/P/Esc/B…)
 *   – joystickRef.current        → { active, dx, dy } normalizzato a [-1..1]
 *   – actionBtnRef.current       → flag edge-trigger (true = una pressione)
 *   – inventoryBtnRef.current    → flag edge-trigger
 *   – potionBtnRef.current       → flag edge-trigger
 *
 * Inoltre GamePage polla la Gamepad API e mappa pad → keysRef + actionBtnRef.
 * Quindi ricevendo questi 5 ref noi supportiamo automaticamente:
 *   – Tastiera (WASD/frecce + SPAZIO/Enter + I/Tab/M + P + Esc + B)
 *   – Touchscreen (joystick virtuale + bottoni A/Inventario/Pozione)
 *   – Mouse (i bottoni HTML emettono actionBtnRef pulses)
 *   – Gamepad (mappato a tastiera virtuale dal poll esterno)
 *
 * Questa classe normalizza il tutto in:
 *   – move() → {dx,dy} normalizzato (combinato keys+joystick)
 *   – isAction() → edge-trigger SPAZIO/A/Enter/actionBtn
 *   – isSecondary() → edge-trigger B/X (per usare oggetto equipaggiato)
 *   – isInventoryToggled() → edge-trigger I/Tab/M/inventoryBtn
 *   – isPotionUsed() → edge-trigger P/potionBtn
 *   – isPauseToggled() → edge-trigger Esc
 */

export class InputAdapter {
  constructor({ keysRef, joystickRef, actionBtnRef, inventoryBtnRef, potionBtnRef, secondaryBtnRef }) {
    this.keys = keysRef || { current: {} };
    this.joy  = joystickRef || { current: { active: false, dx: 0, dy: 0 } };
    this.actionBtn = actionBtnRef || { current: false };
    this.inventoryBtn = inventoryBtnRef || { current: false };
    this.potionBtn = potionBtnRef || { current: false };
    this.secondaryBtn = secondaryBtnRef || { current: false };

    this._prev = {};
    this._edges = {};
    /* Ad ogni update aggiorniamo gli edge per questi tasti monitorati */
    this._monitored = [
      ' ', 'Enter', 'z', 'Z',
      'i', 'I', 'Tab', 'm', 'M',
      'p', 'P',
      'Escape',
      'b', 'B', 'x', 'X',
    ];
  }

  /** Da chiamare a inizio update di ogni frame. */
  poll() {
    const k = this.keys.current || {};
    for (const key of this._monitored) {
      const cur = !!k[key];
      const wasDown = !!this._prev[key];
      this._edges[key] = (cur && !wasDown);
      this._prev[key] = cur;
    }
  }

  _consume(keysList) {
    for (const k of keysList) {
      if (this._edges[k]) { this._edges[k] = false; return true; }
    }
    return false;
  }
  _consumeBtn(ref) {
    if (ref && ref.current) { ref.current = false; return true; }
    return false;
  }

  /** Movement normalizzato. Combinato joystick (analogico) + tastiera (digitale).
   *  Il joystick prevale se attivo (così su mobile non interferiscono i tasti virtuali). */
  move() {
    const j = this.joy.current || {};
    if (j.active && (Math.abs(j.dx) > 0.12 || Math.abs(j.dy) > 0.12)) {
      return { dx: j.dx, dy: j.dy };
    }
    const k = this.keys.current || {};
    let dx = 0, dy = 0;
    if (k.ArrowUp    || k.w || k.W) dy -= 1;
    if (k.ArrowDown  || k.s || k.S) dy += 1;
    if (k.ArrowLeft  || k.a || k.A) dx -= 1;
    if (k.ArrowRight || k.d || k.D) dx += 1;
    if (dx && dy) { const m = Math.SQRT1_2; dx *= m; dy *= m; }
    return { dx, dy };
  }

  /** Direzione cardinale corrente (per facing player). null = fermo. */
  facingFromMove() {
    const { dx, dy } = this.move();
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  /** Azione primaria (attacco/conferma/skip dialogo). */
  isAction() {
    return this._consume([' ', 'Enter', 'z', 'Z']) || this._consumeBtn(this.actionBtn);
  }

  /** Azione secondaria (usa item equipaggiato — boomerang/bombe/arco). */
  isSecondary() {
    return this._consume(['b', 'B', 'x', 'X']) || this._consumeBtn(this.secondaryBtn);
  }

  isInventoryToggled() {
    return this._consume(['i', 'I', 'Tab', 'm', 'M']) || this._consumeBtn(this.inventoryBtn);
  }

  isPotionUsed() {
    return this._consume(['p', 'P']) || this._consumeBtn(this.potionBtn);
  }

  isPauseToggled() {
    return this._consume(['Escape']);
  }
}
