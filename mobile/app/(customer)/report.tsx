import { ReportScreen } from '@/src/components/reports/ReportScreen';
import { useCustomerReportData } from '@/src/components/reports/useReportData';

export default function ReportDetailScreen() {
  const state = useCustomerReportData();
  return <ReportScreen audience="customer" state={state} />;
}
