export interface ISSData {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: 'daylight' | 'eclipsed';
  timestamp: number;
}

export interface LocationData {
  country: string;
  region: string;
  isOcean: boolean;
  name: string;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  isDay: boolean;
}

export interface AppState {
  iss: ISSData | null;
  location: LocationData | null;
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
}
