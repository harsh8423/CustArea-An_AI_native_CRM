'use client';

import { useState } from 'react';

export default function CallPage() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [status, setStatus] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const makeCall = async () => {
        if (!phoneNumber) {
            setStatus('Please enter a phone number.');
            setIsError(true);
            return;
        }

        setStatus('Initiating call...');
        setIsError(false);
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8000/make-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ to: phoneNumber }),
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Failed to parse JSON: ${text.substring(0, 100)}...`);
            }

            if (response.ok) {
                setStatus(`Call initiated! SID: ${data.callSid}`);
                setIsError(false);
            } else {
                setStatus(`Error: ${data.message || 'Failed to initiate call'}`);
                setIsError(true);
            }
        } catch (error: any) {
            console.error('Error:', error);
            setStatus(`Error: ${error.message}`);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Make Outbound Call</h2>
                <input
                    type="tel"
                    placeholder="Enter phone number (e.g., +1234567890)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <button
                    onClick={makeCall}
                    disabled={isLoading}
                    className={`w-full p-3 text-white rounded-md transition-colors ${isLoading
                            ? 'bg-blue-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {isLoading ? 'Calling...' : 'Call'}
                </button>
                {status && (
                    <div
                        className={`mt-4 p-3 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}
                    >
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
