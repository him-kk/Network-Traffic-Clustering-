import React, { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

interface PCAPUploadProps {
  onImport: (file: File) => void;
  isLoading?: boolean;
}

export const PCAPUpload: React.FC<PCAPUploadProps> = ({ onImport, isLoading = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError(null);

    // Validate file
    if (!file.name.endsWith('.pcap') && !file.name.endsWith('.pcapng')) {
      setError('Invalid file type. Please upload a .pcap or .pcapng file.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum 100 MB allowed.');
      return;
    }

    setFileName(file.name);
    onImport(file);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Import PCAP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import PCAP File</DialogTitle>
        </DialogHeader>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Drag and drop your PCAP file here
          </p>
          <p className="text-xs text-gray-500 mb-4">
            or click to select
          </p>

          <input
            type="file"
            accept=".pcap,.pcapng"
            onChange={handleChange}
            className="hidden"
            id="pcap-upload"
            disabled={isLoading}
          />
          <label htmlFor="pcap-upload">
            <Button
              asChild
              variant="default"
              size="sm"
              disabled={isLoading}
            >
              <span className="cursor-pointer">
                {isLoading ? 'Processing...' : 'Select File'}
              </span>
            </Button>
          </label>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fileName && !error && (
          <Alert>
            <AlertDescription>
              ✅ File selected: <strong>{fileName}</strong>
              <p className="text-xs mt-1">Processing will import the packets into your dashboard.</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Supported formats:</strong> .pcap, .pcapng</p>
          <p><strong>Maximum file size:</strong> 100 MB</p>
          <p><strong>Tip:</strong> Capture with tcpdump: <code className="bg-gray-200 px-1">tcpdump -i eth0 -w capture.pcap</code></p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PCAPUpload;
