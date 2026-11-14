/* global window */
window.MarsElevationProfile = (function () {
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

    let polyPoints = "";
    let areaPoints = padding.left + "," + (padding.top + chartH) + " ";

    nodes.forEach(function (n) {
      const x = getX(n.dist_m).toFixed(1);
      const y = getY(n.elev_m).toFixed(1);
      polyPoints += x + "," + y + " ";
      areaPoints += x + "," + y + " ";
    });
    areaPoints += (padding.left + chartW) + "," + (padding.top + chartH);

    const startX = getX(0);
    const startY = getY(nodes[0].elev_m);
    const endX = getX(totalDist);
    const endY = getY(nodes[nodes.length - 1].elev_m);

    const midElev = (minElev + maxElev) / 2;
    const midY = getY(midElev);
    const kmText = (totalDist / 1000).toFixed(2) + " km";

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
      '<polygon points="' + areaPoints + '" fill="url(#elevGrad)"/>' +
      '<polyline points="' + polyPoints + '" fill="none" stroke="#c9f31d" stroke-width="2.5" filter="url(#neonGlow)" stroke-linecap="round" stroke-linejoin="round"/>' +
      // Start Marker (A)
      '<circle cx="' + startX + '" cy="' + startY + '" r="5" fill="#c9f31d" stroke="#0c0e12" stroke-width="2"/>' +
      '<text x="' + startX + '" y="' + (startY - 7) + '" font-size="8.5" fill="#c9f31d" text-anchor="middle" font-weight="bold">A</text>' +
      // End Marker (B)
      '<circle cx="' + endX + '" cy="' + endY + '" r="5" fill="#38bdf8" stroke="#0c0e12" stroke-width="2"/>' +
      '<text x="' + endX + '" y="' + (endY - 7) + '" font-size="8.5" fill="#38bdf8" text-anchor="middle" font-weight="bold">B</text>' +
      // Elevation Labels
      '<text x="' + (padding.left - 6) + '" y="' + (padding.top + 4) + '" font-size="8.5" fill="#9ca3af" font-family="monospace" text-anchor="end">' + Math.round(maxElev) + 'm</text>' +
      '<text x="' + (padding.left - 6) + '" y="' + (padding.top + chartH + 3) + '" font-size="8.5" fill="#9ca3af" font-family="monospace" text-anchor="end">' + Math.round(minElev) + 'm</text>' +
      // Distance Label
      '<text x="' + (padding.left + chartW) + '" y="' + (height - 6) + '" font-size="8.5" fill="#9ca3af" font-family="monospace" text-anchor="end">' + kmText + '</text>' +
      '</svg>'
    );
  }

  return { renderSvg };
})();
