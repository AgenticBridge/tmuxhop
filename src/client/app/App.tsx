/**
 * tmuxhop React application shell.
 *
 * Purpose: compose the top-level browser UI using the app controller and
 * presentational client components.
 *
 * Boundary: client-only. This module should stay focused on composition and
 * delegate orchestration to the app controller hook.
 */
import { ControlBar } from "./components/ControlBar.js";
import { FontStatusModal } from "./components/FontStatusModal.js";
import { ScopeNav } from "./components/ScopeNav.js";
import { TerminalPanel } from "./components/TerminalPanel.js";
import { UtilityBar } from "./components/UtilityBar.js";
import { useAppController } from "./controller/useAppController.js";
import { CONTROL_BUTTONS } from "./ui.js";

export function App() {
  const controller = useAppController();

  return (
    <>
      <UtilityBar
        fontModalOpen={controller.fontModalOpen}
        fontReport={controller.fontReport}
        onReconnect={controller.onReconnect}
        onToggleFontModal={controller.toggleFontModal}
        sessionTitle={controller.sessionTitle}
        status={controller.status}
      />

      <section className={`empty-state${controller.showEmptyState ? "" : " hidden"}`}>
        <h2>No tmux session found</h2>
        <p>
          Start or select a session locally, then reload this page: <code>tmux ls</code> or{" "}
          <code>tmux new -As tmuxhop</code>
        </p>
      </section>

      <FontStatusModal
        fontModalOpen={controller.fontModalOpen}
        fontReport={controller.fontReport}
        onClose={controller.closeFontModal}
        onRefresh={controller.refreshFontReport}
      />

      <main id="app-content" className={`app-content${controller.showApp ? "" : " hidden"}`}>
        <ScopeNav
          navScope={controller.navScope}
          onSelectNavScope={controller.onSelectNavScope}
          onSelectPane={controller.onSelectPane}
          onSelectSession={controller.onSelectSession}
          onSelectWindow={controller.onSelectWindow}
          selectedPaneId={controller.selectedPaneId}
          selectedSessionName={controller.selectedSessionName}
          selectedWindowId={controller.selectedWindowId}
          selectedWindowPanes={controller.selectedWindowPanes}
          sessions={controller.sessions}
          windows={controller.windows}
        />

        <TerminalPanel mountRef={controller.terminalMountRef} />
      </main>

      <ControlBar
        controls={CONTROL_BUTTONS}
        onShortcut={controller.onShortcut}
        showControls={controller.showControls}
      />
    </>
  );
}
