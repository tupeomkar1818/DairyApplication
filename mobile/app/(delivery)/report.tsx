import { ReportScreen } from '@/src/components/reports/ReportScreen';
import { useDeliveryReportData } from '@/src/components/reports/useReportData';

export default function ReportDetailScreen() {
  const state = useDeliveryReportData();
  return <ReportScreen audience="delivery" state={state} />;
}
