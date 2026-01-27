"use client"

import { useEffect, useState } from "react"
import { Mail, Plus, CheckCircle, XCircle, Loader2, Trash2, Star } from "lucide-react"

interface EmailConnection {
    id: string
    provider_type: string
    email: string
    is_default: boolean
    is_active: boolean
    expires_at?: string
}

export default function EmailSettingsPage() {
    const [connections, setConnections] = useState<EmailConnection[]>([])
    const [loading, setLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        fetchConnections()
    }, [])

    const fetchConnections = async () => {
        try {
            const token = localStorage.getItem("token")
            const res = await fetch("http://localhost:8000/api/settings/email/gmail/status", {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()

            if (data.connections) {
                setConnections(data.connections)
            }
        } catch (err) {
            console.error("Failed to fetch connections:", err)
            setError("Failed to load email connections")
        } finally {
            setLoading(false)
        }
    }

    const handleConnectGmail = async () => {
        try {
            setConnecting(true)
            setError("")

            const token = localStorage.getItem("token")
            const res = await fetch("http://localhost:8000/api/settings/email/gmail/authorize", {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()

            if (data.authorizationUrl) {
                // Redirect to Google OAuth
                window.location.href = data.authorizationUrl
            } else {
                throw new Error("No authorization URL received")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to initiate Gmail connection")
            setConnecting(false)
        }
    }

    const handleDisconnect = async (connectionId: string) => {
        if (!confirm("Are you sure you want to disconnect this email account?")) {
            return
        }

        try {
            const token = localStorage.getItem("token")
            const res = await fetch(`http://localhost:8000/api/settings/email/gmail/disconnect/${connectionId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })

            if (res.ok) {
                setSuccess("Email account disconnected successfully")
                fetchConnections()
                setTimeout(() => setSuccess(""), 3000)
            } else {
                throw new Error("Failed to disconnect")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to disconnect account")
        }
    }

    const handleSetDefault = async (connectionId: string) => {
        try {
            const token = localStorage.getItem("token")
            const res = await fetch(`http://localhost:8000/api/settings/email/gmail/set-default/${connectionId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            })

            if (res.ok) {
                setSuccess("Default email account updated")
                fetchConnections()
                setTimeout(() => setSuccess(""), 3000)
            } else {
                throw new Error("Failed to set default")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to set default account")
        }
    }

    const getProviderLogo = (provider: string) => {
        if (provider === 'gmail') {
            return '📧' // Could use actual Gmail logo
        }
        return '📨'
    }

    const getProviderName = (provider: string) => {
        return provider.charAt(0).toUpperCase() + provider.slice(1)
    }

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="border-b border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Mail className="h-6 w-6" />
                    Email Settings
                </h2>
                <p className="text-gray-600 mt-1">Connect and manage your email accounts</p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {success && (
                <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800">{success}</p>
                </div>
            )}

            <div className="p-6">
                {/* Connect Gmail Button */}
                <div className="mb-8">
                    <button
                        onClick={handleConnectGmail}
                        disabled={connecting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {connecting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Plus className="h-5 w-5" />
                                Connect Gmail Account
                            </>
                        )}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                        Connect your Gmail account to send and receive emails
                    </p>
                </div>

                {/* Connected Accounts */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Accounts</h3>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : connections.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium">No email accounts connected</p>
                            <p className="text-sm text-gray-500 mt-1">Connect Gmail to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {connections.map((connection) => (
                                <div
                                    key={connection.id}
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{getProviderLogo(connection.provider_type)}</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-gray-900">{connection.email}</p>
                                                {connection.is_default && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                                        <Star className="h-3 w-3" />
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500">{getProviderName(connection.provider_type)}</p>
                                            {connection.expires_at && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Expires: {new Date(connection.expires_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {connection.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                                                <CheckCircle className="h-4 w-4" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                                                <XCircle className="h-4 w-4" />
                                                Inactive
                                            </span>
                                        )}

                                        {!connection.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(connection.id)}
                                                className="px-3 py-1 text-sm text-gray-700 hover:text-black border border-gray-300 rounded-lg hover:border-black transition-colors"
                                            >
                                                Set as Default
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDisconnect(connection.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Disconnect account"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">How it works</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Connect your Gmail account to send and receive emails</li>
                        <li>• Set a default account for sending emails</li>
                        <li>• Your credentials are securely encrypted</li>
                        <li>• You can connect multiple email accounts</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
