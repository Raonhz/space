import { ISSData, LocationData, WeatherData } from '../types';

export const fetchISSLocation = async (timestamp?: number): Promise<ISSData> => {
  const url = timestamp 
    ? `https://api.wheretheiss.at/v1/satellites/25544?timestamp=${timestamp}`
    : 'https://api.wheretheiss.at/v1/satellites/25544';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch ISS data');
  return res.json();
};

export const fetchLocationDetails = async (lat: number, lon: number, lang: string = 'en'): Promise<LocationData> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`, {
      headers: { 'Accept-Language': `${lang},en;q=0.9` }
    });
    
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();

    if (data.error) {
      return {
        country: 'International Waters',
        region: 'Ocean',
        isOcean: true,
        name: 'Oceania / Uncharted'
      };
    }

    const address = data.address;
    return {
      country: address.country || 'Unknown Country',
      region: address.state || address.region || address.county || '',
      isOcean: false,
      name: address.city || address.town || address.village || address.country || 'Unknown Location'
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return { country: 'Unknown', region: '', isOcean: false, name: 'Unknown' };
  }
};

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData | null> => {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    
    const code = data.current_weather.weathercode;
    let condition = 'Clear';
    if (code > 0 && code <= 3) condition = 'Cloudy';
    if (code >= 45 && code <= 48) condition = 'Foggy';
    if (code >= 51 && code <= 67) condition = 'Rainy';
    if (code >= 71 && code <= 77) condition = 'Snowy';
    if (code >= 80 && code <= 82) condition = 'Showers';
    if (code >= 95) condition = 'Thunderstorm';

    return {
      temperature: data.current_weather.temperature,
      condition,
      isDay: data.current_weather.is_day === 1
    };
  } catch (error) {
    console.error("Weather error:", error);
    return null;
  }
};
