import React, { Suspense, lazy } from 'react';
import { X } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import EmptyState from './components/layout/EmptyState';
import BatchToolsPanel from './components/layout/BatchToolsPanel';
import ConvertToolsPanel from './components/layout/ConvertToolsPanel';
import WorkspaceIconBackdrop from './components/layout/WorkspaceIconBackdrop';
import usePdfWorkspace from './hooks/usePdfWorkspace';
import './App.css';

const PdfViewer = lazy(() => import('./components/pdf/PdfViewer'));

function App() {
  const workspace = usePdfWorkspace();

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
        <WorkspaceIconBackdrop mode={backdropMode} theme={autoBackdropTheme} />

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
            pdfFile={workspace.pdfFile}
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
            onRunCompress={() => workspace.handleCompressPdf(workspace.compressLevel, workspace.compressFile || workspace.pdfFile)}
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
            <p className="global-loading-title">Sedang Menyiapkan PDF</p>
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
