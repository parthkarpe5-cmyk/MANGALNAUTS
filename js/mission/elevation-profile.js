/* global window */
window.MarsElevationProfile = (function () {
  let lastChartInfo = null;

  function buildSmoothSvgPath(pts) {
    if (pts.length < 2) return "";
    if (pts.length === 2) {
      return "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1) + " L " + pts[1].x.toFixed(1) + " " + pts[1].y.toFixed(1);
    }
    let d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += " C " + cp1x.toFixed(1) + " " + cp1y.toFixed(1) + ", " + cp2x.toFixed(1) + " " + cp2y.toFixed(1) + ", " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
    }
    return d;
  }

  function renderSvg(nodes, width, height) {
    if (!nodes || nodes.length < 2) {
      return '<div class="profile-empty">Not enough elevation points</div>';
    }

    width = width || 320;
    height = height || 115;
    const padding = { top: 20, right: 20, bottom: 24, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const totalDist = nodes[nodes.length - 1].dist_m;
    let minElev = Infinity;
    let maxElev = -Infinity;
    nodes.forEach(function (n) {
      if (n.elev_m < minElev) minElev = n.elev_m;
      if (n.elev_m > maxElev) maxElev = n.elev_m;
    });

    if (maxElev - minElev < 5) {
      minElev -= 5;
      maxElev += 5;
    }
    const elevRange = maxElev - minElev;

    function getX(dist) {
      return padding.left + (dist / totalDist) * chartW;
    }

    function getY(elev) {
      return padding.top + chartH - ((elev - minElev) / elevRange) * chartH;
    }

    const pts = nodes.map(function (n) {
      return { x: getX(n.dist_m), y: getY(n.elev_m) };
    });

    const linePathD = buildSmoothSvgPath(pts);
    const bottomY = (padding.top + chartH).toFixed(1);
    const startX = pts[0].x.toFixed(1);
    const endX = pts[pts.length - 1].x.toFixed(1);
    const areaD = linePathD + " L " + endX + " " + bottomY + " L " + startX + " " + bottomY + " Z";

    const startY = pts[0].y;
    const endY = pts[pts.length - 1].y;

    const midElev = (minElev + maxElev) / 2;
    const midY = getY(midElev);
    const kmText = (totalDist / 1000).toFixed(2) + " km";

    lastChartInfo = { padding, chartW, chartH, minElev, elevRange, totalDist };

    return (
      '<svg class="elevation-profile-svg" viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" width="100%" height="' +
      height +
      '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '  <linearGradient id="elevGrad" x1="0%" y1="0%" x2="0%" y2="100%">' +
      '    <stop offset="0%" stop-color="#c9f31d" stop-opacity="0.45"/>' +
      '    <stop offset="70%" stop-color="#c9f31d" stop-opacity="0.10"/>' +
      '    <stop offset="100%" stop-color="#c9f31d" stop-opacity="0.00"/>' +
      '  </linearGradient>' +
      '  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">' +
      '    <feGaussianBlur stdDeviation="1.5" result="blur" />' +
      '    <feComposite in="SourceGraphic" in2="blur" operator="over" />' +
      '  </filter>' +
      '</defs>' +
      // Background Grid lines
      '<line x1="' + padding.left + '" y1="' + padding.top + '" x2="' + (padding.left + chartW) + '" y2="' + padding.top + '" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3"/>' +
      '<line x1="' + padding.left + '" y1="' + midY + '" x2="' + (padding.left + chartW) + '" y2="' + midY + '" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3,3"/>' +
      '<line x1="' + padding.left + '" y1="' + (padding.top + chartH) + '" x2="' + (padding.left + chartW) + '" y2="' + (padding.top + chartH) + '" stroke="rgba(255,255,255,0.18)"/>' +
      // Shaded Area & Line
      '<path d="' + areaD + '" fill="url(#elevGrad)"/>' +
      '<path d="' + linePathD + '" fill="none" stroke="#c9f31d" stroke-width="2.5" filter="url(#neonGlow)" stroke-linecap="round" stroke-linejoin="round"/>' +
      // Active Rover Traversal Indicator
      '<g id="profile-rover-indicator" style="display:none;">' +
      '  <line id="profile-rover-line" x1="0" y1="' + padding.top + '" x2="0" y2="' + (padding.top + chartH) + '" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="2,2"/>' +
      '  <circle id="profile-rover-dot" cx="0" cy="0" r="4.5" fill="#00f0ff" stroke="#ffffff" stroke-width="1.5" filter="url(#neonGlow)"/>' +
      '</g>' +
      // Start Marker (A)
      '<circle cx="' + startX + '" cy="' + startY + '" r="5.5" fill="#15803d" stroke="#030712" stroke-width="2"/>' +
      '<text x="' + startX + '" y="' + (startY - 7) + '" font-size="9" fill="#15803d" text-anchor="middle" font-weight="900">A</text>' +
      // End Marker (B)
      '<circle cx="' + endX + '" cy="' + endY + '" r="5.5" fill="#b91c1c" stroke="#030712" stroke-width="2"/>' +
      '<text x="' + endX + '" y="' + (endY - 7) + '" font-size="9" fill="#b91c1c" text-anchor="middle" font-weight="900">B</text>' +
      // Elevation Labels
      '<text x="' + (padding.left - 6) + '" y="' + (padding.top + 4) + '" font-size="8.5" fill="#9ca3af" font-family="monospace" text-anchor="end">' + Math.round(maxElev) + 'm</text>' +
      '<text x="' + (padding.left - 6) + '" y="' + (padding.top + chartH + 3) + '" font-size="8.5" fill="#9ca3af" font-family="monospace" text-anchor="end">' + Math.round(minElev) + 'm</text>' +
      // Distance Label
      '<text x="' + (padding.left + chartW) + '" y="' + (height - 6) + '" font-size="8.5" fill="#9ca3af" font-family="monospace" text-anchor="end">' + kmText + '</text>' +
      '</svg>'
    );
  }

  function updateProgress(distM, elev) {
    if (!lastChartInfo) return;
    const group = document.getElementById("profile-rover-indicator");
    const line = document.getElementById("profile-rover-line");
    const dot = document.getElementById("profile-rover-dot");
    if (!group || !line || !dot) return;

    group.style.display = "block";
    const { padding, chartW, chartH, minElev, elevRange, totalDist } = lastChartInfo;
    const f = Math.min(1, Math.max(0, distM / Math.max(1, totalDist)));
    const x = padding.left + f * chartW;
    const y = elev != null
      ? padding.top + chartH - ((elev - minElev) / Math.max(1, elevRange)) * chartH
      : padding.top + chartH / 2;

    line.setAttribute("x1", x.toFixed(1));
    line.setAttribute("x2", x.toFixed(1));
    dot.setAttribute("cx", x.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
  }

  function hideProgress() {
    const group = document.getElementById("profile-rover-indicator");
    if (group) group.style.display = "none";
  }

  return { renderSvg, updateProgress, hideProgress };
})();
