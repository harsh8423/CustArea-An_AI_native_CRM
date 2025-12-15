import axios from 'axios';
import Cookies from 'js-cookie';

export interface SpeechTokenResponse {
    authToken: string | null;
    region?: string;
    error?: string;
}

const COOKIE_NAME = 'speech-token';

export async function getTokenOrRefresh(): Promise<SpeechTokenResponse> {
    if (typeof window === 'undefined') {
        return { authToken: null, error: 'Must be called in browser' };
    }

    const speechToken = Cookies.get(COOKIE_NAME);

    if (!speechToken) {
        try {
            const res = await axios.get('http://localhost:8000/api/get-speech-token', {
                withCredentials: false,
            });

            const token: string = res.data.token;
            const region: string = res.data.region;

            // store region:token
            Cookies.set(COOKIE_NAME, `${region}:${token}`, {
                expires: 0.0035, // ~5 min
                path: '/',
            });

            console.log('Token fetched from backend');
            return { authToken: token, region };
        } catch (err: any) {
            console.error(err?.response?.data || err.message);
            return {
                authToken: null,
                error: err?.response?.data || 'Error fetching token',
            };
        }
    } else {
        console.log('Token fetched from cookie');
        const idx = speechToken.indexOf(':');
        return {
            authToken: speechToken.slice(idx + 1),
            region: speechToken.slice(0, idx),
        };
    }
}
