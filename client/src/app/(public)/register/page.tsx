"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"

export default function RegisterPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        companyName: "",
        email: "",
        password: "",
        slug: "",
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
            const data = await api.auth.register(formData)

            if (data.error) {
                throw new Error(data.error || "Registration failed")
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
                        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-black transition mb-8">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
                        <p className="text-gray-500 mt-2">Start your 14-day free trial. No credit card required.</p>
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Company Name</label>
                            <input
                                name="companyName"
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                placeholder="Acme Inc."
                                value={formData.companyName}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Workspace Slug</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                                    crm.com/
                                </span>
                                <input
                                    name="slug"
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition"
                                    placeholder="acme"
                                    value={formData.slug}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Work Email</label>
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
                            {loading ? "Create account" : "Get started"}
                        </button>
                    </form>

                    <div className="text-center text-sm">
                        <span className="text-gray-500">Already have an account? </span>
                        <Link href="/login" className="font-medium hover:underline">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right: Visual */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/40 via-black to-black"></div>
                <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
                    <h2 className="text-3xl font-bold">Join thousands of high-growth companies.</h2>
                    <div className="grid grid-cols-3 gap-8 opacity-50 grayscale">
                        {/* Placeholders for logos */}
                        <div className="h-8 bg-white/20 rounded"></div>
                        <div className="h-8 bg-white/20 rounded"></div>
                        <div className="h-8 bg-white/20 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}
