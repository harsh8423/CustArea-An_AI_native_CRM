"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"

export default function LoginLegacyPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    })
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const data = await api.auth.login(formData)

            if (data.error) {
                // Check if server suggests using OTP
                if ((data as any).useOTP) {
                    setError("Your account has been migrated to passwordless authentication. Please use OTP login instead.")
                    setTimeout(() => router.push("/login"), 2000)
                    return
                }
                throw new Error(data.error || "Login failed")
            }

            if (data.token) {
                localStorage.setItem("token", data.token)
                document.cookie = `token=${data.token}; path=/; max-age=86400; SameSite=Strict`
                router.push("/dashboard")
            }
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

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left: Form */}
            <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-20 xl:px-24 bg-white text-black">
                <div className="w-full max-w-sm mx-auto space-y-8">
                    <div>
                        <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-black transition mb-8">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to OTP Login
                        </Link>
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4">
                            <p className="text-xs text-yellow-800">
                                ⚠️ Password-based login is deprecated. Please use the new OTP authentication for better security.
                            </p>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Legacy Password Login</h1>
                        <p className="text-gray-500 mt-2">Enter your password to access your account.</p>
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                placeholder="name@company.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

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
                    <h2 className="text-3xl font-bold">&quot;The most intuitive CRM we&apos;ve ever used.&quot;</h2>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-10 w-10 bg-white/10 rounded-full"></div>
                        <div className="text-left">
                            <div className="font-medium">Sarah Johnson</div>
                            <div className="text-sm text-gray-400">Head of Sales, TechCorp</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
