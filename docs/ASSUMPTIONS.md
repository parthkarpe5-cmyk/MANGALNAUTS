# MANGALNAUTS — Operational & Physical Assumptions

This document outlines the environmental thresholds, mission safety policies, and proxy models implemented by **Person 4 (Environmental & Radiation Safety Engineer)** for the Jezero Crater Area of Interest (AOI).

---

## 1. Radiation Proxy Justification (Curiosity RAD ➔ Jezero Crater)

* **Physical Context:** NASA's Perseverance rover at Jezero Crater does not carry a dedicated radiation detector (such as MSL RAD). However, astronaut safety assessments require surface radiation monitoring.
* **Atmospheric Column Model:** 
  * Curiosity's landing site at Gale Crater sits at $-4,400\text{ m}$ elevation relative to the MOLA datum, providing $\sim 21\text{ g/cm}^2$ of atmospheric column shielding with a measured quiescent GCR dose of $26.7\text{ }\mu\text{Sv/hr}$ ($0.64\text{ mSv/day}$).
  * Jezero Crater's delta and crater floor sits at $-2,500\text{ m}$ elevation ($\sim 1,900\text{ m}$ higher), reducing the atmospheric shielding to $\sim 18.5\text{ g/cm}^2$.
  * Based on established transport models (e.g. HZETRN / GEANT4 Mars simulations), GCR surface dosage increases inversely with atmospheric column depth. We apply a scientifically grounded scaling factor of $1.067\times$, establishing a quiescent Jezero baseline of **$28.5\text{ }\mu\text{Sv/hr}$** ($0.684\text{ mSv/day}$).
* **Solar Particle Event (SPE) Multiplier:** During an $M5.0+$ or $X$-class solar energetic particle event, unshielded surface dose rates spike by $30\times$ to $50\times$ ($> 1,000\text{ }\mu\text{Sv/hr}$). This triggers an immediate `SOLAR_STORM` emergency abort.

---

## 2. Astronaut Spacesuit Thermal Constraints

* **Nominal Suit Operating Range:** $-60^\circ\text{C}$ to $+20^\circ\text{C}$ with active liquid cooling and ventilation garment (LCVG) and internal resistance heating.
* **Extreme Cold Limit:** $-80^\circ\text{C}$. Below this temperature, spacesuit joint elastomer seals, glove mobility, and life-support battery power suffer rapid degradation.
* **Alert Trigger:** When diurnal low forecasts approach $-75^\circ\text{C}$ or when local solar time enters nightfall, a `COLD_EVA` or `NIGHT_RESTRICTION` advisory is issued.

---

## 3. Solar Lighting & Sunset Countdown Rules

* **Daylight Operating Window:** Mars Local True Solar Time between $06:15$ (sunrise) and $17:15$ (sunset) at Jezero latitude ($18.44^\circ\text{N}$).
* **Sunset Buffer Policy:**
  * $> 60\text{ min}$ to sunset: `NOMINAL` EVA operations permitted.
  * $< 60\text{ min}$ to sunset: `SUNSET_IMMINENT` warning issued; traverse pathfinding directs crew toward habitat/rover ingress.
  * Post-sunset: `NIGHT_RESTRICTION` alert active; all non-emergency surface excursions prohibited due to subzero plunge and zero visual navigation landmarks.

---

## 4. Atmospheric Wind & Dust Guidelines

* **Nominal Wind:** $2\text{–}6\text{ m/s}$ (low kinetic pressure due to Martian atmosphere being $< 1\%$ Earth density).
* **High Wind Threshold:** $> 10\text{ m/s}$. Triggers `HIGH_WIND` advisory due to saltation (blowing sharp dust particles that abrade helmet visors and optical sensors).
