"use client";

import { useState, useEffect } from "react";
import { X, MapPin, DollarSign } from "lucide-react";
import { api } from "@/lib/api";

interface RequestPhoneNumberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface PricingOption {
    country_code: string;
    country_name: string;
    local_monthly_cost: number | null;
    tollfree_monthly_cost: number | null;
}

export default function RequestPhoneNumberModal({
    isOpen,
    onClose,
    onSuccess
}: RequestPhoneNumberModalProps) {
    const [pricing, setPricing] = useState<PricingOption[]>([]);
    const [selectedCountry, setSelectedCountry] = useState("");
    const [phoneType, setPhoneType] = useState<'local' | 'toll-free'>('local');
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPricing();
        }
    }, [isOpen]);

    const loadPricing = async () => {
        setLoading(true);
        try {
            const res = await api.phoneNumbers.getPricing();
            setPricing(res.pricing || []);
        } catch (error) {
            console.error('Failed to load pricing:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectedPricing = pricing.find(p => p.country_code === selectedCountry);
    const currentCost = selectedPricing
        ? (phoneType === 'toll-free' ? selectedPricing.tollfree_monthly_cost : selectedPricing.local_monthly_cost)
        : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCountry) return;

        setSubmitting(true);
        try {
            await api.phoneNumbers.request({
                countryCode: selectedCountry,
                phoneType,
                notes: notes || undefined
            });
            onSuccess();
            onClose();
            // Reset form
            setSelectedCountry("");
            setPhoneType('local');
            setNotes("");
        } catch (error) {
            console.error('Failed to request phone number:', error);
            alert('Failed to request phone number');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Request Phone Number</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Country Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="h-4 w-4 inline mr-1" />
                            Country
                        </label>
                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                            required
                        >
                            <option value="">Select a country</option>
                            {pricing.map((p) => (
                                <option key={p.country_code} value={p.country_code}>
                                    {p.country_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Phone Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPhoneType('local')}
                                disabled={!selectedPricing?.local_monthly_cost}
                                className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${phoneType === 'local'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                Local
                            </button>
                            <button
                                type="button"
                                onClick={() => setPhoneType('toll-free')}
                                disabled={!selectedPricing?.tollfree_monthly_cost}
                                className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${phoneType === 'toll-free'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                Toll-Free
                            </button>
                        </div>
                    </div>

                    {/* Cost Display */}
                    {currentCost !== null && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Monthly Cost</span>
                                <div className="flex items-center gap-1">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                    <span className="text-2xl font-bold text-blue-600">{Number(currentCost).toFixed(2)}</span>
                                    <span className="text-sm text-gray-500">/mo</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any special requirements..."
                            rows={3}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm resize-none"
                        />
                    </div>

                    {/* Info */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <p className="text-xs text-amber-800">
                            <strong>Note:</strong> Your phone number request will be reviewed by an admin. Once approved, you'll be able to use it to create voice agents.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedCountry || submitting || currentCost === null}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
