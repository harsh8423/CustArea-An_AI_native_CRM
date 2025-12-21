'use client';

import { useState } from 'react';
import WorkflowList from './components/WorkflowList';
import WorkflowBuilder from './components/WorkflowBuilder';

export default function WorkflowPage() {
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

    if (selectedWorkflowId) {
        return (
            <WorkflowBuilder
                workflowId={selectedWorkflowId}
                onBack={() => setSelectedWorkflowId(null)}
            />
        );
    }

    return (
        <WorkflowList onSelectWorkflow={setSelectedWorkflowId} />
    );
}
