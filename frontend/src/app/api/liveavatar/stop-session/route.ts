import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json(
                { error: 'session_id is required' },
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

        // Stop Session
        const response = await fetch('https://api.liveavatar.com/v1/sessions/stop', {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('LiveAvatar Stop API error:', errorData);
            return NextResponse.json(
                { error: 'Failed to stop session', details: errorData },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error stopping LiveAvatar session:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
