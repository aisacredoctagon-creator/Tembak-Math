// Kontrol: sentuh / mouse (drag kiri-kanan) dan keyboard (panah, A/D, Esc/P/Spasi untuk jeda).
import { CFG } from './config.js';

export class Input {
  /**
   * @param {HTMLElement} el elemen yang menerima drag (area game)
   * @param {{onPause: () => void, canPause: () => boolean, onChoice: (n: number) => void, onHint: () => void}} hooks
   */
  constructor(el, hooks) {
    this.el = el;
    this.hooks = hooks;
    this.target = 0; // posisi pistol yang diinginkan: -1 .. 1
    this.enabled = false;
    this.unitsPerPixel = 1 / 200; // diisi lewat setScale()
    this.keys = { left: false, right: false };
    this.pointerId = null;
    this.lastX = 0;

    el.addEventListener('pointerdown', (e) => this._down(e));
    el.addEventListener('pointermove', (e) => this._move(e));
    el.addEventListener('pointerup', (e) => this._up(e));
    el.addEventListener('pointercancel', (e) => this._up(e));
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.releaseKeys());
  }

  /** Konversi piksel layar -> lebar jalur. `cssWidth` = lebar area game dalam piksel CSS. */
  setScale(cssWidth, roadHalfWidthLogical, logicalWidth) {
    const logicalPerPixel = logicalWidth / cssWidth;
    this.unitsPerPixel = (logicalPerPixel / roadHalfWidthLogical) * CFG.pointerGain;
  }

  reset() {
    this.target = 0;
    this.releaseKeys();
    this.pointerId = null;
  }

  releaseKeys() {
    this.keys.left = this.keys.right = false;
  }

  update(dt) {
    const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (dir) this.target += dir * CFG.keySpeed * dt;
    this.target = Math.max(-CFG.maxX, Math.min(CFG.maxX, this.target));
  }

  _down(e) {
    if (!this.enabled || e.target.closest('button')) return;
    this.pointerId = e.pointerId;
    this.lastX = e.clientX;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* diabaikan */
    }
  }

  _move(e) {
    if (!this.enabled || e.pointerId !== this.pointerId) return;
    this.target += (e.clientX - this.lastX) * this.unitsPerPixel;
    this.lastX = e.clientX;
    this.target = Math.max(-CFG.maxX, Math.min(CFG.maxX, this.target));
  }

  _up(e) {
    if (e.pointerId === this.pointerId) this.pointerId = null;
  }

  _key(e, down) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      this.keys.left = down;
      if (this.enabled) e.preventDefault();
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      this.keys.right = down;
      if (this.enabled) e.preventDefault();
    } else if (down && !e.repeat && k >= '1' && k <= '3' && k.length === 1) {
      this.hooks.onChoice(Number(k) - 1); // tombol angka memilih gerbang / jawaban boss
    } else if (down && !e.repeat && (k === 'h' || k === 'H')) {
      this.hooks.onHint();
    } else if (down && !e.repeat && (k === 'Escape' || k === 'p' || k === 'P' || k === ' ')) {
      if (this.hooks.canPause()) {
        e.preventDefault();
        this.hooks.onPause();
      }
    }
  }
}
