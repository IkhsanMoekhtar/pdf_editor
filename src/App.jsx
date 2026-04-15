import React, { Suspense, lazy, useEffect, useState } from 'react';
import { FileText, Palette, PencilLine, Sparkles, X } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import EmptyState from './components/layout/EmptyState';
import BatchToolsPanel from './components/layout/BatchToolsPanel';
import ConvertToolsPanel from './components/layout/ConvertToolsPanel';
import WorkspaceIconBackdrop from './components/layout/WorkspaceIconBackdrop';
import usePdfWorkspace from './hooks/usePdfWorkspace';
import './App.css';

const PdfViewer = lazy(() => import('./components/pdf/PdfViewer'));
const BACKDROP_THEME_STORAGE_KEY = 'folio-backdrop-theme';
const BACKDROP_THEMES = [
  { key: 'auto', label: 'Auto', Icon: Sparkles },
  { key: 'editorial', label: 'Editorial', Icon: Palette },
  { key: 'sketch', label: 'Sketsa', Icon: PencilLine },
  { key: 'archive', label: 'Arsip', Icon: FileText },
];

function App() {
  const workspace = usePdfWorkspace();
  const [backdropTheme, setBackdropTheme] = useState('auto');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem(BACKDROP_THEME_STORAGE_KEY);
    if (storedTheme && BACKDROP_THEMES.some((theme) => theme.key === storedTheme)) {
      setBackdropTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BACKDROP_THEME_STORAGE_KEY, backdropTheme);
  }, [backdropTheme]);

  const backdropMode =
    workspace.workspaceMode === 'convert'
      ? 'convert'
      : workspace.workspaceMode === 'merge' || workspace.workspaceMode === 'split' || workspace.workspaceMode === 'compress'
        ? 'batch'
        : workspace.pdfFile
          ? 'editor'
          : 'empty';

  const autoBackdropTheme =
    backdropMode === 'editor'
      ? 'sketch'
      : backdropMode === 'batch'
        ? 'archive'
        : backdropMode === 'convert'
          ? 'editorial'
          : 'editorial';

  const resolvedBackdropTheme = backdropTheme === 'auto' ? autoBackdropTheme : backdropTheme;

  return (
    <div className="app-container">
      <button
        className={`mobile-menu-btn ${workspace.isSidebarOpen ? 'hidden' : ''}`}
        onClick={() => workspace.setIsSidebarOpen(true)}
        aria-label="Buka menu sidebar"
      >
        Menu
      </button>

      <Sidebar
        activeTool={workspace.activeTool}
        setActiveTool={workspace.setActiveTool}
        onSave={workspace.savePdfWithDrawings}
        onOpenMerge={workspace.openMergeWorkspace}
        onOpenSplit={workspace.openSplitWorkspace}
        onOpenCompress={workspace.openCompressWorkspace}
        onOpenConvert={workspace.openConvertWorkspace}
        activeConvertKey={workspace.activeConvertKey}
        workspaceMode={workspace.workspaceMode}
        compressOnSave={workspace.compressOnSave}
        setCompressOnSave={workspace.setCompressOnSave}
        isCompressing={workspace.isCompressing}
        isConverting={workspace.isConverting}
        isMerging={workspace.isMerging}
        isSplitting={workspace.isSplitting}
        isSaving={workspace.isSaving}
        isMobileOpen={workspace.isSidebarOpen}
        onCloseMobile={() => workspace.setIsSidebarOpen(false)}
      />

      {workspace.isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup menu sidebar"
          onClick={() => workspace.setIsSidebarOpen(false)}
        />
      )}

      <main className="workspace">
        <WorkspaceIconBackdrop mode={backdropMode} theme={resolvedBackdropTheme} />

        <div className="workspace-theme-switch" role="group" aria-label="Pilih nuansa latar ruang kerja">
          {BACKDROP_THEMES.map((theme) => {
            const Icon = theme.Icon;
            return (
              <button
                key={theme.key}
                type="button"
                className={`workspace-theme-btn ${backdropTheme === theme.key ? 'active' : ''}`}
                onClick={() => setBackdropTheme(theme.key)}
                aria-label={`Gunakan tema ${theme.label}`}
                title={`Tema ${theme.label}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{theme.label}</span>
              </button>
            );
          })}
        </div>

        {workspace.workspaceMode === 'convert' ? (
          <ConvertToolsPanel
            convertPreset={workspace.convertPreset}
            convertFile={workspace.convertFile}
            backendStatus={workspace.backendStatus}
            lastConversion={workspace.lastConversion}
            onSelectPreset={workspace.openConvertWorkspace}
            onConvertFileSelected={workspace.handleConvertFileSelected}
            onRunConvert={workspace.handleRunConversion}
            onClearConvert={() => {
              workspace.setConvertFile(null);
              workspace.setLastConversion(null);
            }}
            onBackToEditor={() => workspace.setWorkspaceMode('edit')}
            isConverting={workspace.isConverting}
          />
        ) : workspace.workspaceMode === 'merge' || workspace.workspaceMode === 'split' || workspace.workspaceMode === 'compress' ? (
          <BatchToolsPanel
            mode={workspace.workspaceMode}
            mergeFiles={workspace.mergeFiles}
            splitFile={workspace.splitFile}
            compressFile={workspace.compressFile}
            compressLevel={workspace.compressLevel}
            lastCompression={workspace.lastCompression}
            backendStatus={workspace.backendStatus}
            isCompressAutoFilled={workspace.isCompressAutoFilled}
            splitMode={workspace.splitMode}
            splitRanges={workspace.splitRanges}
            onMergeFilesSelected={workspace.handleMergeFilesSelected}
            onSplitFileSelected={workspace.handleSplitFileSelected}
            onCompressFileSelected={workspace.handleCompressFileSelected}
            onRunMerge={workspace.handleMergePdf}
            onRunSplit={workspace.handleSplitPdf}
            onRunCompress={() => workspace.handleCompressPdf(workspace.compressLevel, workspace.compressFile)}
            onRemoveMergeFile={(index) => workspace.setMergeFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
            onMoveMergeFile={workspace.handleMoveMergeFile}
            onClearMerge={() => workspace.setMergeFiles([])}
            onClearSplit={() => workspace.setSplitFile(null)}
            onClearCompress={() => {
              workspace.setCompressFile(null);
              workspace.setIsCompressAutoFilled(false);
            }}
            onCompressLevelChange={workspace.setCompressLevel}
            onSplitModeChange={workspace.setSplitMode}
            onSplitRangesChange={workspace.setSplitRanges}
            onBackToEditor={() => workspace.setWorkspaceMode('edit')}
            isMerging={workspace.isMerging}
            isSplitting={workspace.isSplitting}
            isCompressing={workspace.isCompressing}
          />
        ) : workspace.pdfFile ? (
          <Suspense fallback={<div style={{ margin: 'auto', color: '#6b7280' }}>Menyiapkan lembar kerja...</div>}>
            <PdfViewer
              file={workspace.pdfFile}
              activeTool={workspace.activeTool}
              setActiveTool={workspace.setActiveTool}
              drawings={workspace.drawings}
              setDrawings={workspace.setDrawings}
              rotation={workspace.rotation}
              setRotation={workspace.setRotation}
              texts={workspace.texts}
              setTexts={workspace.setTexts}
            />
          </Suspense>
        ) : (
          <EmptyState onUpload={workspace.handleUpload} onNotify={workspace.showToast} />
        )}
      </main>

      {workspace.isGlobalBusy && (
        <div className="global-loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="global-loading-card">
            <div className="global-loading-spinner" aria-hidden="true" />
            <p className="global-loading-title">Sedang Menyiapkan Folio</p>
            <p className="global-loading-message">{workspace.busyMessage}</p>
          </div>
        </div>
      )}

      {workspace.toast && (
        <div className="app-toast-wrap" aria-live="polite" aria-atomic="true">
          <div className={`app-toast ${workspace.toast.type === 'error' ? 'error' : 'success'}`}>
            <div className="app-toast-dot" aria-hidden="true" />
            <p className="app-toast-message">{workspace.toast.message}</p>
            <button className="app-toast-close" onClick={() => workspace.setToast(null)} aria-label="Tutup notifikasi">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
