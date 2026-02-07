import { useState, useRef } from "react";
import { Upload, ArrowRight, Check, AlertCircle, X } from "lucide-react";
import { api } from "@/lib/api";

interface ImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

export function ImportWizard({ isOpen, onClose, onComplete }: ImportWizardProps) {
    const [step, setStep] = useState<"upload" | "map" | "process">("upload");
    const [jobId, setJobId] = useState<string | null>(null);
    const [columns, setColumns] = useState<any[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Group selection state
    const [groupOption, setGroupOption] = useState<'none' | 'existing' | 'new'>('none');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [newGroupName, setNewGroupName] = useState('');
    const [availableGroups, setAvailableGroups] = useState<any[]>([]);

    if (!isOpen) return null;

    // Load available groups when wizard opens
    const loadGroups = async () => {
        try {
            const data = await api.contactGroups.list();
            setAvailableGroups(data.groups || []);
        } catch (err) {
            console.error("Failed to load groups", err);
        }
    };

    // Load groups on open
    if (isOpen && availableGroups.length === 0) {
        loadGroups();
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const data = await api.import.upload(file);
            setJobId(data.jobId);

            // Fetch columns for mapping
            const jobData = await api.import.getJob(data.jobId);
            setColumns(jobData.columns);

            // Auto-map based on normalized names
            const initialMappings: Record<string, string> = {};
            jobData.columns.forEach((col: any) => {
                if (['name', 'email', 'phone', 'company', 'company_name'].includes(col.normalized_name)) {
                    initialMappings[col.id] = col.normalized_name === 'company' ? 'company_name' : col.normalized_name;
                }
            });
            setMappings(initialMappings);

            setStep("map");
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed");
        } finally {
            setLoading(false);
        }
    };

    const handleMappingChange = (columnId: string, field: string) => {
        setMappings(prev => ({ ...prev, [columnId]: field }));
    };

    const handleProcess = async () => {
        if (!jobId) return;
        setLoading(true);
        try {
            await api.import.map(jobId, mappings);

            // Prepare group data
            const groupData: any = {};
            if (groupOption === 'existing' && selectedGroupId) {
                groupData.group_id = selectedGroupId;
            } else if (groupOption === 'new' && newGroupName.trim()) {
                groupData.create_group = true;
                groupData.group_name = newGroupName.trim();
            }

            const res = await api.import.process(jobId, groupData);
            setResult(res);
            setStep("process");
        } catch (err) {
            console.error("Processing failed", err);
            alert("Processing failed");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep("upload");
        setJobId(null);
        setResult(null);
        setGroupOption('none');
        setSelectedGroupId('');
        setNewGroupName('');
        onClose();
        if (step === "process") onComplete();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Import Contacts</h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-black">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-auto">
                    {step === "upload" && (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                <Upload className="h-6 w-6 text-black" />
                            </div>
                            <h4 className="font-medium mb-2">Upload CSV or Excel File</h4>
                            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
                                Upload a CSV (.csv) or Excel (.xlsx, .xls) file with your contacts.
                            </p>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                                className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
                            >
                                {loading ? "Uploading..." : "Select File"}
                            </button>
                        </div>
                    )}

                    {step === "map" && (
                        <div className="space-y-4">
                            {/* Group Selection Section */}
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="font-medium text-sm mb-3 text-gray-900">📁 Group Assignment (Optional)</h4>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="groupOption"
                                            checked={groupOption === 'none'}
                                            onChange={() => setGroupOption('none')}
                                            className="text-blue-600"
                                        />
                                        <span>Don't add to a group</span>
                                    </label>

                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="groupOption"
                                            checked={groupOption === 'existing'}
                                            onChange={() => setGroupOption('existing')}
                                            className="text-blue-600"
                                        />
                                        <span>Add to existing group</span>
                                    </label>
                                    {groupOption === 'existing' && (
                                        <select
                                            value={selectedGroupId}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                            className="ml-6 w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Select a group...</option>
                                            {availableGroups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0} contacts)</option>
                                            ))}
                                        </select>
                                    )}

                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="groupOption"
                                            checked={groupOption === 'new'}
                                            onChange={() => setGroupOption('new')}
                                            className="text-blue-600"
                                        />
                                        <span>Create new group</span>
                                    </label>
                                    {groupOption === 'new' && (
                                        <input
                                            type="text"
                                            placeholder="Enter group name..."
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            className="ml-6 w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Column Mapping Section */}
                            <p className="text-sm text-gray-500">Map columns from your file to CRM fields.</p>
                            <div className="space-y-2">
                                {columns.map(col => {
                                    const currentMapping = mappings[col.id] || "";
                                    const standardFields = ["name", "email", "phone", "company_name", "source", ""];
                                    const isCustomField = currentMapping && !standardFields.includes(currentMapping);
                                    const displayValue = isCustomField ? "__custom__" : currentMapping;

                                    return (
                                        <div key={col.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{col.original_name}</div>
                                                <div className="text-xs text-gray-500">Detected: {col.detected_type}</div>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-gray-400" />
                                            <div className="flex-1">
                                                <select
                                                    className="w-full p-2 text-sm border border-gray-200 rounded-md"
                                                    value={displayValue}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (value === "__custom__") {
                                                            handleMappingChange(col.id, col.normalized_name);
                                                        } else {
                                                            handleMappingChange(col.id, value);
                                                        }
                                                    }}
                                                >
                                                    <option value="">Skip</option>
                                                    <option value="name">Name</option>
                                                    <option value="email">Email</option>
                                                    <option value="phone">Phone</option>
                                                    <option value="company_name">Company Name</option>
                                                    <option value="source">Source</option>
                                                    <option value="__custom__">Custom Field ({col.normalized_name})</option>
                                                </select>
                                                {isCustomField && (
                                                    <div className="text-xs text-green-600 mt-1">→ Will save as: {currentMapping}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === "process" && result && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check className="h-8 w-8" />
                            </div>
                            <h4 className="text-xl font-bold mb-2">Import Complete</h4>
                            <p className="text-gray-500 mb-6">
                                Successfully processed {result.processed} contacts.
                                {result.errors > 0 && <span className="text-red-500 block mt-1">{result.errors} errors occurred.</span>}
                            </p>
                            <button
                                onClick={handleClose}
                                className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === "map" && (
                    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                        <button
                            onClick={() => setStep("upload")}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleProcess}
                            disabled={loading || (groupOption === 'new' && !newGroupName.trim()) || (groupOption === 'existing' && !selectedGroupId)}
                            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Processing..." : "Import Contacts"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
