// Gemeinsame Zeichen-Helfer für die Jump'n'Run-Bildschirme (Entern, Inseln): Figuren mit Beinen, Bernstein-Stücke.
// Die Figuren kommen aus js/figure.js (Oberkörper als Bild), darunter Hose und Stiefel, die beim Laufen wippen.
window.SF = window.SF || {};

(function () {
  const INK = '#2a1d10';
  const imgs = {};

  // Figur als Bild (einmal erzeugt und gemerkt)
  function figure(code) {
    if (!imgs[code]) {
      const im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.figure.svg(code));
      imgs[code] = im;
    }
    return imgs[code];
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Figur zeichnen: (cx, by) = Mitte der Füße, face = Blickrichtung (1 oder −1), walking/air = läuft bzw. ist in der Luft
  function char(ctx, code, cx, by, face, size, walking, air, time) {
    const ph = time * 14 + cx * 0.05;
    const a = air ? 0.9 : walking ? Math.sin(ph) : 0;
    const lift = walking && !air ? Math.max(0, Math.cos(ph)) * 4 : 0;
    const lift2 = walking && !air ? Math.max(0, -Math.cos(ph)) * 4 : 0;
    const bob = walking && !air ? Math.abs(Math.sin(ph)) * 2 : 0;
    const k = size / 64;
    ctx.fillStyle = '#3d2e22';
    ctx.fillRect(cx - 9 * k, by - 20 * k, 18 * k, 12 * k);
    ctx.fillStyle = INK;
    rr(ctx, cx - 11 * k + a * 6 * k, by - 9 * k - lift, 11 * k, 9 * k, 3);
    ctx.fill();
    rr(ctx, cx - a * 6 * k, by - 9 * k - lift2, 11 * k, 9 * k, 3);
    ctx.fill();
    const im = figure(code);
    if (im.complete && im.naturalWidth) {
      ctx.save();
      ctx.translate(cx, by - 12 * k - bob);
      ctx.scale(face, 1);
      ctx.drawImage(im, -size / 2, -size + 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(cx - 14, by - 50, 28, 34);
    }
  }

  // Bernstein-Stück, das leicht schwebt und ab und zu funkelt
  function gem(ctx, cx, cy, time, seed = 0) {
    const y = cy + Math.sin(time * 4 + seed * 0.05) * 3;
    const g = ctx.createRadialGradient(cx - 4, y - 4, 1, cx, y, 12);
    g.addColorStop(0, '#fff1c0');
    g.addColorStop(0.45, '#ffc04a');
    g.addColorStop(1, '#d87a08');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, y, 10, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,40,0,.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (Math.sin(time * 6 + seed) > 0.6) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx + 6, y - 10, 2, 8);
      ctx.fillRect(cx + 3, y - 7, 8, 2);
    }
  }

  SF.sprite = { INK, figure, rr, char, gem };
})();
