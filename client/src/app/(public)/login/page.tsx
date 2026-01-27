"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Shield, CheckCircle } from "lucide-react"
import { api } from "@/lib/api"

export default function LoginOTPPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<"email" | "verify" | "processing">("email")
    const [email, setEmail] = useState("")
    const [companyName, setCompanyName] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")

    // Check if user is already logged in
    useEffect(() => {
        const token = localStorage.getItem('token')
        if (token && !window.location.hash.includes('access_token')) {
            // User already has a token and this is not a callback, redirect to dashboard
            router.push('/dashboard')
        }
    }, [router])

    // Handle magic link callback from Supabase
    useEffect(() => {
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
            setStep("processing")
            handleMagicLinkCallback(hash)
        }
    }, [])

    const handleMagicLinkCallback = async (hash: string) => {
        try {
            setError("")

            // Parse tokens from URL hash
            const params = new URLSearchParams(hash.substring(1))
            const accessToken = params.get('access_token')
            const refreshToken = params.get('refresh_token')

            if (!accessToken) {
                throw new Error('No access token in URL')
            }

            // Get stored email and company name from earlier step
            const storedEmail = localStorage.getItem('pendingEmail')
            const storedCompanyName = localStorage.getItem('pendingCompanyName')

            // Extract email from the token as a fallback
            const emailFromToken = parseEmailFromToken(accessToken)
            const finalEmail = storedEmail || emailFromToken

            if (!finalEmail) {
                throw new Error('Could not determine email address')
            }

            // Call backend to complete authentication and create user/tenant if needed
            const response = await fetch('http://localhost:8000/api/v2/auth/verify-magic-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    email: finalEmail,
                    companyName: storedCompanyName,
                    supabaseToken: accessToken
                })
            })

            const data = await response.json()

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to complete authentication')
            }

            // Store the session token
            if (data.session?.accessToken) {
                localStorage.setItem("token", data.session.accessToken)
                document.cookie = `token=${data.session.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict` // 7 days
            }

            // Clear pending data
            localStorage.removeItem('pendingEmail')
            localStorage.removeItem('pendingCompanyName')

            // Clear hash from URL
            window.history.replaceState(null, '', window.location.pathname)

            // Show success and redirect
            setMessage(`Welcome ${data.user.name || 'back'}!`)
            setTimeout(() => {
                router.push("/dashboard")
            }, 500)

        } catch (err) {
            console.error('Magic link error:', err)
            setError(err instanceof Error ? err.message : 'Failed to process magic link. Please try again.')
            setStep("email")

            // Clear hash on error
            window.history.replaceState(null, '', window.location.pathname)
        }
    }

    const parseEmailFromToken = (token: string): string | null => {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            return payload.email || null
        } catch {
            return null
        }
    }

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setMessage("")

        try {
            // Store company name and email for later use
            localStorage.setItem('pendingCompanyName', companyName)
            localStorage.setItem('pendingEmail', email)

            const data = await api.auth.signupWithOTP({ email, companyName })

            if (data.error) {
                throw new Error(data.error || "Failed to send verification")
            }

            setMessage("Check your email! We've sent you a verification link.")
            setStep("verify")
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError("An error occurred")
            }
        } finally {
            setLoading(false)
        }
    }

    if (step === "processing") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
                    <div>
                        <p className="text-lg font-medium">Completing authentication...</p>
                        <p className="text-sm text-gray-500">Please wait</p>
                    </div>
                    {message && (
                        <div className="flex items-center justify-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            <span>{message}</span>
                        </div>
                    )}
                    {error && (
                        <div className="text-red-600 text-sm max-w-md mx-auto">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left: Form */}
            <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-20 xl:px-24 bg-white text-black">
                <div className="w-full max-w-sm mx-auto space-y-8">
                    <div>
                        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-black transition mb-8">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {step === "email" ? "Sign in to CustArea" : "Check your email"}
                        </h1>
                        <p className="text-gray-500 mt-2">
                            {step === "email"
                                ? "Enter your email and company name to continue"
                                : `We sent a verification link to ${email}`}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
                            {message}
                        </div>
                    )}

                    {step === "email" ? (
                        <form onSubmit={handleSendLink} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                    placeholder="Acme Inc."
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                {loading ? "Sending..." : "Continue with email"}
                            </button>

                            <p className="text-xs text-center text-gray-500">
                                Session lasts 7 days. You'll stay logged in until you sign out.
                            </p>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium text-blue-900">Click the link in your email</p>
                                        <p className="text-blue-700 mt-1">The link will sign you in automatically and redirect you to your dashboard.</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setStep("email")
                                    setError("")
                                    setMessage("")
                                }}
                                className="w-full py-2 text-sm text-gray-600 hover:text-black transition"
                            >
                                Use a different email
                            </button>
                        </div>
                    )}

                    <div className="text-center text-xs text-gray-400">
                        <Link href="/login-legacy" className="hover:text-gray-600 transition">
                            Use password instead (legacy)
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right: Visual */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/40 via-black to-black"></div>
                <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
                        <Shield className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-bold">&quot;Passwordless authentication is the future.&quot;</h2>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-10 w-10 bg-white/10 rounded-full"></div>
                        <div className="text-left">
                            <div className="font-medium">Alex Chen</div>
                            <div className="text-sm text-gray-400">Security Engineer</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
