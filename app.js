const imageInput = document.getElementById('imageInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');
const genderSelect = document.getElementById('gender');
const results = document.getElementById('results');
const sourcePreview = document.getElementById('sourcePreview');

const outfitDB = {
  female: [
    { name: 'Elegant Contrast', desc: 'Cream blouse + navy trousers + gold accents', top: [243,233,214], bottom:[35,55,97], accent:[209,169,84] },
    { name: 'Soft Chic', desc: 'Dusty rose top + charcoal skirt + pearl accents', top: [201,142,151], bottom:[64,68,73], accent:[220,219,214] },
    { name: 'Fresh Minimal', desc: 'Sage shirt + sand pants + bronze accents', top: [147,170,146], bottom:[210,191,158], accent:[135,99,63] }
  ],
  male: [
    { name: 'Urban Smart', desc: 'Steel blue shirt + black chinos + tan accents', top: [82,109,133], bottom:[37,40,45], accent:[175,128,84] },
    { name: 'Classic Refined', desc: 'Ivory shirt + navy trousers + burgundy accents', top: [240,234,221], bottom:[32,55,90], accent:[120,41,56] },
    { name: 'Modern Earth', desc: 'Olive jacket + stone pants + rust accents', top: [102,119,71], bottom:[194,183,161], accent:[165,87,56] }
  ],
  neutral: [
    { name: 'Balanced Monochrome', desc: 'Warm gray top + deep gray bottom + silver accents', top: [160,157,152], bottom:[78,81,84], accent:[181,185,190] },
    { name: 'Cool Harmony', desc: 'Muted teal top + slate bottom + soft white accents', top: [92,135,137], bottom:[71,84,94], accent:[233,236,238] },
    { name: 'Natural Blend', desc: 'Clay top + olive bottom + beige accents', top: [180,128,102], bottom:[97,108,80], accent:[224,208,183] }
  ]
};

function avgRGB(data, startX, startY, width, height, canvasWidth) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = startY; y < startY + height; y += 2) {
    for (let x = startX; x < startX + width; x += 2) {
      const idx = (y * canvasWidth + x) * 4;
      r += data[idx]; g += data[idx+1]; b += data[idx+2];
      count++;
    }
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

function dominantPalette(data) {
  const bins = new Map();
  for (let i = 0; i < data.length; i += 16) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  return [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k.split(',').map(Number));
}

function classifySkinTone([r, g, b]) {
  if (r > 185 && g > 150 && b > 130) return 'Light / Warm';
  if (r > 140 && g > 110 && b > 90) return 'Medium / Neutral';
  return 'Deep / Cool';
}

function classifyColorProfile(palette) {
  const sat = palette.map(([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) + 1));
  const avg = sat.reduce((a, v) => a + v, 0) / sat.length;
  if (avg > 0.42) return 'High-contrast vibrant';
  if (avg > 0.25) return 'Balanced natural';
  return 'Soft muted';
}

function drawPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(last[0], last[1], points[0][0], points[0][1]);
  ctx.closePath();
}

function applyFabricTexture(ctx, bounds, intensity = 0.16) {
  const [x, y, w, h] = bounds;
  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    const yy = y + (i / 39) * h;
    ctx.fillRect(x + Math.sin(i) * 3, yy, w, 1.2);
  }
  ctx.restore();
}

function drawRealisticGarment(ctx, baseImg, points, color, alpha, bounds) {
  const [r, g, b] = color;
  ctx.save();
  drawPath(ctx, points);
  ctx.clip();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);

  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.28;
  ctx.drawImage(baseImg, 0, 0);

  const grad = ctx.createLinearGradient(bounds[0], bounds[1], bounds[0], bounds[1] + bounds[3]);
  grad.addColorStop(0, 'rgba(255,255,255,0.28)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.23)');
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = grad;
  ctx.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);

  ctx.globalCompositeOperation = 'overlay';
  applyFabricTexture(ctx, bounds, 0.15);

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.1;
  drawPath(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function renderTryOn(baseImg, outfit) {
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.width;
  canvas.height = baseImg.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseImg, 0, 0);
  const w = canvas.width;
  const h = canvas.height;

  const topPts = [[0.27*w,0.24*h],[0.36*w,0.20*h],[0.64*w,0.20*h],[0.73*w,0.24*h],[0.67*w,0.58*h],[0.33*w,0.58*h]];
  const bottomPts = [[0.33*w,0.58*h],[0.67*w,0.58*h],[0.74*w,0.95*h],[0.60*w,0.98*h],[0.40*w,0.98*h],[0.26*w,0.95*h]];
  const accentPts = [[0.45*w,0.40*h],[0.55*w,0.40*h],[0.55*w,0.47*h],[0.45*w,0.47*h]];

  drawRealisticGarment(ctx, baseImg, topPts, outfit.top, 0.52, [0.25*w, 0.2*h, 0.5*w, 0.42*h]);
  drawRealisticGarment(ctx, baseImg, bottomPts, outfit.bottom, 0.55, [0.24*w, 0.56*h, 0.52*w, 0.42*h]);
  drawRealisticGarment(ctx, baseImg, accentPts, outfit.accent, 0.68, [0.45*w, 0.4*h, 0.1*w, 0.08*h]);

  return canvas;
}

function processImage(img) {
  sourcePreview.src = img.src;
  sourcePreview.classList.remove('hidden');

  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0);
  const { data } = octx.getImageData(0, 0, off.width, off.height);

  const faceColor = avgRGB(data, Math.floor(off.width * 0.35), Math.floor(off.height * 0.15), Math.floor(off.width * 0.3), Math.floor(off.height * 0.35), off.width);
  const aspect = off.width / off.height;

  document.getElementById('bodyType').textContent = aspect > 0.62 ? 'Broad frame' : (aspect < 0.42 ? 'Slim frame' : 'Balanced frame');
  document.getElementById('bodyProportion').textContent = aspect > 0.58 ? 'Upper body dominant' : (aspect < 0.45 ? 'Lower body dominant' : 'Even proportions');
  document.getElementById('faceShape').textContent = aspect > 0.85 ? 'Round' : (aspect < 0.65 ? 'Long / Oblong' : 'Oval');
  document.getElementById('skinTone').textContent = classifySkinTone(faceColor);

  const palette = dominantPalette(data);
  document.getElementById('colorProfile').textContent = classifyColorProfile(palette);

  const paletteDiv = document.getElementById('palette');
  paletteDiv.innerHTML = '';
  palette.forEach((c) => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = `rgb(${c.join(',')})`;
    paletteDiv.appendChild(swatch);
  });

  const outfits = outfitDB[genderSelect.value];
  const outfitList = document.getElementById('outfitList');
  outfitList.innerHTML = '';
  outfits.forEach((o) => {
    const li = document.createElement('li');
    li.textContent = `${o.name} — ${o.desc}`;
    outfitList.appendChild(li);
  });

  const tryOn = document.getElementById('tryOnGrid');
  tryOn.innerHTML = '';
  outfits.forEach((o) => {
    const wrap = document.createElement('div');
    wrap.className = 'tryon-item';
    const title = document.createElement('h4');
    title.textContent = o.name;
    wrap.appendChild(title);
    wrap.appendChild(renderTryOn(img, o));
    tryOn.appendChild(wrap);
  });

  results.classList.remove('hidden');
}

analyzeBtn.addEventListener('click', () => {
  const file = imageInput.files?.[0];
  if (!file) return alert('Please upload an image first or use demo image.');
  const img = new Image();
  img.onload = () => processImage(img);
  img.src = URL.createObjectURL(file);
});

demoBtn.addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 520;
  const ctx = c.getContext('2d');
  const back = ctx.createLinearGradient(0, 0, 0, c.height);
  back.addColorStop(0, 'rgb(216,198,180)');
  back.addColorStop(1, 'rgb(197,176,155)');
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgb(238,213,191)';
  ctx.beginPath();
  ctx.ellipse(180, 85, 42, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgb(88,100,119)';
  ctx.beginPath();
  ctx.roundRect(120, 132, 120, 225, 40);
  ctx.fill();
  ctx.fillStyle = 'rgb(58,66,79)';
  ctx.fillRect(128, 355, 45, 150);
  ctx.fillRect(188, 355, 45, 150);
  const img = new Image();
  img.onload = () => processImage(img);
  img.src = c.toDataURL('image/png');
});
