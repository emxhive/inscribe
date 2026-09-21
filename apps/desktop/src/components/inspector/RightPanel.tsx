import { useAppStateContext } from '@/hooks';
import { HistoryReviewInspector } from '@/components/history/HistoryReviewInspector';
import { HistoryRightPanel } from '@/components/history/HistoryRightPanel';
import { InspectorRightPanel } from './InspectorRightPanel';

export function RightPanel() {
  const { state } = useAppStateContext();

  if (state.historyReview.actionId) {
    return <HistoryReviewInspector />;
  }

  return state.rightPanelOwner === 'history'
    ? <HistoryRightPanel />
    : <InspectorRightPanel />;
}