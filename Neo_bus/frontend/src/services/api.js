import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to inject JWT token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auto refresh token rotation
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = sessionStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token } = res.data;
          sessionStorage.setItem('access_token', access_token);
          sessionStorage.setItem('refresh_token', refresh_token);
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear session storage and log out
        sessionStorage.clear();
        window.dispatchEvent(new Event('auth-logout'));
      }
    }
    return Promise.reject(error);
  }
);

// Releases held seat locks when the tab/browser is closing (beforeunload/pagehide).
// Uses fetch(keepalive) rather than the axios instance because in-flight requests are
// otherwise cancelled once the document starts unloading, and unlike sendBeacon this
// still lets us attach the Authorization header the protected unlock endpoint requires.
export function releaseSeatLocksOnUnload(tripId, seatIds) {
  if (!tripId || !seatIds || seatIds.length === 0) return;
  const token = sessionStorage.getItem('access_token');
  if (!token) return;

  try {
    fetch(`${API_BASE_URL}/bookings/seats/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trip_id: tripId, seat_ids: seatIds }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {
    // Best-effort only — the server-side lock TTL is the guaranteed fallback.
  }
}

// Mock Fallback Data in case the backend database is not fully set up or started by the user yet
export const mockData = {
  cities: [
    { id: '1', name: 'Mumbai', code: 'BOM', state: { name: 'Maharashtra', code: 'MH' } },
    { id: '2', name: 'Pune', code: 'PNQ', state: { name: 'Maharashtra', code: 'MH' } },
    { id: '3', name: 'Bangalore', code: 'BLR', state: { name: 'Karnataka', code: 'KA' } },
    { id: '4', name: 'Hyderabad', code: 'HYD', state: { name: 'Telangana', code: 'TG' } },
    { id: '5', name: 'Chennai', code: 'MAA', state: { name: 'Tamil Nadu', code: 'TN' } },
  ],
  trips: [
    {
      id: 'trip-101',
      price: 650.0,
      departure_time: new Date(Date.now() + 3600000 * 5).toISOString(), // 5 hours from now
      arrival_time: new Date(Date.now() + 3600000 * 8).toISOString(),
      bus: {
        bus_number: 'MH-12-PQ-9999',
        bus_type: 'AC_Sleeper',
        capacity: 32,
        rating: 4.5,
        operator: { name: 'Neeta Travels' },
        amenities: [{ name: 'Wi-Fi' }, { name: 'Charging Point' }, { name: 'Water Bottle' }, { name: 'Blanket' }]
      },
      operator: { name: 'Neeta Travels', rating: 4.5 }
    },
    {
      id: 'trip-102',
      price: 1200.0,
      departure_time: new Date(Date.now() + 3600000 * 12).toISOString(),
      arrival_time: new Date(Date.now() + 3600000 * 20).toISOString(),
      bus: {
        bus_number: 'KA-01-AB-1234',
        bus_type: 'AC_Seater',
        capacity: 32,
        rating: 4.7,
        operator: { name: 'Orange Travels' },
        amenities: [{ name: 'Wi-Fi' }, { name: 'Charging Point' }, { name: 'Water Bottle' }]
      },
      operator: { name: 'Orange Travels', rating: 4.7 }
    }
  ],
  layout: Array.from({ length: 32 }, (_, i) => ({
    id: `seat-${i + 1}`,
    seat_number: `${Math.floor(i / 4) + 1}${['A', 'B', 'C', 'D'][i % 4]}`,
    row: Math.floor(i / 4) + 1,
    column: (i % 4) + 1,
    seat_type: i % 12 === 0 ? 'sleeper' : 'seater',
    is_ladies: i % 7 === 0,
    status: i % 5 === 0 ? 'booked' : i % 9 === 0 ? 'locked' : 'available'
  }))
};

export default api;
