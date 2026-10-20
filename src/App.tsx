import { ReactFlowProvider } from '@xyflow/react';
import { AnalysisProvider } from './analysis';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { ProblemsPanel, SummaryPanel } from './components/Panels';
import { FlagsPanel, ItemsPanel, QuestList } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';

export default function App() {
  return (
    <AnalysisProvider>
      <ReactFlowProvider>
        <div className="app">
          <Toolbar />
          <main className="workspace">
            <aside className="sidebar">
              <QuestList />
              <ItemsPanel />
              <FlagsPanel />
            </aside>
            <div className="canvas">
              <Canvas />
            </div>
            <aside className="sidebar right">
              <Inspector />
              <ProblemsPanel />
              <SummaryPanel />
            </aside>
          </main>
        </div>
      </ReactFlowProvider>
    </AnalysisProvider>
  );
}
