'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import { saveWorkflowVersion, publishWorkflow, triggerWorkflow, testWorkflow } from '../api';
import {
    Save,
    Upload,
    Play,
    TestTube2,
    History,
    Settings,
    Undo2,
    Redo2,
    ZoomIn,
    ZoomOut,
    Maximize2,
    ArrowLeft,
    Loader2,
    Check,
    AlertCircle
} from 'lucide-react';

interface WorkflowToolbarProps {
    onBack: () => void;
}

export default function WorkflowToolbar({ onBack }: WorkflowToolbarProps) {
    const {
        currentWorkflow,
        currentVersion,
        nodes,
        edges,
        hasUnsavedChanges,
        isSaving,
        setIsSaving,
        setHasUnsavedChanges,
        toggleRunsPanel,
        showRunsPanel,
        setCurrentWorkflow
    } = useWorkflowStore();

    const [publishStatus, setPublishStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [runStatus, setRunStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSave = async () => {
        if (!currentWorkflow) return;

        setIsSaving(true);
        try {
            const newVersion = await saveWorkflowVersion(currentWorkflow.id, { nodes, edges });
            // Update current version in store
            if (currentWorkflow) {
                setCurrentWorkflow(
                    { ...currentWorkflow, latest_version: newVersion.version_number },
                    newVersion
                );
            }
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to save:', error);
            alert('Failed to save workflow');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!currentWorkflow || !currentVersion) return;

        setPublishStatus('loading');
        try {
            // Save first if there are changes
            if (hasUnsavedChanges) {
                await handleSave();
            }

            const latestVersion = useWorkflowStore.getState().currentVersion;
            if (!latestVersion) return;

            await publishWorkflow(currentWorkflow.id, latestVersion.id);
            setPublishStatus('success');
            setTimeout(() => setPublishStatus('idle'), 2000);
        } catch (error: any) {
            console.error('Failed to publish:', error);
            alert(error.message || 'Failed to publish workflow');
            setPublishStatus('error');
            setTimeout(() => setPublishStatus('idle'), 2000);
        }
    };

    const handleTest = async () => {
        if (!currentWorkflow) return;

        setTestStatus('loading');
        try {
            const result = await testWorkflow(currentWorkflow.id, { payload: {} });
            console.log('Test result:', result);
            setTestStatus('success');
            setTimeout(() => setTestStatus('idle'), 2000);
        } catch (error: any) {
            console.error('Test failed:', error);
            alert(error.message || 'Test failed');
            setTestStatus('error');
            setTimeout(() => setTestStatus('idle'), 2000);
        }
    };

    const handleRun = async () => {
        if (!currentWorkflow) return;

        setRunStatus('loading');
        try {
            const result = await triggerWorkflow(currentWorkflow.id, {});
            console.log('Run started:', result);
            setRunStatus('success');
            setTimeout(() => setRunStatus('idle'), 2000);
        } catch (error: any) {
            console.error('Run failed:', error);
            alert(error.message || 'Failed to run workflow');
            setRunStatus('error');
            setTimeout(() => setRunStatus('idle'), 2000);
        }
    };

    const getButtonIcon = (status: string, defaultIcon: React.ReactNode) => {
        switch (status) {
            case 'loading': return <Loader2 className="w-4 h-4 animate-spin" />;
            case 'success': return <Check className="w-4 h-4" />;
            case 'error': return <AlertCircle className="w-4 h-4" />;
            default: return defaultIcon;
        }
    };

    return (
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            {/* Left Section */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back to workflows"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>

                <div className="h-6 w-px bg-gray-200" />

                <div>
                    <h1 className="font-semibold text-gray-900">
                        {currentWorkflow?.name || 'Untitled Workflow'}
                    </h1>
                    <p className="text-xs text-gray-500">
                        Version {currentVersion?.version_number || 1}
                        {hasUnsavedChanges && <span className="text-amber-500 ml-1">• Unsaved changes</span>}
                        {currentVersion?.is_published && <span className="text-emerald-500 ml-1">• Published</span>}
                    </p>
                </div>
            </div>

            {/* Center Section - Undo/Redo */}
            <div className="flex items-center gap-1">
                <button
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    title="Undo"
                    disabled
                >
                    <Undo2 className="w-4 h-4" />
                </button>
                <button
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    title="Redo"
                    disabled
                >
                    <Redo2 className="w-4 h-4" />
                </button>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
                {/* History */}
                <button
                    onClick={toggleRunsPanel}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        showRunsPanel
                            ? "bg-violet-100 text-violet-700"
                            : "text-gray-600 hover:bg-gray-100"
                    )}
                >
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">History</span>
                </button>

                <div className="h-6 w-px bg-gray-200 mx-1" />

                {/* Test */}
                <button
                    onClick={handleTest}
                    disabled={testStatus === 'loading'}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        testStatus === 'success' ? "bg-emerald-100 text-emerald-700" :
                            testStatus === 'error' ? "bg-red-100 text-red-700" :
                                "text-gray-600 hover:bg-gray-100"
                    )}
                >
                    {getButtonIcon(testStatus, <TestTube2 className="w-4 h-4" />)}
                    <span className="hidden sm:inline">Test</span>
                </button>

                {/* Run */}
                <button
                    onClick={handleRun}
                    disabled={runStatus === 'loading' || !currentVersion?.is_published}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        runStatus === 'success' ? "bg-emerald-100 text-emerald-700" :
                            runStatus === 'error' ? "bg-red-100 text-red-700" :
                                !currentVersion?.is_published ? "text-gray-400 cursor-not-allowed" :
                                    "text-gray-600 hover:bg-gray-100"
                    )}
                    title={!currentVersion?.is_published ? "Publish first to run" : "Run workflow"}
                >
                    {getButtonIcon(runStatus, <Play className="w-4 h-4" />)}
                    <span className="hidden sm:inline">Run</span>
                </button>

                <div className="h-6 w-px bg-gray-200 mx-1" />

                {/* Save */}
                <button
                    onClick={handleSave}
                    disabled={isSaving || !hasUnsavedChanges}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        hasUnsavedChanges
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            : "text-gray-400 cursor-not-allowed"
                    )}
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="hidden sm:inline">Save</span>
                </button>

                {/* Active/Inactive Toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {currentWorkflow?.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <button
                        onClick={handlePublish}
                        disabled={publishStatus === 'loading'}
                        className={cn(
                            "relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
                            publishStatus === 'loading' ? 'opacity-50 cursor-wait' :
                                currentWorkflow?.status === 'active'
                                    ? 'bg-emerald-500 focus:ring-emerald-500'
                                    : 'bg-gray-300 focus:ring-gray-400'
                        )}
                        title={currentWorkflow?.status === 'active' ? 'Workflow is active' : 'Save & activate workflow'}
                    >
                        <span
                            className={cn(
                                "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform flex items-center justify-center",
                                currentWorkflow?.status === 'active' ? 'translate-x-6' : 'translate-x-0'
                            )}
                        >
                            {publishStatus === 'loading' && (
                                <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                            )}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
