/**
 * CAPITANÍA ATLAS — Monterrey, Nuevo León y Área Metropolitana
 * - Mapa interactivo gestionado directamente en la misma página (Google Maps & Waze Live).
 * - Selección simple e interactiva entre Sedán y SUV (ocupación de hasta 4 usuarios cada uno).
 * - Casillas de Origen y Destino inicialmente vacías con vinculación rápida al mapa de Monterrey y Área Metropolitana.
 * - Cálculo interno de tarifa ($25/km Sedán, $35/km SUV) sin mostrar el cobro por kilómetro en pantalla.
 * - Desplegables de Fecha y Hora sin enunciados superiores.
 */

(() => {
  'use strict';

  const FLEET_DATA = {
    sedan: {
      id: 'sedan',
      name: 'Sedán',
      passengers: 'Hasta 4 usuarios',
      ratePerKm: 25, // Uso interno para cálculo
      image: 'assets/mg5-gris.png',
      accentRgb: [56, 189, 248]
    },
    suv: {
      id: 'suv',
      name: 'SUV',
      passengers: 'Hasta 4 usuarios',
      ratePerKm: 35, // Uso interno para cálculo
      image: 'assets/vw-atlas-negra.png',
      accentRgb: [212, 175, 55]
    }
  };

  let selectedVehicleId = 'sedan';
  let activeMapEngine = 'gmaps'; // 'gmaps' | 'waze' — ambos visualizados dentro de la misma página
  let currentRouteKm = 0;

  // =========================================================================
  // 1. ANIMATED TRANSPORTATION BACKGROUND ENGINE (HTML5 CANVAS)
  // =========================================================================
  const canvas = document.getElementById('transportation-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
  const fleetTraffic = [];
  const gpsRoutes = [];
  const hubs = [
    { rx: 0.16, ry: 0.32, pulse: 0 },
    { rx: 0.5, ry: 0.25, pulse: 1.2 },
    { rx: 0.84, ry: 0.36, pulse: 2.5 },
    { rx: 0.28, ry: 0.72, pulse: 0.8 },
    { rx: 0.74, ry: 0.72, pulse: 1.9 }
  ];

  let selectionShockwave = { active: false, radius: 0, alpha: 0, color: '212, 175, 55' };
  let gridScrollOffset = 0;

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initRoutesAndTraffic();
  }

  function initRoutesAndTraffic() {
    gpsRoutes.length = 0;
    fleetTraffic.length = 0;

    const routeConfigs = [
      {
        p0: { x: width * 0.04, y: height * 0.78 },
        p1: { x: width * 0.34, y: height * 0.42 },
        p2: { x: width * 0.66, y: height * 0.62 },
        p3: { x: width * 0.96, y: height * 0.24 },
        primary: true
      },
      {
        p0: { x: width * 0.1, y: height * 0.24 },
        p1: { x: width * 0.45, y: height * 0.18 },
        p2: { x: width * 0.58, y: height * 0.54 },
        p3: { x: width * 0.92, y: height * 0.68 },
        primary: false
      },
      {
        p0: { x: width * 0.02, y: height * 0.52 },
        p1: { x: width * 0.28, y: height * 0.75 },
        p2: { x: width * 0.72, y: height * 0.22 },
        p3: { x: width * 0.98, y: height * 0.48 },
        primary: false
      },
      {
        p0: { x: width * 0.24, y: height * 0.94 },
        p1: { x: width * 0.48, y: height * 0.58 },
        p2: { x: width * 0.52, y: height * 0.34 },
        p3: { x: width * 0.82, y: height * 0.08 },
        primary: true
      }
    ];

    routeConfigs.forEach((rc, idx) => gpsRoutes.push({ ...rc, id: idx }));

    for (let i = 0; i < 18; i++) {
      fleetTraffic.push({
        routeIndex: i % gpsRoutes.length,
        t: (i / 18 + Math.random() * 0.15) % 1,
        speed: 0.0006 + Math.random() * 0.00065,
        isGold: i % 2 === 0,
        trailLength: 0.06 + Math.random() * 0.04
      });
    }
  }

  function getBezierPoint(t, p0, p1, p2, p3) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  function renderTransportationBackground(timestamp) {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    pointer.x += (pointer.targetX - pointer.x) * 0.05;
    pointer.y += (pointer.targetY - pointer.y) * 0.05;

    const shiftX = (pointer.x - 0.5) * 32;
    const shiftY = (pointer.y - 0.5) * 20;
    const horizonY = height * 0.42 + shiftY * 0.4;

    const bgGrad = ctx.createRadialGradient(
      width * 0.5 + shiftX,
      horizonY,
      10,
      width * 0.5,
      horizonY,
      Math.max(width, height) * 0.85
    );

    if (selectedVehicleId === 'sedan') {
      bgGrad.addColorStop(0, 'rgba(18, 42, 68, 0.36)');
      bgGrad.addColorStop(0.5, 'rgba(10, 18, 32, 0.2)');
      bgGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
    } else if (selectedVehicleId === 'suv') {
      bgGrad.addColorStop(0, 'rgba(62, 46, 14, 0.36)');
      bgGrad.addColorStop(0.5, 'rgba(20, 16, 10, 0.2)');
      bgGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
    } else {
      bgGrad.addColorStop(0, 'rgba(24, 34, 54, 0.28)');
      bgGrad.addColorStop(0.5, 'rgba(10, 15, 26, 0.16)');
      bgGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    gridScrollOffset = (gridScrollOffset + 0.7) % 48;
    const vanishX = width * 0.5 + shiftX * 1.1;
    const vanishY = horizonY;

    ctx.save();
    ctx.lineWidth = 1;
    const laneCount = 16;
    for (let i = -laneCount; i <= laneCount; i++) {
      const spread = (i / laneCount) * (width * 1.35);
      const isCenterHighway = Math.abs(i) <= 2;
      ctx.strokeStyle = isCenterHighway
        ? 'rgba(212, 175, 55, 0.18)'
        : 'rgba(56, 189, 248, 0.065)';
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(vanishX + spread, height + 40);
      ctx.stroke();
    }

    for (let step = 1; step <= 14; step++) {
      const progress = (step * 48 + gridScrollOffset) / (14 * 48);
      const curvedP = Math.pow(progress, 2.1);
      const yPos = vanishY + curvedP * (height - vanishY + 30);
      if (yPos > vanishY && yPos <= height) {
        const alpha = Math.min(0.22, curvedP * 0.28);
        ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(width, yPos);
        ctx.stroke();
      }
    }
    ctx.restore();

    gpsRoutes.forEach((route) => {
      const p0 = { x: route.p0.x + shiftX * 0.4, y: route.p0.y + shiftY * 0.4 };
      const p1 = { x: route.p1.x - shiftX * 0.3, y: route.p1.y + shiftY * 0.3 };
      const p2 = { x: route.p2.x + shiftX * 0.3, y: route.p2.y - shiftY * 0.3 };
      const p3 = { x: route.p3.x - shiftX * 0.4, y: route.p3.y - shiftY * 0.4 };

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.lineWidth = route.primary ? 2.2 : 1.2;
      ctx.strokeStyle = route.primary
        ? 'rgba(212, 175, 55, 0.24)'
        : 'rgba(56, 189, 248, 0.14)';
      ctx.stroke();

      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -(timestamp * 0.03);
      ctx.lineWidth = 1;
      ctx.strokeStyle = route.primary
        ? 'rgba(246, 231, 193, 0.32)'
        : 'rgba(56, 189, 248, 0.22)';
      ctx.stroke();
      ctx.restore();
    });

    fleetTraffic.forEach((car) => {
      const route = gpsRoutes[car.routeIndex];
      if (!route) return;

      const speedBoost = selectedVehicleId ? 1.4 : 1;
      car.t = (car.t + car.speed * speedBoost) % 1;

      const p0 = { x: route.p0.x + shiftX * 0.4, y: route.p0.y + shiftY * 0.4 };
      const p1 = { x: route.p1.x - shiftX * 0.3, y: route.p1.y + shiftY * 0.3 };
      const p2 = { x: route.p2.x + shiftX * 0.3, y: route.p2.y - shiftY * 0.3 };
      const p3 = { x: route.p3.x - shiftX * 0.4, y: route.p3.y - shiftY * 0.4 };

      const segments = 10;
      for (let s = 0; s < segments; s++) {
        const tA = Math.max(0, car.t - (s / segments) * car.trailLength);
        const tB = Math.max(0, car.t - ((s + 1) / segments) * car.trailLength);
        const ptA = getBezierPoint(tA, p0, p1, p2, p3);
        const ptB = getBezierPoint(tB, p0, p1, p2, p3);

        const segAlpha = (1 - s / segments) * 0.72;
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.lineWidth = 2.6 * (1 - s / segments);
        ctx.strokeStyle = car.isGold
          ? `rgba(212, 175, 55, ${segAlpha})`
          : `rgba(56, 189, 248, ${segAlpha})`;
        ctx.stroke();
      }

      const pos = getBezierPoint(car.t, p0, p1, p2, p3);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = car.isGold ? '#f6e7c1' : '#bae6fd';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = car.isGold
        ? 'rgba(212, 175, 55, 0.22)'
        : 'rgba(56, 189, 248, 0.22)';
      ctx.fill();
    });

    hubs.forEach((hub) => {
      hub.pulse = (hub.pulse + 0.025) % (Math.PI * 2);
      const hx = width * hub.rx + shiftX * 0.5;
      const hy = height * hub.ry + shiftY * 0.5;
      const pulseRadius = 6 + ((Math.sin(hub.pulse) + 1) * 0.5) * 15;
      const pulseAlpha = 0.42 - ((Math.sin(hub.pulse) + 1) * 0.5) * 0.34;

      ctx.beginPath();
      ctx.arc(hx, hy, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(212, 175, 55, ${pulseAlpha})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#d4af37';
      ctx.fill();
    });

    if (selectionShockwave.active) {
      selectionShockwave.radius += 26;
      selectionShockwave.alpha *= 0.94;

      ctx.save();
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, selectionShockwave.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${selectionShockwave.color}, ${selectionShockwave.alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      if (selectionShockwave.alpha < 0.02) {
        selectionShockwave.active = false;
      }
    }

    requestAnimationFrame(renderTransportationBackground);
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('pointermove', (e) => {
    pointer.targetX = e.clientX / Math.max(1, width);
    pointer.targetY = e.clientY / Math.max(1, height);
  });

  resizeCanvas();
  requestAnimationFrame(renderTransportationBackground);

  // =========================================================================
  // 2. IN-PAGE MAP (GOOGLE MAPS & WAZE), MONTERREY ADDRESSES & FARE ENGINE
  // =========================================================================
  const originInput = document.getElementById('origin-input');
  const destinationInput = document.getElementById('destination-input');
  const originSuggestions = document.getElementById('origin-suggestions');
  const destinationSuggestions = document.getElementById('destination-suggestions');
  const useGpsBtn = document.getElementById('use-gps-btn');

  const calcDistanceDisplay = document.getElementById('calc-distance-display');
  const routeCalcStatus = document.getElementById('route-calc-status');
  const calcUnitTypeLabel = document.getElementById('calc-unit-type-label');
  const calcTotalDisplay = document.getElementById('calc-total-display');
  const submitBtnLabel = document.getElementById('submit-btn-label');

  const gmapsEmbedFrame = document.getElementById('gmaps-embed-frame');
  const mapEngineTabs = document.querySelectorAll('[data-map-engine]');

  // Coordenadas iniciales: Monterrey, Nuevo León
  const MTY_CENTER = { lat: 25.6866, lon: -100.3161 };

  // Directorio del Área Metropolitana de Monterrey
  const MTY_METRO_DIRECTORY = [
    {
      label: 'Aeropuerto Internacional de Monterrey (MTY), Apodaca, N.L.',
      match: /aeropuerto|mty|oma|terminal a|terminal b|terminal c|fbo/i,
      lat: 25.7785,
      lon: -100.1069
    },
    {
      label: 'San Pedro Garza García, Calzada del Valle, N.L.',
      match: /san pedro|calzada del valle|centrito|del valle/i,
      lat: 25.6572,
      lon: -100.3694
    },
    {
      label: 'Valle Oriente / Av. Lázaro Cárdenas, San Pedro Garza García, N.L.',
      match: /valle oriente|lazaro cardenas|fashion drive|metropolitan|safi/i,
      lat: 25.649,
      lon: -100.3352
    },
    {
      label: 'Centro de Monterrey / Macroplaza, Monterrey, N.L.',
      match: /centro|macroplaza|zaragoza|barrio antiguo|palacio de gobierno/i,
      lat: 25.6692,
      lon: -100.3099
    },
    {
      label: 'Pabellón M / Av. Constitución, Monterrey, N.L.',
      match: /pabellon m|constitucion|juarez|melchor ocampo/i,
      lat: 25.6656,
      lon: -100.3168
    },
    {
      label: 'Parque Fundidora / Cintermex, Monterrey, N.L.',
      match: /fundidora|cintermex|arena monterrey|paseo santa lucia/i,
      lat: 25.6785,
      lon: -100.2842
    },
    {
      label: 'Obispado / Av. Hidalgo, Monterrey, N.L.',
      match: /obispado|hidalgo|top obispado|chepevera|maria luisa/i,
      lat: 25.6731,
      lon: -100.3468
    },
    {
      label: 'Tecnológico de Monterrey / Av. Eugenio Garza Sada, Monterrey, N.L.',
      match: /tec|tecnologico|garza sada|contry/i,
      lat: 25.6514,
      lon: -100.2895
    },
    {
      label: 'Cumbres / Paseo de los Leones, Monterrey, N.L.',
      match: /cumbres|leones|paseo de los leones|puerta de hierro|gonzalitos/i,
      lat: 25.7189,
      lon: -100.3951
    },
    {
      label: 'Carretera Nacional / Esfera, Monterrey, N.L.',
      match: /carretera nacional|esfera|pueblo serena|la rioja|el uro/i,
      lat: 25.5762,
      lon: -100.2448
    },
    {
      label: 'San Nicolás de los Garza / Av. Universidad, N.L.',
      match: /san nicolas|universidad|anahuac|uanl/i,
      lat: 25.7417,
      lon: -100.3025
    },
    {
      label: 'Guadalupe / Av. Benito Juárez, N.L.',
      match: /guadalupe|estadio bbva|expo guadalupe|linda vista/i,
      lat: 25.6768,
      lon: -100.2565
    },
    {
      label: 'Apodaca / Parque Industrial, N.L.',
      match: /apodaca|miguel aleman|concordia/i,
      lat: 25.7805,
      lon: -100.1869
    },
    {
      label: 'Santa Catarina / Blvd. Díaz Ordaz, N.L.',
      match: /santa catarina|diaz ordaz|huasteca|via cordillera/i,
      lat: 25.6733,
      lon: -100.4581
    },
    {
      label: 'General Escobedo / Av. Sendero, N.L.',
      match: /escobedo|sendero|raul salinas/i,
      lat: 25.7964,
      lon: -100.3198
    },
    {
      label: 'Santiago / Presa de la Boca, N.L.',
      match: /santiago|presa de la boca|los cavazos/i,
      lat: 25.4264,
      lon: -100.1518
    }
  ];

  let resolvedOriginCoords = null;
  let resolvedDestCoords = null;

  function formatMXN(amount) {
    return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  }

  function getActiveVehicle() {
    return FLEET_DATA[selectedVehicleId] || FLEET_DATA.sedan;
  }

  function contextualizeMtyAddress(rawAddress) {
    const clean = (rawAddress || '').trim();
    if (!clean) return 'Monterrey, Nuevo León, México';
    if (/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(clean)) {
      return clean;
    }
    if (/monterrey|nuevo le[oó]n|n\.?\s*l\.?|san pedro|apodaca|guadalupe|san nicol[aá]s|santa catarina|escobedo|santiago/i.test(clean)) {
      return clean;
    }
    return `${clean}, Monterrey, Nuevo León, México`;
  }

  function updateFareCalculation() {
    const vehicle = getActiveVehicle();
    const originVal = originInput?.value.trim() || '';
    const destVal = destinationInput?.value.trim() || '';

    if (!originVal || !destVal || currentRouteKm <= 0) {
      if (calcDistanceDisplay) calcDistanceDisplay.textContent = '0.0 km';
      if (calcTotalDisplay) calcTotalDisplay.textContent = '$0.00 MXN';
      if (calcUnitTypeLabel) calcUnitTypeLabel.textContent = `Unidad: ${vehicle.name}`;
      if (submitBtnLabel) submitBtnLabel.textContent = 'Confirmar y Agendar Trayecto';
      return { km: 0, total: 0 };
    }

    const total = currentRouteKm * vehicle.ratePerKm;

    if (calcDistanceDisplay) {
      calcDistanceDisplay.textContent = `${currentRouteKm.toFixed(1)} km`;
    }
    if (calcUnitTypeLabel) {
      calcUnitTypeLabel.textContent = `Cotización en ${vehicle.name}`;
    }
    if (calcTotalDisplay) {
      calcTotalDisplay.textContent = formatMXN(total);
    }
    if (submitBtnLabel) {
      submitBtnLabel.textContent = `Confirmar y Agendar Trayecto (${formatMXN(total)})`;
    }

    return { km: currentRouteKm, total };
  }

  function resolveMtyLocalCoords(query) {
    if (!query) return null;
    const coordMatch = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      return { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) };
    }
    for (const item of MTY_METRO_DIRECTORY) {
      if (item.match.test(query) || query.toLowerCase().includes(item.label.toLowerCase().slice(0, 14))) {
        return { lat: item.lat, lon: item.lon };
      }
    }
    return null;
  }

  function computeRoadDistanceFromCoords(c1, c2) {
    const R = 6371;
    const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
    const dLon = ((c2.lon - c1.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((c1.lat * Math.PI) / 180) *
        Math.cos((c2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;
    return Math.max(1.5, +(straightKm * 1.32).toFixed(1));
  }

  async function geocodeMtyAddress(rawQuery) {
    const local = resolveMtyLocalCoords(rawQuery);
    if (local) return local;

    const mtyQuery = contextualizeMtyAddress(rawQuery);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&viewbox=-100.65,25.95,-99.95,25.40&bounded=0&q=${encodeURIComponent(mtyQuery)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      }
    } catch (_) {
      // Fallback below
    }
    return null;
  }

  async function computeMtyRouteDistanceKm(originStr, destStr) {
    const c1 = resolvedOriginCoords || (await geocodeMtyAddress(originStr));
    const c2 = resolvedDestCoords || (await geocodeMtyAddress(destStr));

    if (c1) resolvedOriginCoords = c1;
    if (c2) resolvedDestCoords = c2;

    if (c1 && c2) {
      try {
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`
        );
        if (osrmRes.ok) {
          const data = await osrmRes.json();
          if (data.routes && data.routes[0]?.distance) {
            return Math.max(1.2, +(data.routes[0].distance / 1000).toFixed(1));
          }
        }
      } catch (_) {
        // Fallback to Haversine road factor
      }
      return computeRoadDistanceFromCoords(c1, c2);
    }

    let hash = 0;
    const combined = `${originStr.toLowerCase().trim()}__${destStr.toLowerCase().trim()}`;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31 + combined.charCodeAt(i)) % 10000;
    }
    return +(7.5 + (hash % 220) / 10).toFixed(1);
  }

  // Build In-Page Embedded URL for either Google Maps or Waze Live Map (No external redirect)
  function buildInPageMapEmbedUrl(originRaw, destRaw) {
    const hasOrigin = Boolean(originRaw && originRaw.trim());
    const hasDest = Boolean(destRaw && destRaw.trim());

    if (activeMapEngine === 'waze') {
      const targetCoords = resolvedDestCoords || resolvedOriginCoords || MTY_CENTER;
      const zoom = hasOrigin || hasDest ? 14 : 12;
      return `https://embed.waze.com/es/iframe?zoom=${zoom}&lat=${targetCoords.lat}&lon=${targetCoords.lon}&pin=1`;
    }

    // Default: Google Maps Embedded Engine in Monterrey, Nuevo León
    if (!hasOrigin && !hasDest) {
      return 'https://maps.google.com/maps?q=Monterrey,+Nuevo+Leon,+Mexico&hl=es&z=12&output=embed';
    }
    if (hasOrigin && !hasDest) {
      const q = encodeURIComponent(contextualizeMtyAddress(originRaw));
      return `https://maps.google.com/maps?q=${q}&hl=es&z=14&output=embed`;
    }
    if (!hasOrigin && hasDest) {
      const q = encodeURIComponent(contextualizeMtyAddress(destRaw));
      return `https://maps.google.com/maps?q=${q}&hl=es&z=14&output=embed`;
    }
    const o = encodeURIComponent(contextualizeMtyAddress(originRaw));
    const d = encodeURIComponent(contextualizeMtyAddress(destRaw));
    return `https://maps.google.com/maps?saddr=${o}&daddr=${d}&hl=es&output=embed`;
  }

  function setMapEngineInPage(engine) {
    activeMapEngine = engine === 'waze' ? 'waze' : 'gmaps';
    mapEngineTabs.forEach((tab) => {
      const isSelected = tab.dataset.mapEngine === activeMapEngine;
      tab.classList.toggle('active', isSelected);
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    syncMapAndRouteEngines();
  }

  mapEngineTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setMapEngineInPage(tab.dataset.mapEngine);
    });
  });

  let routeDebounceTimer = null;

  function syncMapAndRouteEngines() {
    const originVal = originInput?.value.trim() || '';
    const destVal = destinationInput?.value.trim() || '';

    clearTimeout(routeDebounceTimer);
    routeDebounceTimer = setTimeout(async () => {
      if (originVal && !resolvedOriginCoords) {
        resolvedOriginCoords = await geocodeMtyAddress(originVal);
      }
      if (destVal && !resolvedDestCoords) {
        resolvedDestCoords = await geocodeMtyAddress(destVal);
      }

      if (gmapsEmbedFrame) {
        const nextSrc = buildInPageMapEmbedUrl(originVal, destVal);
        if (gmapsEmbedFrame.getAttribute('src') !== nextSrc) {
          gmapsEmbedFrame.src = nextSrc;
        }
      }

      if (!originVal && !destVal) {
        currentRouteKm = 0;
        if (routeCalcStatus) {
          routeCalcStatus.textContent = 'Mapa en Monterrey, Nuevo León';
        }
        updateFareCalculation();
        return;
      }

      if (originVal && !destVal) {
        currentRouteKm = 0;
        if (routeCalcStatus) {
          routeCalcStatus.textContent = 'Origen ubicado en el mapa · Ingrese destino';
        }
        updateFareCalculation();
        return;
      }

      if (!originVal && destVal) {
        currentRouteKm = 0;
        if (routeCalcStatus) {
          routeCalcStatus.textContent = 'Destino ubicado en el mapa · Ingrese origen';
        }
        updateFareCalculation();
        return;
      }

      if (routeCalcStatus) {
        routeCalcStatus.textContent = 'Calculando ruta en área metropolitana...';
      }

      currentRouteKm = await computeMtyRouteDistanceKm(originVal, destVal);

      // Refresh Waze pin if Waze engine is active and coordinates just resolved
      if (activeMapEngine === 'waze' && gmapsEmbedFrame) {
        const updatedWazeSrc = buildInPageMapEmbedUrl(originVal, destVal);
        if (gmapsEmbedFrame.getAttribute('src') !== updatedWazeSrc) {
          gmapsEmbedFrame.src = updatedWazeSrc;
        }
      }

      if (routeCalcStatus) {
        routeCalcStatus.textContent = 'Ruta visualizada en el mapa';
      }
      updateFareCalculation();
    }, 280);
  }

  // Address Autocomplete Dropdowns for Monterrey & Metropolitan Area
  let suggestDebounceTimer = null;

  function setupAddressAutocomplete(inputEl, listEl, isOrigin) {
    if (!inputEl || !listEl) return;

    async function renderSuggestions(query) {
      const q = (query || '').trim();
      if (q.length < 2) {
        listEl.hidden = true;
        listEl.innerHTML = '';
        return;
      }

      const lower = q.toLowerCase();
      const localMatches = MTY_METRO_DIRECTORY.filter(
        (item) => item.label.toLowerCase().includes(lower) || item.match.test(q)
      ).slice(0, 4);

      const results = localMatches.map((m) => ({
        label: m.label,
        lat: m.lat,
        lon: m.lon
      }));

      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=4&countrycodes=mx&viewbox=-100.65,25.95,-99.95,25.40&bounded=1&q=${encodeURIComponent(
          `${q}, Nuevo León`
        )}`;
        const res = await fetch(nomUrl);
        if (res.ok) {
          const data = await res.json();
          data.forEach((place) => {
            if (results.length < 6 && place.display_name) {
              const shortName = place.display_name.split(',').slice(0, 4).join(',');
              if (!results.some((r) => r.label === shortName)) {
                results.push({
                  label: shortName,
                  lat: parseFloat(place.lat),
                  lon: parseFloat(place.lon)
                });
              }
            }
          });
        }
      } catch (_) {
        // Offline / local fallback
      }

      if (results.length === 0) {
        listEl.hidden = true;
        listEl.innerHTML = '';
        return;
      }

      listEl.innerHTML = '';
      results.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.setAttribute('role', 'option');
        li.innerHTML = `<span class="suggestion-pin">📍</span><span>${item.label}</span>`;
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          inputEl.value = item.label;
          if (isOrigin) {
            resolvedOriginCoords = { lat: item.lat, lon: item.lon };
          } else {
            resolvedDestCoords = { lat: item.lat, lon: item.lon };
          }
          listEl.hidden = true;
          syncMapAndRouteEngines();
        });
        listEl.appendChild(li);
      });
      listEl.hidden = false;
    }

    inputEl.addEventListener('input', () => {
      if (isOrigin) {
        resolvedOriginCoords = resolveMtyLocalCoords(inputEl.value);
      } else {
        resolvedDestCoords = resolveMtyLocalCoords(inputEl.value);
      }
      syncMapAndRouteEngines();

      clearTimeout(suggestDebounceTimer);
      suggestDebounceTimer = setTimeout(() => {
        renderSuggestions(inputEl.value);
      }, 220);
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(() => {
        listEl.hidden = true;
      }, 180);
    });
  }

  setupAddressAutocomplete(originInput, originSuggestions, true);
  setupAddressAutocomplete(destinationInput, destinationSuggestions, false);

  if (useGpsBtn && originInput) {
    useGpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        originInput.focus();
        return;
      }
      useGpsBtn.textContent = '📍 Localizando...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          resolvedOriginCoords = { lat: parseFloat(lat), lon: parseFloat(lng) };
          originInput.value = `${lat},${lng}`;
          useGpsBtn.textContent = '📍 GPS Activo';
          syncMapAndRouteEngines();
        },
        () => {
          useGpsBtn.textContent = '📍 Usar mi GPS';
          originInput.focus();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // =========================================================================
  // 3. INLINE CALENDAR & TIME DROPDOWNS (NO TOP LABELS)
  // =========================================================================
  const dateHoverBox = document.getElementById('date-hover-box');
  const pickupDateDisplay = document.getElementById('pickup-date-display');
  const pickupDateHidden = document.getElementById('pickup-date');
  const calMonthTitle = document.getElementById('cal-month-title');
  const calDaysGrid = document.getElementById('cal-days-grid');
  const calPrevMonthBtn = document.getElementById('cal-prev-month');
  const calNextMonthBtn = document.getElementById('cal-next-month');

  const MONTHS_ES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let selectedDateObj = new Date(todayDate);
  let currentCalYear = selectedDateObj.getFullYear();
  let currentCalMonth = selectedDateObj.getMonth();

  function formatISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDisplayDateEs(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const monthName = MONTHS_ES[d.getMonth()];
    const year = d.getFullYear();
    return `${day} de ${monthName}, ${year}`;
  }

  function syncSelectedDateInputs() {
    if (pickupDateHidden) pickupDateHidden.value = formatISODate(selectedDateObj);
    if (pickupDateDisplay) pickupDateDisplay.value = formatDisplayDateEs(selectedDateObj);
  }

  function renderInlineCalendar() {
    if (!calDaysGrid || !calMonthTitle) return;

    calMonthTitle.textContent = `${MONTHS_ES[currentCalMonth]} ${currentCalYear}`;
    calDaysGrid.innerHTML = '';

    const firstDayIndex = (new Date(currentCalYear, currentCalMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('span');
      emptyCell.className = 'cal-day-empty';
      calDaysGrid.appendChild(emptyCell);
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDate = new Date(currentCalYear, currentCalMonth, dayNum);
      cellDate.setHours(0, 0, 0, 0);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-btn';
      btn.textContent = dayNum;

      if (cellDate.getTime() === todayDate.getTime()) {
        btn.classList.add('today');
      }
      if (cellDate.getTime() === selectedDateObj.getTime()) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedDateObj = cellDate;
        syncSelectedDateInputs();
        renderInlineCalendar();
      });

      calDaysGrid.appendChild(btn);
    }
  }

  if (calPrevMonthBtn) {
    calPrevMonthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentCalMonth--;
      if (currentCalMonth < 0) {
        currentCalMonth = 11;
        currentCalYear--;
      }
      renderInlineCalendar();
    });
  }

  if (calNextMonthBtn) {
    calNextMonthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentCalMonth++;
      if (currentCalMonth > 11) {
        currentCalMonth = 0;
        currentCalYear++;
      }
      renderInlineCalendar();
    });
  }

  if (dateHoverBox) {
    dateHoverBox.addEventListener('mouseenter', () => {
      dateHoverBox.classList.add('calendar-open');
      if (pickupDateDisplay) pickupDateDisplay.setAttribute('aria-expanded', 'true');
    });
    dateHoverBox.addEventListener('mouseleave', () => {
      dateHoverBox.classList.remove('calendar-open');
      if (pickupDateDisplay) pickupDateDisplay.setAttribute('aria-expanded', 'false');
    });
    dateHoverBox.addEventListener('click', () => {
      dateHoverBox.classList.add('calendar-open');
      if (pickupDateDisplay) pickupDateDisplay.setAttribute('aria-expanded', 'true');
    });
  }

  syncSelectedDateInputs();
  renderInlineCalendar();

  // Time Slots Dropdown
  const timeHoverBox = document.getElementById('time-hover-box');
  const pickupTimeDisplay = document.getElementById('pickup-time-display');
  const pickupTimeHidden = document.getElementById('pickup-time');
  const timeSlotsGrid = document.getElementById('time-slots-grid');

  let selectedTime24 = '20:00';

  function formatTimeLabel(hh, mm) {
    const h24 = String(hh).padStart(2, '0');
    const mStr = String(mm).padStart(2, '0');
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    const h12Str = String(h12).padStart(2, '0');
    return {
      value24: `${h24}:${mStr}`,
      short24: `${h24}:${mStr} hrs`,
      ampm: `${h12Str}:${mStr} ${suffix}`,
      fullDisplay: `${h24}:${mStr} hrs (${h12Str}:${mStr} ${suffix})`
    };
  }

  function renderTimeSlotsDropdown() {
    if (!timeSlotsGrid) return;
    timeSlotsGrid.innerHTML = '';

    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const slot = formatTimeLabel(h, m);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-slot-btn';
        btn.setAttribute('role', 'option');
        if (slot.value24 === selectedTime24) {
          btn.classList.add('selected');
        }

        btn.innerHTML = `<span>${slot.short24}</span><small>${slot.ampm}</small>`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedTime24 = slot.value24;
          if (pickupTimeHidden) pickupTimeHidden.value = slot.value24;
          if (pickupTimeDisplay) pickupTimeDisplay.value = slot.fullDisplay;
          renderTimeSlotsDropdown();
          if (timeHoverBox) timeHoverBox.classList.remove('time-open');
        });

        timeSlotsGrid.appendChild(btn);
      }
    }
  }

  if (timeHoverBox) {
    timeHoverBox.addEventListener('mouseenter', () => {
      timeHoverBox.classList.add('time-open');
      if (pickupTimeDisplay) pickupTimeDisplay.setAttribute('aria-expanded', 'true');
    });
    timeHoverBox.addEventListener('mouseleave', () => {
      timeHoverBox.classList.remove('time-open');
      if (pickupTimeDisplay) pickupTimeDisplay.setAttribute('aria-expanded', 'false');
    });
    timeHoverBox.addEventListener('click', () => {
      timeHoverBox.classList.add('time-open');
      if (pickupTimeDisplay) pickupTimeDisplay.setAttribute('aria-expanded', 'true');
    });
  }

  renderTimeSlotsDropdown();

  // =========================================================================
  // 4. INTERACTIVE VEHICLE SELECTION & IN-PAGE SCROLL TO MAP
  // =========================================================================
  const vehicleCards = document.querySelectorAll('.vehicle-card');
  const inpageSection = document.getElementById('seccion-mapa-trayecto');
  const inpageCard = document.querySelector('.inpage-booking-card');
  const modalSelectedUnit = document.getElementById('modal-selected-unit');
  const unitPillBtns = document.querySelectorAll('.unit-pill-btn');
  const bookingForm = document.getElementById('booking-form');
  const bookingConfirmedView = document.getElementById('booking-confirmed-view');

  function scrollToInPageMapSection() {
    if (inpageSection) {
      inpageSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (inpageCard) {
      inpageCard.classList.add('active-focus');
      setTimeout(() => {
        if (originInput && !originInput.value) {
          originInput.focus({ preventScroll: true });
        }
      }, 550);
    }
  }

  function selectVehicle(vehicleId, options = { scrollToMap: false }) {
    const vehicle = FLEET_DATA[vehicleId];
    if (!vehicle) return;

    selectedVehicleId = vehicleId;

    selectionShockwave = {
      active: true,
      radius: 40,
      alpha: 0.78,
      color: vehicle.accentRgb.join(', ')
    };

    vehicleCards.forEach((card) => {
      const isMatch = card.dataset.vehicleId === vehicleId;
      card.classList.toggle('selected', isMatch);
      card.setAttribute('aria-pressed', isMatch ? 'true' : 'false');

      const revealBox = card.querySelector('.schedule-action-reveal');
      if (revealBox) {
        revealBox.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
      }
    });

    if (modalSelectedUnit) modalSelectedUnit.textContent = vehicle.name;

    unitPillBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.switchUnit === vehicleId);
    });

    updateFareCalculation();

    if (options.scrollToMap) {
      scrollToInPageMapSection();
    }
  }

  vehicleCards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    });

    card.addEventListener('click', (e) => {
      if (
        e.target.closest('.inspect-image-btn') ||
        e.target.closest('.agendar-trayecto-btn') ||
        e.target.closest('.engine-chip-btn')
      ) {
        return;
      }
      selectVehicle(card.dataset.vehicleId, { scrollToMap: false });
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectVehicle(card.dataset.vehicleId, { scrollToMap: false });
      }
    });
  });

  // Clicking "Agendar Trayecto" scrolls smoothly to the in-page map & booking section
  document.querySelectorAll('[data-schedule-vehicle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectVehicle(btn.dataset.scheduleVehicle, { scrollToMap: true });
    });
  });

  // Clicking "Google Maps" or "Waze" on the card switches the in-page map engine without leaving the page
  document.querySelectorAll('[data-open-engine]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const unit = btn.dataset.unit;
      const engine = btn.dataset.openEngine;
      selectVehicle(unit, { scrollToMap: true });
      setMapEngineInPage(engine);
    });
  });

  unitPillBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectVehicle(btn.dataset.switchUnit, { scrollToMap: false });
    });
  });

  const resetBookingBtn = document.getElementById('reset-booking-btn');
  if (resetBookingBtn) {
    resetBookingBtn.addEventListener('click', () => {
      if (bookingForm) bookingForm.hidden = false;
      if (bookingConfirmedView) bookingConfirmedView.hidden = true;
    });
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedVehicleId) selectVehicle('sedan');

      const origin = originInput?.value.trim() || '';
      const dest = destinationInput?.value.trim() || '';
      if (!origin || !dest) {
        if (!origin) originInput?.focus();
        else destinationInput?.focus();
        return;
      }

      if (currentRouteKm <= 0) {
        currentRouteKm = await computeMtyRouteDistanceKm(origin, dest);
      }

      const vehicle = getActiveVehicle();
      const { km, total } = updateFareCalculation();
      const dateStr = pickupDateDisplay?.value || formatDisplayDateEs(selectedDateObj);
      const time = pickupTimeDisplay?.value || pickupTimeHidden?.value || '20:00 hrs';

      const confirmedPriceValue = document.getElementById('confirmed-price-value');
      const confirmedPriceBreakdown = document.getElementById('confirmed-price-breakdown');
      const summaryEl = document.getElementById('confirmed-summary-text');

      if (confirmedPriceValue) {
        confirmedPriceValue.textContent = formatMXN(total);
      }
      if (confirmedPriceBreakdown) {
        confirmedPriceBreakdown.textContent = `Unidad: ${vehicle.name} (${vehicle.passengers}) · Distancia: ${km.toFixed(1)} km`;
      }
      if (summaryEl) {
        summaryEl.textContent = `${origin} → ${dest} · ${dateStr} · ${time}`;
      }

      const waLink = document.getElementById('confirmed-wa-link');
      if (waLink) {
        const msg = encodeURIComponent(
          `Hola Capitanía Atlas, confirmo mi trayecto agendado:\n• Unidad: ${vehicle.name} (${vehicle.passengers})\n• Origen: ${origin}\n• Destino: ${dest}\n• Distancia estimada: ${km.toFixed(1)} km\n• Total estimado: ${formatMXN(total)}\n• Fecha y hora: ${dateStr} · ${time}`
        );
        waLink.href = `https://wa.me/525623337990?text=${msg}`;
      }

      bookingForm.hidden = true;
      if (bookingConfirmedView) bookingConfirmedView.hidden = false;
    });
  }

  // =========================================================================
  // 5. IMAGE & CORPORATE CARD LIGHTBOX
  // =========================================================================
  const inspectModal = document.getElementById('inspect-modal');
  const inspectModalImg = document.getElementById('inspect-modal-img');
  const inspectModalTitle = document.getElementById('inspect-modal-title');
  const inspectModalCap = document.getElementById('inspect-modal-cap');
  const inspectModalSelectBtn = document.getElementById('inspect-modal-select-btn');
  const closeInspectBtn = document.getElementById('close-inspect-modal');
  let inspectedVehicleId = 'sedan';

  document.querySelectorAll('.inspect-image-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vId = btn.dataset.inspect;
      const vehicle = FLEET_DATA[vId];
      if (!vehicle || !inspectModal) return;

      inspectedVehicleId = vId;
      inspectModalImg.src = vehicle.image;
      inspectModalImg.alt = vehicle.name;
      inspectModalTitle.textContent = vehicle.name;
      inspectModalCap.textContent = vehicle.passengers;
      if (inspectModalSelectBtn) inspectModalSelectBtn.hidden = false;

      inspectModal.classList.add('open');
      inspectModal.setAttribute('aria-hidden', 'false');
    });
  });

  function openCorporateCardLightbox() {
    if (!inspectModal) return;
    inspectModalImg.src = 'CA.jpg';
    inspectModalImg.alt = 'Capitanía Atlas';
    inspectModalTitle.textContent = 'Capitanía Atlas';
    inspectModalCap.textContent = '+52 56 2333 7990 · Sedán & SUV';
    if (inspectModalSelectBtn) inspectModalSelectBtn.hidden = true;
    inspectModal.classList.add('open');
    inspectModal.setAttribute('aria-hidden', 'false');
  }

  const openCaCardBtn = document.getElementById('open-ca-card-btn');
  const commCardPreview = document.getElementById('comm-card-preview');
  [openCaCardBtn, commCardPreview].forEach((el) => {
    if (!el) return;
    el.addEventListener('click', openCorporateCardLightbox);
  });

  function closeInspectModal() {
    if (!inspectModal) return;
    inspectModal.classList.remove('open');
    inspectModal.setAttribute('aria-hidden', 'true');
  }

  if (closeInspectBtn) {
    closeInspectBtn.addEventListener('click', closeInspectModal);
  }

  if (inspectModalSelectBtn) {
    inspectModalSelectBtn.addEventListener('click', () => {
      closeInspectModal();
      selectVehicle(inspectedVehicleId, { scrollToMap: true });
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeInspectModal();
    }
  });

  if (inspectModal) {
    inspectModal.addEventListener('click', (e) => {
      if (e.target === inspectModal) {
        closeInspectModal();
      }
    });
  }
})();
