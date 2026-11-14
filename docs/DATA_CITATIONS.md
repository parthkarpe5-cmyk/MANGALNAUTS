# MANGALNAUTS — Scientific Data Citations

This document records the official NASA and NOAA data products, mission instruments, and academic publications utilized in the **MANGALNAUTS Martian Mission OS** for environmental, meteorological, and radiation hazard monitoring in Jezero Crater.

---

## 1. Mars In-Situ Meteorological Data (Jezero Crater)

* **Instrument:** Mars Environmental Dynamics Analyzer (MEDA)
* **Mission:** NASA Mars 2020 Perseverance Rover
* **Landing Site:** Jezero Crater ($18.44^\circ\text{N}, 77.58^\circ\text{E}$, $-2500\text{ m}$ MOLA datum)
* **Host Institution:** Centro de Astrobiología (CAB, CSIC-INTA), Spain / NASA JPL
* **Parameters Captured:** Surface atmospheric pressure (Pa), ambient air temperature ($^\circ\text{C}$), diurnal minimum/maximum temperatures, solar longitude ($L_s$), and local seasonal cycle.
* **Official Data Portal:** NASA Mars 2020 Mission Public Weather API  
  URL: [https://mars.nasa.gov/mars2020/weather/](https://mars.nasa.gov/mars2020/weather/)
* **Key Publication:** Rodriguez-Manfredi, J. A., et al. (2021). "The Mars Environmental Dynamics Analyzer (MEDA) Instrument on the Mars 2020 Mission." *Space Science Reviews*, 217(3), 48. [DOI: 10.1007/s11214-021-00816-9](https://doi.org/10.1007/s11214-021-00816-9).

---

## 2. Galactic Cosmic Ray (GCR) & Surface Radiation Model

* **Instrument:** Radiation Assessment Detector (RAD)
* **Mission:** NASA Mars Science Laboratory (MSL) Curiosity Rover
* **Host Institution:** Southwest Research Institute (SwRI) / Christian-Albrechts-Universität zu Kiel / NASA SMD
* **Parameters Captured:** Galactic Cosmic Ray (GCR) absorbed dose rate ($\mu\text{Gy/day}$) and dose equivalent ($\mu\text{Sv/hr}$), Solar Energetic Particle (SEP) events.
* **Proxy Methodology:** Scaled for Jezero Crater's $-2,500\text{ m}$ MOLA elevation based on atmospheric column shielding calculations ($\sim 28.5\text{ }\mu\text{Sv/hr}$ quiescent baseline).
* **Official Data Portal:** NASA Planetary Data System (PDS) Planetary Plasma Interactions (PPI) Node  
  URL: [https://pds-ppi.igpp.ucla.edu/](https://pds-ppi.igpp.ucla.edu/)
* **Key Publication:** Hassler, D. M., et al. (2014). "Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover." *Science*, 343(6169), 1244797. [DOI: 10.1126/science.1244797](https://doi.org/10.1126/science.1244797).

---

## 3. Real-Time Space Weather & Solar Flare Monitoring

* **Instrument:** Extreme Ultraviolet and X-ray Irradiance Sensors (EXIS) / Space Environment In-Situ Suite (SEISS)
* **Spacecraft:** NOAA GOES-R Series (Geostationary Operational Environmental Satellites) & NASA SOHO/STEREO
* **Operating Agency:** National Oceanic and Atmospheric Administration (NOAA) Space Weather Prediction Center (SWPC) & NASA Goddard Space Weather Research Center (DONKI)
* **Parameters Captured:** 1-minute real-time solar X-ray flux ($\text{W/m}^2$), solar flare classification (A, B, C, M, X class), Coronal Mass Ejection (CME) transit tracking.
* **Official Data Portals:**
  * NOAA SWPC Primary X-ray Flux: [https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json](https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json)
  * NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI): [https://api.nasa.gov/DONKI/](https://api.nasa.gov/DONKI/)

---

## 4. Mars Solar Time & Solar Geometry Algorithms

* **Algorithm:** Mars24 Sunclock Algorithm
* **Institution:** NASA Goddard Institute for Space Studies (GISS)
* **Parameters Computed:** Mars Sol Date (MSD), Local True Solar Time (LTST), Solar Declination, and local sunrise/sunset timings for arbitrary Martian coordinates.
* **Key Publications:**
  * Allison, M., & McEwen, M. (2000). "A post-Pathfinder evaluation of areocentric solar coordinates with improved timing recipes for Mars seasonal/diurnal climate applications." *Planetary and Space Science*, 48(2-3), 215-235.
  * Allison, M. (1997). "Accurate analytic approximations for transit illumination and shadowing on Mars." *Geophysical Research Letters*, 24(16), 1975-1978.
