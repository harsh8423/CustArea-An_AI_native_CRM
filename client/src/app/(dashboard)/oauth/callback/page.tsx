"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

export default function OAuthCallbackPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("")

    useEffect(() => {
        const success = searchParams.get('success')
        const error = searchParams.get('error')

        if (success === 'true') {
            setStatus("success")
            setMessage("Gmail account connected successfully!")
            setTimeout(() => {
                router.push('/dashboard/settings/email')
            }, 2000)
        } else if (error) {
            setStatus("error")
            setMessage(decodeURIComponent(error))
            setTimeout(() => {
                router.push('/dashboard/settings/email')
            }, 3000)
        } else {
            setStatus("error")
            setMessage("Invalid callback parameters")
            setTimeout(() => {
                router.push('/dashboard/settings/email')
            }, 3000)
        }
    }, [searchParams, router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                {status === "loading" && (
                    <>
                        <Loader2 className="h-16 w-16 animate-spin text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900">Processing...</h2>
                        <p className="text-gray-600 mt-2">Connecting your Gmail account</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Success!</h2>
                        <p className="text-gray-600 mt-2">{message}</p>
                        <p className="text-sm text-gray-500 mt-4">Redirecting to settings...</p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Connection Failed</h2>
                        <p className="text-gray-600 mt-2">{message}</p>
                        <p className="text-sm text-gray-500 mt-4">Redirecting to settings...</p>
                    </>
                )}
            </div>
        </div>
    )
}
