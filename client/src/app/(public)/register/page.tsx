"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function RegisterRedirectPage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to new OTP login - signup and signin are the same flow now
        router.push("/login")
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <p className="text-gray-600">Redirecting to signup...</p>
            </div>
        </div>
    )
}
