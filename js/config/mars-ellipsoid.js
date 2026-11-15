/* global Cesium, window */
window.initMarsEllipsoid = function () {
  if (typeof Cesium !== "undefined" && Cesium.Ellipsoid && !Cesium.Ellipsoid.MARS) {
    var r = 3396190.0;
    Cesium.Ellipsoid.MARS = new Cesium.Ellipsoid(r, r, r);
  }
  return typeof Cesium !== "undefined" ? Cesium.Ellipsoid.MARS : null;
};
window.initMarsEllipsoid();