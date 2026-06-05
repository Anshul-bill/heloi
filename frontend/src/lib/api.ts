import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
    baseURL: API_BASE_URL,
});

export const fetchWeather = async (lat: number, lon: float) => {
    const response = await api.get(`/weather?lat=${lat}&lon=${lon}`);
    return response.data;
};

export const fetchSiteContext = async (lat: number, lon: float) => {
    const response = await api.get(`/site-context?lat=${lat}&lon=${lon}`);
    return response.data;
};

export const runSimulation = async (lat: number, lon: number, tariff: number = 0.15, year?: number, month?: number, day?: number) => {
    let url = `/simulate?lat=${lat}&lon=${lon}&tariff=${tariff}`;
    if (year) url += `&year=${year}`;
    if (month) url += `&month=${month}`;
    if (day) url += `&day=${day}`;
    const response = await api.post(url);
    return response.data;
};

export const fetchHistory = async () => {
    const response = await api.get('/history');
    return response.data;
};
