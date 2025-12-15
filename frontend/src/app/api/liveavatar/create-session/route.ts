import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mode = 'CUSTOM', avatar_id } = body;

        // Validate required fields
        if (!avatar_id) {
            return NextResponse.json(
                { error: 'avatar_id is required' },
                { status: 400 }
            );
        }

        // Get API key from environment
        const apiKey = process.env.LIVEAVATAR_API_KEY;
        if (!apiKey) {
            console.error('LIVEAVATAR_API_KEY not set in environment');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        // Helper to cleanup active sessions
        const cleanupActiveSessions = async () => {
            try {
                console.log('Listing active sessions for cleanup...');
                // Use axios to send GET with body as per user's example
                const listResponse = await axios.get('https://api.liveavatar.com/v1/sessions', {
                    headers: {
                        'X-API-KEY': apiKey,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    data: { type: 'active' } // Sending body with GET
                });

                const data = listResponse.data;
                console.log('List Sessions Response:', JSON.stringify(data, null, 2));

                const sessions = data.data?.sessions || data.data?.results || [];
                console.log(`Found ${sessions.length} existing sessions. Cleaning up...`);

                for (const session of sessions) {
                    const sessionId = session.session_id || session.id;
                    console.log(`Stopping session ${sessionId}...`);
                    await axios.post('https://api.liveavatar.com/v1/sessions/stop', { session_id: sessionId }, {
                        headers: {
                            'X-API-KEY': apiKey,
                            'Content-Type': 'application/json',
                        }
                    });
                    console.log(`Stopped session ${sessionId}`);
                }
            } catch (error: any) {
                console.warn('Failed to cleanup sessions:', error.response?.data || error.message);
            }
        };

        // Cleanup before creating new session
        await cleanupActiveSessions();

        // Step 1: Create Session Token
        const tokenResponse = await fetch('https://api.liveavatar.com/v1/sessions/token', {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                mode: mode.toUpperCase(),
                avatar_id: avatar_id,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            console.error('LiveAvatar Token API error:', errorData);
            return NextResponse.json(
                { error: 'Failed to create session token', details: errorData },
                { status: tokenResponse.status }
            );
        }

        const tokenData = await tokenResponse.json();
        console.log('LiveAvatar Token Response:', JSON.stringify(tokenData, null, 2));

        const sessionToken = tokenData.data?.session_token || tokenData.session_token;
        const sessionIdFromToken = tokenData.data?.session_id || tokenData.session_id;

        if (!sessionToken) {
            console.error('No session token found in response');
            return NextResponse.json(
                { error: 'No session token found in response', details: tokenData },
                { status: 500 }
            );
        }

        // Step 2: Start Session
        const startResponse = await fetch('https://api.liveavatar.com/v1/sessions/start', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // Empty body required
        });

        if (!startResponse.ok) {
            const errorData = await startResponse.json().catch(() => ({}));
            console.error('LiveAvatar Start API error:', errorData);
            return NextResponse.json(
                { error: 'Failed to start session', details: errorData },
                { status: startResponse.status }
            );
        }

        const sessionData = await startResponse.json();
        console.log('LiveAvatar Start Response:', JSON.stringify(sessionData, null, 2));

        const data = sessionData.data;

        if (!data || !data.livekit_url) {
            console.error('No livekit data in start response');
            return NextResponse.json(
                { error: 'Invalid response from LiveAvatar API', details: sessionData },
                { status: 500 }
            );
        }

        // Return session data to frontend
        return NextResponse.json({
            session_id: data.session_id || sessionIdFromToken,
            ws_url: data.ws_url,
            livekit: {
                url: data.livekit_url,
                token: data.livekit_client_token,
            },
        });

    } catch (error: any) {
        console.error('Error creating LiveAvatar session:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
