// Local Archive Dataset for Lofi Space Station
// Bypasses Gemini API to reduce token cost to absolute zero (0 KRW).
// Features natural American English sci-fi logs, space research telemetry, and regional orbital reports.

export interface NewsCategory {
  ocean: string[];
  asia: string[];
  europe: string[];
  americas: string[];
  africa: string[];
  default: string[];
}

export const newsArchive: NewsCategory = {
  ocean: [
    "Uplink calibration successful over Pacific waters. Orbital altitude stable.",
    "Oceanic bioluminescence activity detected at 10% intensity via multispectral scanners.",
    "Deep sea current monitoring systems report micro-surface temperature fluctuations.",
    "Satellite communications link synchronized with global oceanographic buoy network.",
    "Phytoplankton bloom patterns identified in the equatorial currents; telemetry logged.",
    "Deep-space radio telescope calibrating over equatorial oceanic zone.",
    "Atmospheric pressure anomalies detected above sub-polar convergence zones.",
    "Global climate monitoring satellites sync sea surface salinity measurements.",
    "Marine thermal imagery logs minor temperature rise in sub-surface currents.",
    "Solar wind interaction with high-atmosphere layers above ocean basin detected.",
    "Atmospheric humidity profiles showing heavy condensation near convergence zones.",
    "Microwave altimeter maps global tidal gravity shifts over uncharted marine basins."
  ],
  asia: [
    "Astronomers in Eastern Asia report high-altitude auroral ribbons near northern latitudes.",
    "Asia-Pacific aerospace consortium schedules next-generation satellite cluster launch.",
    "Monsoon cloud structures imaged at high resolution using active radar sounders.",
    "Regional command center confirms seamless telemetry relay with East Asian ground grid.",
    "Urban night lights signature analysis maps mega-city density expansion across Asia.",
    "High-energy particle detectors register minor cosmic ray showers above Central Asia.",
    "Volcanic thermal emissions monitored over the Pacific Ring of Fire.",
    "Agricultural monitoring satellites update crop yield projections for East Asian basins.",
    "Himalayan glaciers surface elevation mapping completed by synthetic aperture radar.",
    "Atmospheric particulate monitoring systems trace desert dust drift patterns.",
    "Space weather stations in Tokyo and Seoul report minor magnetosphere variations.",
    "Regional communication satellite launches successfully from Hainan spaceport."
  ],
  europe: [
    "European Space Agency releases updated gravitational anomaly map of Earth.",
    "Stratospheric research balloons deployed over Northern Europe to map ozone profiles.",
    "Global positioning network validates precise altitude reference coordinates over Europe.",
    "Aerosol dispersion models updated utilizing active LIDAR sensors over Western Europe.",
    "Baltic Sea ice cover mapping completed by polar-orbiting radar constellation.",
    "Continental command hub confirms successful orbital link-up with European ground stations.",
    "Deep space network dish in Spain establishes high-gain link with inner solar system probe.",
    "Ionospheric disturbance warning issued for high-latitude Scandinavian regions.",
    "Thermal sensors map micro-climatic urban heat island effects across major European cities.",
    "European astronomical observatory reports new near-Earth asteroid trajectory.",
    "Renewable energy satellite mapping traces wind farm efficiency across North Sea arrays.",
    "Active stratospheric radar sounders map ancient geological fault lines in Southern Europe."
  ],
  americas: [
    "NASA Deep Space Network logs telemetry check with interstellar voyage crafts.",
    "Commercial spaceflight program announces next-generation orbital module flight schedule.",
    "North American weather satellites trace severe convective cell movements in Midwest.",
    "Amazon rainforest canopy carbon density mapping updated via laser altimeters.",
    "Andean tectonic plates friction shifts monitored by orbital radar interferometers.",
    "Southern Hemisphere telescope arrays report major solar flare ionization event.",
    "NASA climate research center logs seasonal snowpack water equivalent maps.",
    "Space launch facility at Cape Canaveral prepares heavy lift booster integration.",
    "Deep space communications facility in California updates lunar landing target maps.",
    "Stratospheric winds analysis indicates stable polar vortex boundary shifts.",
    "Ocean surface wind vector radar maps offshore currents along Pacific coastlines.",
    "Solar particle flux measurements confirm minor magnetosphere compression over the Americas."
  ],
  africa: [
    "Trans-African astronomical society coordinates global space science summit.",
    "Saharan dust plume dispersion paths modeled from high-altitude orbital imagery.",
    "Geothermal heat flow variations mapped across the East African Rift system.",
    "Equatorial communications link-up stabilized with regional tracking facilities.",
    "Hydrological monitoring satellites update water storage maps for major African basins.",
    "Orbital vegetation index mapping indicates seasonal grass growth shifts.",
    "Astronomical observatory in South Africa reports deep-space transit detection.",
    "Space science research center in Cairo maps ancient fossil river beds from orbit.",
    "Equatorial ionospheric plasma bubble dynamics logged by low-Earth orbit probes.",
    "Coastal erosion tracking arrays map delta shifts along the western African coastline.",
    "Tectonic activity analysis logs micro-seismic shifts in Rift Valley zones.",
    "Solar irradiance sensors trace peak thermal load indices across equatorial deserts."
  ],
  default: [
    "Orbital maintenance diagnostics completed. All telemetry subsystems functional.",
    "Microgravity science module logs successful cell crystallization experiment run.",
    "Cosmic dust collector retrieves interplanetary particulate samples; telemetry logged.",
    "Solar array alignment calibrated to maximize photovoltaic conversion efficiency.",
    "Internal life support systems report optimal carbon dioxide scrubbing cycle.",
    "Thermal control radiator loops operating at standard baseline parameters.",
    "Star tracker navigation cameras verify attitude determination matrix accuracy.",
    "High-gain antenna array realigns to optimize ground tracking station handshake.",
    "Onboard atomic clock synchronizes UTC time reference within microsecond margin.",
    "Radiation shielding detectors confirm cabin exposure levels remain below safety thresholds.",
    "Micro-meteoroid protection shield inspection logs zero impact penetration events.",
    "Orbital thruster propellant tank pressures verified at standard reserve levels."
  ]
};

// Helper function to get random items from an array
export const getRandomItems = (arr: string[], count: number): string[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
