import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Quest } from '../model/types';

export type QuestData = { quest: Quest; tier: number | undefined; onPath: boolean; problems: number };
export type QuestNode = Node<QuestData>;

function QuestNodeView({ data }: NodeProps<QuestNode>) {
  const { quest, tier, onPath, problems } = data;
  const who = [quest.giver, quest.location].filter(Boolean).join(' · ');
  return (
    <div className={`qnode qnode-${quest.kind}${tier === undefined ? ' is-stuck' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="qnode-head">
        <span className="kind">{quest.kind === 'main' ? 'Main' : 'Side'}</span>
        {tier === undefined ? <span className="badge badge-stuck">✕ unreachable</span> : <span className="badge">tier {tier}</span>}
        {onPath && quest.kind !== 'main' && (
          <span className="badge badge-path" title="Needed for the main story">
            main path
          </span>
        )}
        {problems > 0 && (
          <span className="badge badge-problem" title="See the Problems panel">
            ! {problems}
          </span>
        )}
      </div>
      <div className="qnode-title">{quest.title || <em className="muted">Untitled</em>}</div>
      {who && <div className="qnode-who muted">{who}</div>}
      <div className="qnode-meta muted">
        {quest.objectives.length} {quest.objectives.length === 1 ? 'objective' : 'objectives'} · {quest.minutes} min
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// A stable map, so React Flow doesn't remount nodes on every render.
export const nodeTypes = { quest: QuestNodeView };
