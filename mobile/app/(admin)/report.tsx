import { ReportScreen } from '@/src/components/reports/ReportScreen';
import { useAdminReportData } from '@/src/components/reports/useReportData';

export default function ReportDetailScreen() {
  const state = useAdminReportData();
  return <ReportScreen audience="admin" state={state} />;
}
