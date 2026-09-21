import { useIntakeBlocks } from '@/hooks';
import {
  InspectorPropertyGroup,
  InspectorRow,
} from './InspectorPrimitives';

function IntakeInspector({
  selectedBlock,
}: {
  selectedBlock: NonNullable<ReturnType<typeof useIntakeBlocks>['blocks'][number]>;
}) {
  const sectionsList = selectedBlock.sections
    ? Object.keys(selectedBlock.sections).join(', ')
    : '';

  return (
    <InspectorPropertyGroup title="Block">
      <dl className="divide-y divide-border text-xs">
        <InspectorRow label="Protocol" value="Inscribe" />
        <InspectorRow label="Mode" value={selectedBlock.mode || '(none)'} />
        {selectedBlock.selectorText && (
          <InspectorRow label="Selector" value={selectedBlock.selectorText} mono />
        )}
        {sectionsList && (
          <InspectorRow label="Sections" value={sectionsList} />
        )}
        <InspectorRow
          label="Lines"
          value={`${selectedBlock.startLine + 1}–${selectedBlock.endLine + 1}`}
        />
      </dl>
    </InspectorPropertyGroup>
  );
}

export function IntakeDirectiveSection({
  selectedBlock,
}: {
  selectedBlock: ReturnType<typeof useIntakeBlocks>['blocks'][number] | null;
}) {
  if (!selectedBlock) return null;
  return <IntakeInspector selectedBlock={selectedBlock} />;
}