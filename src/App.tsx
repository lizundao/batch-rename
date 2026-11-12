import { useState } from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { Sidebar, type AppPage } from "./components/Sidebar";
import { RenamePage } from "./pages/RenamePage";
import { AboutPage } from "./pages/AboutPage";
import { LicensePage } from "./pages/LicensePage";
import { useBatchRename } from "./hooks/useBatchRename";
import type { RenameMode } from "./types";
import "./App.css";

function App() {
  const [page, setPage] = useState<AppPage>("rename");
  const batch = useBatchRename();

  const navigate = (p: AppPage) => setPage(p);

  const selectRenameMode = (mode: RenameMode) => {
    batch.setMode(mode);
    setPage("rename");
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={navigate}
        renameMode={batch.mode}
        onRenameModeChange={selectRenameMode}
      />
      <div className="app-main">
        <AppErrorBoundary>
          {page === "rename" && <RenamePage batch={batch} />}
          {page === "about" && (
            <AboutPage onOpenLicense={() => setPage("license")} />
          )}
          {page === "license" && <LicensePage />}
        </AppErrorBoundary>
      </div>
    </div>
  );
}

export default App;
