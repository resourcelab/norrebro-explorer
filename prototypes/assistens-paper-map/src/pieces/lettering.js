/**
 * Lettering on paper pieces (street signs, fingerposts). drawnPiece draws in units with y up, so text is drawn in a
 * small flipped frame: 1 unit = 100 px of font, the right way up.
 */
let measurer = null;

const FONT = (px) => `700 ${px}px "Helvetica Neue", Arial, sans-serif`;

/** Width of `text` in units at `size` units tall. */
export function textWidth(text, size) {
  measurer ??= document.createElement('canvas').getContext('2d');
  measurer.font = FONT(100);
  return (measurer.measureText(text).width / 100) * size;
}

/** Draw `text` centred at (x, y) (units, y up), `size` units tall, in colour `fill`. */
export function letter(g, text, x, y, size, fill) {
  g.save();
  g.translate(x, y);
  g.scale(size / 100, -size / 100);
  g.font = FONT(100);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}
