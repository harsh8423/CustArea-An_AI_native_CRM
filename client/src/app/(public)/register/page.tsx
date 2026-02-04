"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, Mail, Lock } from "lucide-react"
import { api } from "@/lib/api"

export default function RegisterPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        companyName: "",
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
            // Auto-generate slug from company name
            const slug = formData.companyName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || `tenant-${Date.now()}`;

            const data = await api.auth.register({
                ...formData,
                slug
            })

            if (data.error) {
                throw new Error(data.error || "Registration failed")
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
                setError("An error occurred during registration")
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
                        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
                        <p className="text-gray-500 mt-2">Get started with your 14-day free trial.</p>
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Company Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    name="companyName"
                                    type="text"
                                    required
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                    placeholder="Acme Inc."
                                    value={formData.companyName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
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
                            <label className="text-sm font-medium">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                    placeholder="Create a strong password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    minLength={8}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Creating account..." : "Sign up"}
                        </button>
                    </form>

                    <div className="text-center text-sm">
                        <span className="text-gray-500">Already have an account? </span>
                        <Link href="/login" className="font-medium hover:underline">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right: Visual */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/40 via-black to-black"></div>
                <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
                    <h2 className="text-3xl font-bold">&quot;The platform that scales with your ambition.&quot;</h2>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-10 w-10 bg-white/10 rounded-full"></div>
                        <div className="text-left">
                            <div className="font-medium">David Park</div>
                            <div className="text-sm text-gray-400">CTO, scaleUp</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
