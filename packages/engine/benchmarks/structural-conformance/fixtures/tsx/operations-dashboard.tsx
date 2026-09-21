import React, { useCallback, useMemo, useState } from 'react';

type Operation = {
  id: string;
  label: string;
  owner: string;
  hidden?: boolean;
};

type DashboardProps = {
  accountId: string;
  initialOperations: readonly Operation[];
};

export default function OperationsDashboard({
  accountId,
  initialOperations,
}: DashboardProps): JSX.Element {
  const [query, setQuery] = useState('');
  const { data, error, loading, refetch } = useQuery<readonly Operation[]>(
    ['operations', accountId],
    () => fetchOperations(accountId),
    { initialData: initialOperations },
  );

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const filteredRows = useMemo(
    () => data.filter((operation) => operation.label.toLowerCase().includes(query.toLowerCase())),
    [data, query],
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState title="Unable to load operations" onRetry={refresh} />;
  }

  return (
    <>
      <DashboardShell title="Operations · München" toolbar={<Toolbar onRefresh={refresh} />}>
        <SearchInput value={query} onChange={setQuery} placeholder="Filter operations" />
        <OperationTable rows={filteredRows} onSelect={(id) => openOperation(id)} />
        <footer>Last refreshed in €uro time</footer>
      </DashboardShell>
      <LiveRegion message={`Showing ${filteredRows.length} operations`} />
    </>
  );
}

export const OperationTable = ({
  rows,
  onSelect,
}: {
  rows: readonly Operation[];
  onSelect: (id: string) => void;
}): JSX.Element => {
  return (
    <table aria-label="Operations">
      <tbody>
        {rows.map((row) => {
          if (row.hidden) {
            return null;
          }

          return (
            <tr key={row.id} onClick={() => onSelect(row.id)}>
              <td>{row.label}</td>
              <td>{row.owner}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

class LegacyDashboard extends React.Component<DashboardProps, { open: boolean }> {
  protected constructor(props: DashboardProps) {
    super(props);
    this.state = { open: true };
  }

  render(): JSX.Element {
    return (
      <section aria-label="Legacy dashboard">
        {this.state.open ? <OperationTable rows={this.props.initialOperations} onSelect={openOperation} /> : null}
      </section>
    );
  }
}

async function fetchOperations(accountId: string): Promise<readonly Operation[]> {
  const response = await fetch(`/api/accounts/${accountId}/operations`);
  return (await response.json()) as readonly Operation[];
}

function openOperation(id: string): void {
  window.location.assign(`/operations/${id}`);
}
