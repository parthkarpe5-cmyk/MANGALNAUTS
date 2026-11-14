/* global Cesium, window */
window.TrekLayers = (function () {
  const TREK_EQ = "https://trek.nasa.gov/tiles/Mars/EQ";
  const marsRectangle = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);

  const tilingScheme = new Cesium.GeographicTilingScheme({
    ellipsoid: Cesium.Ellipsoid.MARS,
    rectangle: marsRectangle,
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 1,
  });

  const CATALOG = {
    viking: {
      layerId: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
      ext: "jpg",
      maxLevel: 7,
      label: "Viking color",
      credit: "NASA Viking MDIM · Mars Trek / USGS",
    },
    vikingBw: {
      layerId: "Mars_Viking_MDIM21_mosaic_global_232m",
      ext: "jpg",
      maxLevel: 7,
      label: "Viking B&W (USGS)",
      credit: "USGS Astrogeology · Viking MDIM 2.1",
    },
    mola: {
      layerId: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
      ext: "jpg",
      maxLevel: 10,
      label: "MOLA hillshade (color)",
      credit: "NASA MGS MOLA · Mars Trek",
    },
    molaRelief: {
      layerId: "Mars_MGS_MOLA_Shade_merge_global_463m",
      ext: "jpg",
      maxLevel: 10,
      label: "MOLA relief (grayscale)",
      credit: "NASA MGS MOLA · Mars Trek",
    },
    themisDay: {
      layerId: "Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v12_clon0_ly",
      ext: "jpg",
      maxLevel: 8,
      label: "THEMIS day IR",
      credit: "ASU THEMIS · Mars Trek",
    },
    themisNight: {
      layerId: "Mars_MO_THEMIS-IR-Night_mosaic_60N60S_100m_v14_clon0_ly",
      ext: "jpg",
      maxLevel: 8,
      label: "THEMIS night IR",
      credit: "ASU THEMIS · Mars Trek",
    },
    tes: {
      layerId: "Mars_MGS_TES_Albedo_mosaic_global_7410m",
      ext: "png",
      maxLevel: 6,
      label: "TES albedo",
      credit: "NASA MGS TES · Mars Trek",
    },
    tesDust: {
      layerId: "Mars_MGS_TES_Dust_Cover_Index_mosaic_global_7410m",
      ext: "png",
      maxLevel: 6,
      label: "TES dust cover index",
      credit: "NASA MGS TES · Mars Trek",
    },
    tesThermal: {
      layerId: "Mars_MGS_TES_Thermal_Inertia_mosaic_global_7410m",
      ext: "png",
      maxLevel: 6,
      label: "TES thermal inertia",
      credit: "NASA MGS TES · Mars Trek",
    },
  };

  const cache = {};

  function tilePath(layerId, ext) {
    return (
      TREK_EQ +
      "/" +
      layerId +
      "/1.0.0/default/default028mm/{z}/{y}/{x}." +
      ext
    );
  }

  function createProvider(key) {
    if (cache[key]) {
      return cache[key];
    }
    const meta = CATALOG[key];
    if (!meta) {
      throw new Error("Unknown Trek layer: " + key);
    }
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: tilePath(meta.layerId, meta.ext),
      tilingScheme,
      rectangle: marsRectangle,
      maximumLevel: meta.maxLevel,
      credit: meta.credit,
      ellipsoid: Cesium.Ellipsoid.MARS,
      customTags: {
        y: function (provider, x, y, level) {
          const total = provider.tilingScheme.getNumberOfYTilesAtLevel(level);
          return String(total - y - 1);
        },
      },
    });
    cache[key] = provider;
    return provider;
  }

  function keys() {
    return Object.keys(CATALOG);
  }

  function labelFor(key) {
    return (CATALOG[key] && CATALOG[key].label) || key;
  }

  return { CATALOG, createProvider, keys, labelFor };
})();
