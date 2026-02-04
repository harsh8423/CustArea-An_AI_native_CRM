import React from 'react';
import { Download } from 'lucide-react';
import { analyticsApi } from '@/lib/analyticsApi';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
    params: {
        userId?: string;
        timeRange?: 'daily' | 'weekly' | 'monthly';
        category?: string;
        startDate?: string;
        endDate?: string;
    };
}

export default function ExportButton({ params }: ExportButtonProps) {
    const [exporting, setExporting] = React.useState(false);

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            setExporting(true);
            const blob = await analyticsApi.exportAnalytics({
                ...params,
                format
            });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export analytics data');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="flex items-center space-x-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="flex items-center space-x-2"
            >
                <Download className="w-4 h-4" />
                <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                disabled={exporting}
                className="flex items-center space-x-2"
            >
                <Download className="w-4 h-4" />
                <span>{exporting ? 'Exporting...' : 'Export JSON'}</span>
            </Button>
        </div>
    );
}
