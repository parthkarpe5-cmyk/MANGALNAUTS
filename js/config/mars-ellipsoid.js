/* global Cesium */
(function () {
  var r = 3396190.0;
  if (!Cesium.Ellipsoid.MARS) {
    Cesium.Ellipsoid.MARS = new Cesium.Ellipsoid(r, r, r);
  }
})();