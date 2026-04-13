import React, { useState } from 'react';
import { FileJson, FileSpreadsheet, FileText, FileCode } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ExportFormat } from '@/types';

type ExportFormatValue = typeof ExportFormat[keyof typeof ExportFormat];

interface ExportDialogProps {
  onExport: (format: ExportFormatValue, config: ExportConfig) => void;
  // FIX: onClose passed in from the Dialog so Cancel actually closes it
  onClose?: () => void;
}

interface ExportConfig {
  includeFlows:      boolean;
  includeClusters:   boolean;
  includeAnomalies:  boolean;
  includeStatistics: boolean;
}

interface FormatOption {
  id:          ExportFormatValue;
  name:        string;
  icon:        LucideIcon;
  description: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onExport, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatValue>(ExportFormat.JSON);
  const [config, setConfig] = useState<ExportConfig>({
    includeFlows:      true,
    includeClusters:   true,
    includeAnomalies:  true,
    includeStatistics: true,
  });

  const formats: FormatOption[] = [
    { id: ExportFormat.JSON, name: 'JSON',       icon: FileJson,        description: 'JavaScript Object Notation' },
    { id: ExportFormat.CSV,  name: 'CSV',        icon: FileSpreadsheet, description: 'Comma Separated Values' },
    { id: ExportFormat.XML,  name: 'XML',        icon: FileCode,        description: 'Extensible Markup Language' },
    { id: ExportFormat.PDF,  name: 'PDF Report', icon: FileText,        description: 'Portable Document Format' },
  ];

  const handleExport = () => {
    onExport(selectedFormat, config);
    onClose?.();
  };

  return (
    <div className="space-y-6">
      {/* Format selection */}
      <div>
        <h4 className="text-sm font-medium mb-3">Select Format</h4>
        <div className="grid grid-cols-2 gap-3">
          {formats.map(({ id, name, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setSelectedFormat(id)}
              className={`
                flex items-start gap-3 p-3 rounded-lg border transition-all text-left
                ${selectedFormat === id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              <Icon className={`h-5 w-5 ${selectedFormat === id ? 'text-blue-500' : 'text-gray-500'}`} />
              <div>
                <p className="font-medium text-sm">{name}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Data selection */}
      <div>
        <h4 className="text-sm font-medium mb-3">Include Data</h4>
        <div className="space-y-3">
          {(
            [
              { id: 'includeFlows',      label: 'Network Flows',         detail: 'All flows will be exported' },
              { id: 'includeClusters',   label: 'Cluster Information',   detail: 'Cluster assignments and statistics' },
              { id: 'includeAnomalies',  label: 'Anomaly Detections',    detail: 'All detected anomalies' },
              { id: 'includeStatistics', label: 'Traffic Statistics',    detail: 'Summary statistics and metrics' },
            ] as const
          ).map(({ id, label, detail }) => (
            <div key={id} className="flex items-center space-x-2">
              <Checkbox
                id={id}
                checked={config[id]}
                onCheckedChange={checked =>
                  setConfig(prev => ({ ...prev, [id]: checked as boolean }))
                }
              />
              <Label htmlFor={id} className="text-sm">
                {label} ({config[id] ? detail : 'Excluded'})
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Preview */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <h4 className="text-sm font-medium mb-2">Export Preview</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <p>Format: <span className="font-medium">{selectedFormat.toUpperCase()}</span></p>
          <p>Data included:</p>
          <ul className="list-disc list-inside ml-2">
            {config.includeFlows      && <li>Network flows</li>}
            {config.includeClusters   && <li>Cluster information</li>}
            {config.includeAnomalies  && <li>Anomaly detections</li>}
            {config.includeStatistics && <li>Traffic statistics</li>}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {/* FIX: Cancel now calls onClose so the Dialog actually dismisses */}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleExport} className="gap-2">
          <FileJson className="h-4 w-4" />
          Export Data
        </Button>
      </div>
    </div>
  );
};

export default ExportDialog;