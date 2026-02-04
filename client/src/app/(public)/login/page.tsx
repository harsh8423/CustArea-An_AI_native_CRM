"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Lock, Shield, Send, CheckCircle } from "lucide-react"
import { api } from "@/lib/api"

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    })
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [useMagicLink, setUseMagicLink] = useState(false)
    const [magicLinkSent, setMagicLinkSent] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const [sendingLink, setSendingLink] = useState(false)

    // Check if user is already logged in
    useEffect(() => {
        const token = localStorage.getItem('token')
        if (token) {
            router.push('/dashboard')
        }
    }, [router])

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [resendCooldown])

    // Handle magic link callback from email
    useEffect(() => {
        const handleMagicLinkCallback = async () => {
            // Parse hash parameters from URL
            const hash = window.location.hash
            if (!hash || !hash.includes('access_token')) return

            const params = new URLSearchParams(hash.substring(1)) // Remove '#' and parse
            const accessToken = params.get('access_token')
            const type = params.get('type')

            if (!accessToken || type !== 'magiclink') return

            setLoading(true)
            setError("")

            try {
                // Decode JWT to extract email (JWT format: header.payload.signature)
                const payloadBase64 = accessToken.split('.')[1]
                const payloadJson = atob(payloadBase64)
                const payload = JSON.parse(payloadJson)
                const email = payload.email

                if (!email) {
                    setError("Could not extract email from authentication token")
                    return
                }

                // Verify the magic link with backend
                const result = await api.auth.verifyMagicLink({
                    email: email.toLowerCase(),
                    supabaseToken: accessToken,
                    companyName: "" // Not needed for existing users
                })

                if (result.error) {
                    throw new Error(result.error)
                }

                if (result.token) {
                    // Store token and redirect to dashboard
                    localStorage.setItem("token", result.token)
                    document.cookie = `token=${result.token}; path=/; max-age=604800; SameSite=Strict`

                    // Clean up URL hash
                    window.location.hash = ''

                    // Redirect to dashboard
                    router.push("/dashboard")
                } else {
                    setError("Authentication failed. Please try again.")
                }
            } catch (err) {
                console.error("Magic link verification error:", err)
                if (err instanceof Error) {
                    setError(err.message)
                } else {
                    setError("Failed to verify magic link. Please try again.")
                }
                // Clean up URL hash on error
                window.location.hash = ''
            } finally {
                setLoading(false)
            }
        }

        handleMagicLinkCallback()
    }, [router])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSendMagicLink = async () => {
        if (!formData.email) {
            setError("Please enter your email address")
            return
        }

        setSendingLink(true)
        setError("")

        try {
            const response = await api.auth.signupWithOTP({
                email: formData.email,
                companyName: "Login" // Not used for existing users
            })

            if (response.error) {
                throw new Error(response.error)
            }

            setMagicLinkSent(true)
            setResendCooldown(30) // 30 second cooldown
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError("Failed to send magic link. Please try again.")
            }
        } finally {
            setSendingLink(false)
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const data = await api.auth.login(formData)

            if (data.error) {
                // Check if the error indicates OTP is required
                if (data.useOTP || data.error.toLowerCase().includes('magic link')) {
                    setUseMagicLink(true)
                    setError(data.error)
                    return
                }
                throw new Error(data.error || "Login failed")
            }

            if (data.token) {
                localStorage.setItem("token", data.token)
                document.cookie = `token=${data.token}; path=/; max-age=604800; SameSite=Strict` // 7 days
                router.push("/dashboard")
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError("Invalid email or password")
            }
        } finally {
            setLoading(false)
        }
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
                        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                        <p className="text-gray-500 mt-2">
                            Enter your credentials to access your account.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}

                    {magicLinkSent && (
                        <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Check your email!</p>
                                <p className="text-green-600/80 mt-1">
                                    We've sent a magic link to <strong>{formData.email}</strong>.
                                    Click the link in the email to sign in.
                                </p>
                            </div>
                        </div>
                    )}

                    {!useMagicLink ? (
                        // Password login form
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                        placeholder="name@company.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Password</label>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                {loading ? "Signing in..." : "Sign in"}
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUseMagicLink(true)
                                        setError("")
                                    }}
                                    className="text-sm text-gray-600 hover:text-black transition-colors"
                                >
                                    Or use Magic Link instead
                                </button>
                            </div>
                        </form>
                    ) : (
                        // Magic link form
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                        placeholder="name@company.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        disabled={magicLinkSent}
                                    />
                                </div>
                            </div>

                            {!magicLinkSent ? (
                                <button
                                    type="button"
                                    onClick={handleSendMagicLink}
                                    disabled={sendingLink}
                                    className="w-full py-2.5 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Send className="h-4 w-4" />
                                    {sendingLink ? "Sending..." : "Send Magic Link"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSendMagicLink}
                                    disabled={resendCooldown > 0 || sendingLink}
                                    className="w-full py-2.5 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    {resendCooldown > 0
                                        ? `Resend in ${resendCooldown}s`
                                        : sendingLink
                                            ? "Sending..."
                                            : "Resend Magic Link"}
                                </button>
                            )}

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUseMagicLink(false)
                                        setMagicLinkSent(false)
                                        setError("")
                                    }}
                                    className="text-sm text-gray-600 hover:text-black transition-colors"
                                >
                                    Back to Password Login
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-center text-sm">
                        <span className="text-gray-500">Don&apos;t have an account? </span>
                        <Link href="/register" className="font-medium hover:underline">
                            Sign up
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
                    <h2 className="text-3xl font-bold">&quot;Secure, scalable, and simple.&quot;</h2>
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
