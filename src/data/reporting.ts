// Reporting & API Integration Utilities
import type { ReportConfig, ReportSection } from '@/types';

export function generateReport(config: ReportConfig, data: any): string {
  // Simple markdown report generator
  let report = `# ${config.title}\n\n`;
  for (const section of config.sections) {
    report += `## ${section.title}\n`;
    if (section.type === 'summary') {
      report += `Total Flows: ${data.statistics?.totalFlows ?? 0}\n`;
      report += `Anomalies: ${data.statistics?.anomalyCount ?? 0}\n`;
      report += `Clusters: ${data.statistics?.clusterCount ?? 0}\n`;
    } else if (section.type === 'flows') {
      report += `Flows:\n`;
      for (const flow of data.flows.slice(0, 10)) {
        report += `- ${flow.id} (${flow.sourceIP} → ${flow.destinationIP})\n`;
      }
    } else if (section.type === 'anomalies') {
      report += `Anomalies:\n`;
      for (const anomaly of data.anomalies.slice(0, 10)) {
        report += `- ${anomaly.description} (Severity: ${anomaly.severity})\n`;
      }
    }
    report += '\n';
  }
  return report;
}

// Example API integration (stub)
export async function sendReportToAPI(report: string, endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: report
    });
    return res.ok;
  } catch {
    return false;
  }
}
