import { Background, Controls, MiniMap, ReactFlow, type Connection, type Edge, type EdgeChange, type NodeChange } from '@xyflow/react';
import { useCallback, useMemo, useState } from 'react';
import { useAnalysis } from '../analysis';
import { connect, disconnect, moveQuest, removeQuest } from '../model/edits';
import { links, type LinkKind } from '../model/graph';
import { useEditor, useProject } from '../store';
import { nodeTypes, type QuestNode } from './nodes';

// SVG attributes can't read CSS variables, so the minimap and edge colours live here.
const MINIMAP = { main: '#6fc3a8', side: '#7d8597', stuck: '#d03b3b' };
const EDGE: Record<LinkKind, { stroke: string; dash?: string }> = {
  quest: { stroke: '#7d8597' },
  flag: { stroke: '#6fc3a8', dash: '6 4' },
  item: { stroke: '#d9a441', dash: '6 4' },
  lock: { stroke: '#e66767', dash: '2 4' },
};

export function Canvas() {
  const project = useProject();
  const selectedId = useEditor((s) => s.selectedId);
  const edit = useEditor((s) => s.edit);
  const select = useEditor((s) => s.select);
  const { tier, onPath, problems } = useAnalysis();
  // React Flow reports rendered sizes; nodes are rebuilt from the store on every edit,
  // so the sizes are passed back in or the minimap and fitView see zero-sized nodes.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});

  const nodes = useMemo<QuestNode[]>(() => {
    const counts = new Map<string, number>();
    for (const p of problems) if (p.questId) counts.set(p.questId, (counts.get(p.questId) ?? 0) + 1);
    return project.quests.map((quest) => ({
      id: quest.id,
      type: 'quest',
      position: quest.position,
      selected: quest.id === selectedId,
      measured: measured[quest.id],
      data: { quest, tier: tier.get(quest.id), onPath: onPath.has(quest.id), problems: counts.get(quest.id) ?? 0 },
    }));
  }, [project, selectedId, tier, onPath, problems, measured]);

  const edges = useMemo<Edge[]>(
    () =>
      links(project).map((l) => ({
        id: l.id,
        source: l.source,
        target: l.target,
        label: l.label,
        // Flag and item links come from rewards; they change when the quest is edited, not here.
        deletable: l.kind === 'quest' || l.kind === 'lock',
        className: `edge-${l.kind}`,
        style: { stroke: EDGE[l.kind].stroke, strokeWidth: 2, strokeDasharray: EDGE[l.kind].dash },
        labelStyle: { fill: '#c3c6d0', fontSize: 11 },
        labelBgStyle: { fill: '#16181d' },
        labelBgPadding: [4, 2] as [number, number],
      })),
    [project],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<QuestNode>[]) => {
      const sizes: Record<string, { width: number; height: number }> = {};
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions) sizes[c.id] = c.dimensions;
        // One drag is one undo step: positions within a second of each other merge.
        else if (c.type === 'position' && c.position) edit((p) => moveQuest(p, c.id, c.position!), `move-${c.id}`);
        else if (c.type === 'select' && c.selected) select(c.id);
        else if (c.type === 'remove') edit((p) => removeQuest(p, c.id));
      }
      if (Object.keys(sizes).length) setMeasured((m) => ({ ...m, ...sizes }));
    },
    [edit, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) if (c.type === 'remove') edit((p) => disconnect(p, c.id));
    },
    [edit],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) edit((p) => connect(p, c.source, c.target));
    },
    [edit],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={() => select(null)}
      deleteKeyCode={['Delete', 'Backspace']}
      colorMode="dark"
      fitView
      minZoom={0.2}
    >
      <Background gap={24} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n: QuestNode) => (n.data.tier === undefined ? MINIMAP.stuck : MINIMAP[n.data.quest.kind])}
      />
      <Controls />
    </ReactFlow>
  );
}
