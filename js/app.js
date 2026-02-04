/**
 * Main Application
 * 全コンポーネントを統合してアプリケーションを起動
 */

class PdfMergeApp {
  constructor() {
    this.pdfHandler = new PdfHandler();
    this.zipHandler = new ZipHandler();
    this.uiManager = new UiManager();

    this.currentThumbnails = [];
  }

  /**
   * アプリケーション初期化
   */
  init() {
    console.log('PDF結合ツール 初期化中...');

    // UI初期化
    this.uiManager.init();

    // イベントリスナー設定
    this.setupEventListeners();

    console.log('初期化完了');
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // ファイル入力
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => this.handleFileInput(e));

    // クリアボタン
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', () => this.handleClear());

    // 結合ボタン
    const mergeBtn = document.getElementById('mergeBtn');
    mergeBtn.addEventListener('click', () => this.handleMerge());

    // 選択したPDFを削除ボタン
    const removeSelectedBtn = document.getElementById('removeSelectedBtn');
    removeSelectedBtn.addEventListener('click', () => this.handleRemoveSelected());

    // ページ操作ボタン
    const selectAllBtn = document.getElementById('selectAllBtn');
    selectAllBtn.addEventListener('click', () => this.handleSelectAll());

    const deselectAllBtn = document.getElementById('deselectAllBtn');
    deselectAllBtn.addEventListener('click', () => this.handleDeselectAll());

    const invertSelectionBtn = document.getElementById('invertSelectionBtn');
    invertSelectionBtn.addEventListener('click', () => this.handleInvertSelection());

    // ドラッグ&ドロップ
    this.setupDragAndDrop();

    // UIManagerからのコールバック
    this.uiManager.onPdfSelect((entryId) => this.handlePdfSelect(entryId));
    this.uiManager.onPageToggle((entryId, pageIndex, include) => this.handlePageToggle(entryId, pageIndex, include));
    this.uiManager.onPageClick((entry, pageIndex, thumbnailUrl) => this.handlePageClick(entry, pageIndex, thumbnailUrl));
    this.uiManager.onPagePreviewNavigate((direction) => this.handlePagePreviewNavigate(direction));
    this.uiManager.onPagePreviewToggle((include) => this.handlePagePreviewToggle(include));
    this.uiManager.onPdfMove((entryId, direction) => this.handlePdfMove(entryId, direction));
    this.uiManager.onPageRotate(() => this.handlePageRotate());
    this.uiManager.onMergePageReorder((fromIndex, toIndex) => this.handleMergePageReorder(fromIndex, toIndex));
    this.uiManager.onMergePageDelete((index) => this.handleMergePageDelete(index));
    this.uiManager.onMergePageRotate((index) => this.handleMergePageRotate(index));
    this.uiManager.onMergeDownload(() => this.handleMergeDownload());
  }

  /**
   * ドラッグ&ドロップのセットアップ
   */
  setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');

    // ドロップゾーンのイベント
    dropZone.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      document.body.classList.remove('dragging');

      const files = Array.from(e.dataTransfer.files);
      this.handleDroppedFiles(files);
    });

    // ページ全体のドラッグイベント（視覚的フィードバック）
    let dragCounter = 0;

    document.body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) {
        document.body.classList.add('dragging');
      }
    });

    document.body.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        document.body.classList.remove('dragging');
      }
    });

    document.body.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('dragging');
    });
  }

  /**
   * ドロップされたファイルを処理
   * @param {File[]} files
   */
  async handleDroppedFiles(files) {
    await this.processFiles(files);
  }

  /**
   * ファイル入力処理
   * @param {Event} event
   */
  async handleFileInput(event) {
    const files = Array.from(event.target.files);
    await this.processFiles(files);
  }

  /**
   * ファイル処理の共通ロジック
   * @param {File[]} files
   */
  async processFiles(files) {
    if (files.length === 0) return;

    this.uiManager.showProgress('ファイルを読み込み中...', 'お待ちください');

    try {
      const pdfFiles = await this.extractPdfFiles(files);

      if (pdfFiles.length === 0) {
        throw new Error('PDFファイルが見つかりませんでした');
      }

      await this.loadPdfFiles(pdfFiles);

      this.pdfHandler.sortEntries();
      this.updateUI();

      this.uiManager.hideProgress();
      this.uiManager.showSuccess(`${this.pdfHandler.getEntries().length} 個のPDFを読み込みました`);
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      this.uiManager.hideProgress();
      this.uiManager.showError(error.message);
    }
  }

  /**
   * ファイル配列からPDFファイルを抽出（ZIPも展開）
   * @param {File[]} files
   * @returns {Promise<File[]>}
   */
  async extractPdfFiles(files) {
    const pdfFiles = [];

    for (const file of files) {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.pdf')) {
        pdfFiles.push(file);
      } else if (fileName.endsWith('.zip')) {
        const extractedPdfs = await this.zipHandler.extractPdfsFromZip(file);
        pdfFiles.push(...extractedPdfs);
      } else {
        console.warn(`サポートされていないファイル形式: ${file.name}`);
      }
    }

    return pdfFiles;
  }

  /**
   * PDFファイルを読み込んでエントリに追加
   * @param {File[]} pdfFiles
   */
  async loadPdfFiles(pdfFiles) {
    for (const pdfFile of pdfFiles) {
      try {
        const entry = await this.pdfHandler.loadPdfFile(pdfFile);
        this.pdfHandler.addEntry(entry);
      } catch (error) {
        console.error(`スキップ: ${pdfFile.name}`, error);
        this.uiManager.showError(`${pdfFile.name} の読み込みに失敗しました`);
      }
    }
  }

  /**
   * PDF選択処理
   * @param {string} entryId
   */
  async handlePdfSelect(entryId) {
    this.pdfHandler.setSelectedEntry(entryId);
    const entry = this.pdfHandler.getSelectedEntry();

    if (!entry) return;

    this.uiManager.showProgress('サムネイルを生成中...', `${entry.name} のページを読み込んでいます`);

    try {
      // サムネイル生成
      this.currentThumbnails = await this.pdfHandler.generateAllThumbnails(entry, 0.4);

      // プレビュー表示
      await this.uiManager.updatePagePreview(entry, this.currentThumbnails);

      // PDF一覧を再表示（選択状態を反映）
      this.uiManager.updatePdfList(this.pdfHandler.getEntries(), entryId);

      this.uiManager.hideProgress();
    } catch (error) {
      console.error('サムネイル生成エラー:', error);
      this.uiManager.hideProgress();
      this.uiManager.showError('サムネイルの生成に失敗しました');
    }
  }

  /**
   * ページトグル処理
   * @param {string} entryId
   * @param {number} pageIndex
   * @param {boolean} include
   */
  handlePageToggle(entryId, pageIndex, include) {
    this.pdfHandler.setPageInclude(entryId, pageIndex, include);

    // PDF一覧のバッジを更新
    this.uiManager.updatePdfList(
      this.pdfHandler.getEntries(),
      this.pdfHandler.selectedEntryId
    );

    // ページカードのUIを更新（枠の色とラベルを更新）
    const entry = this.pdfHandler.getSelectedEntry();
    if (entry) {
      this.uiManager.refreshPageCards(entry);
    }
  }

  /**
   * 全ページ選択
   */
  handleSelectAll() {
    const entry = this.pdfHandler.getSelectedEntry();
    if (!entry) return;

    this.pdfHandler.setAllPagesInclude(entry.id, true);
    this.uiManager.refreshPageCards(entry);
    this.uiManager.updatePdfList(
      this.pdfHandler.getEntries(),
      this.pdfHandler.selectedEntryId
    );
  }

  /**
   * 全ページ解除
   */
  handleDeselectAll() {
    const entry = this.pdfHandler.getSelectedEntry();
    if (!entry) return;

    this.pdfHandler.setAllPagesInclude(entry.id, false);
    this.uiManager.refreshPageCards(entry);
    this.uiManager.updatePdfList(
      this.pdfHandler.getEntries(),
      this.pdfHandler.selectedEntryId
    );
  }

  /**
   * 選択反転
   */
  handleInvertSelection() {
    const entry = this.pdfHandler.getSelectedEntry();
    if (!entry) return;

    this.pdfHandler.invertPageSelection(entry.id);
    this.uiManager.refreshPageCards(entry);
    this.uiManager.updatePdfList(
      this.pdfHandler.getEntries(),
      this.pdfHandler.selectedEntryId
    );
  }

  /**
   * 結合処理
   */
  async handleMerge() {
    const entries = this.pdfHandler.getEntries();

    if (entries.length === 0) {
      this.uiManager.showError('結合するPDFがありません');
      return;
    }

    // 含めるページが1つもない場合は警告
    const totalIncludedPages = entries.reduce((sum, entry) => {
      return sum + this.pdfHandler.getIncludedPageCount(entry);
    }, 0);

    if (totalIncludedPages === 0) {
      this.uiManager.showError('含めるページが1つもありません');
      return;
    }

    // 暗号化PDFの検証を実行
    this.uiManager.showProgress('PDFを検証中...', 'コンテンツの正常性をチェックしています');

    try {
      const warnings = await this.pdfHandler.validateAllEntries();

      this.uiManager.hideProgress();

      if (warnings.length > 0) {
        const message = `以下のPDFは正常に表示されていない可能性があります:\n\n${warnings.join('\n')}\n\n結合後のPDFが真っ白になる場合があります。\nこのまま結合を続行しますか？`;
        if (!confirm(message)) {
          return;
        }
      }
    } catch (error) {
      console.error('検証エラー:', error);
      this.uiManager.hideProgress();
      // 検証エラーの場合は続行を確認
      if (!confirm('PDFの検証中にエラーが発生しました。\n結合を続行しますか？')) {
        return;
      }
    }

    // 結合順序を初期化
    this.pdfHandler.initMergeOrder();

    // 結合プレビューを表示
    this.uiManager.showProgress('プレビューを生成中...', 'サムネイルを作成しています');

    try {
      await this.uiManager.showMergePreview(this.pdfHandler.mergeOrder, this.pdfHandler);
      this.uiManager.hideProgress();
    } catch (error) {
      console.error('プレビュー生成エラー:', error);
      this.uiManager.hideProgress();
      this.uiManager.showError('プレビューの生成に失敗しました');
    }
  }

  /**
   * 選択したPDFを削除
   */
  handleRemoveSelected() {
    const checkedIds = this.uiManager.getCheckedPdfIds();

    if (checkedIds.length === 0) {
      this.uiManager.showError('削除するPDFを選択してください');
      return;
    }

    if (!confirm(`${checkedIds.length} 個のPDFを削除しますか？`)) {
      return;
    }

    // 削除
    this.pdfHandler.removeEntries(checkedIds);

    // サムネイルクリア
    this.currentThumbnails = [];

    // UI更新
    this.updateUI();

    this.uiManager.showSuccess(`${checkedIds.length} 個のPDFを削除しました`);
  }

  /**
   * クリア処理
   */
  handleClear() {
    if (!confirm('全てのファイルをクリアしますか？')) {
      return;
    }

    // データクリア
    this.pdfHandler.clear();
    this.currentThumbnails = [];

    // ファイル入力をリセット
    const fileInput = document.getElementById('fileInput');
    fileInput.value = '';

    // UI更新
    this.updateUI();

    this.uiManager.showSuccess('クリアしました');
  }

  /**
   * UI全体を更新
   */
  updateUI() {
    const entries = this.pdfHandler.getEntries();
    const hasFiles = entries.length > 0;

    // PDF一覧更新
    this.uiManager.updatePdfList(entries, this.pdfHandler.selectedEntryId);

    // ボタン状態更新
    this.uiManager.updateButtons(hasFiles);

    // PDF一覧のアクションボタン表示/非表示
    const pdfListActions = document.getElementById('pdfListActions');
    if (pdfListActions) {
      pdfListActions.style.display = hasFiles ? 'block' : 'none';
    }

    // プレビューをクリア（選択なしの場合）
    if (!this.pdfHandler.selectedEntryId) {
      this.uiManager.updatePagePreview(null, []);
    }
  }

  /**
   * ページクリック処理（プレビューモーダルを開く）
   * @param {PdfEntry} entry
   * @param {number} pageIndex
   * @param {string} thumbnailUrl
   */
  async handlePageClick(entry, pageIndex, thumbnailUrl) {
    // まず低解像度のサムネイルでモーダルを開く（即座に表示）
    this.uiManager.openPagePreviewModal(entry, pageIndex, thumbnailUrl);

    // 次に高解像度サムネイルを生成して置き換え（スケール2.5で大きく鮮明に）
    try {
      const highResThumbnail = await this.pdfHandler.generateThumbnail(entry, pageIndex + 1, 2.5);
      this.uiManager.elements.previewImage.src = highResThumbnail;
    } catch (error) {
      console.error('高解像度サムネイル生成エラー:', error);
      // エラーの場合は低解像度のままでOK
    }
  }

  /**
   * ページプレビューナビゲーション処理
   * @param {string} direction - 'prev' | 'next'
   */
  async handlePagePreviewNavigate(direction) {
    const entry = this.uiManager.currentPreviewEntry;
    let newPageIndex = this.uiManager.currentPreviewPageIndex;

    if (direction === 'prev' && newPageIndex > 0) {
      newPageIndex--;
    } else if (direction === 'next' && newPageIndex < entry.numPages - 1) {
      newPageIndex++;
    } else {
      return; // 範囲外
    }

    // 高解像度サムネイルを生成（スケール2.5で大きく鮮明に）
    const thumbnailUrl = await this.pdfHandler.generateThumbnail(entry, newPageIndex + 1, 2.5);

    // モーダルを更新
    this.uiManager.updatePagePreviewModal(entry, newPageIndex, thumbnailUrl);
  }

  /**
   * ページプレビューのトグル処理
   * @param {boolean} include
   */
  handlePagePreviewToggle(include) {
    const entry = this.uiManager.currentPreviewEntry;
    const pageIndex = this.uiManager.currentPreviewPageIndex;

    // ページの含有フラグを更新
    this.pdfHandler.setPageInclude(entry.id, pageIndex, include);

    // PDF一覧のバッジを更新
    this.uiManager.updatePdfList(
      this.pdfHandler.getEntries(),
      this.pdfHandler.selectedEntryId
    );

    // 小さいサムネイルも更新（選択中のPDFの場合）
    if (this.pdfHandler.selectedEntryId === entry.id) {
      this.uiManager.refreshPageCards(entry);
    }

    // ラベルテキストを更新
    this.uiManager.elements.previewIncludeLabel.textContent = include ? 'このページを含める' : 'このページを除外';
  }

  /**
   * PDF移動処理
   * @param {string} entryId
   * @param {string} direction - 'up' | 'down'
   */
  handlePdfMove(entryId, direction) {
    const success = this.pdfHandler.moveEntry(entryId, direction);

    if (success) {
      // UI更新
      this.updateUI();
    }
  }

  /**
   * ページ回転処理
   */
  async handlePageRotate() {
    const entry = this.uiManager.currentPreviewEntry;
    const pageIndex = this.uiManager.currentPreviewPageIndex;

    if (!entry) return;

    // ページを回転
    this.pdfHandler.rotatePageBy90(entry.id, pageIndex);

    // 高解像度サムネイルを再生成
    const thumbnailUrl = await this.pdfHandler.generateThumbnail(entry, pageIndex + 1, 2.5);

    // モーダルを更新
    this.uiManager.updatePagePreviewModal(entry, pageIndex, thumbnailUrl);

    // 小さいサムネイルも更新（選択中のPDFの場合）
    if (this.pdfHandler.selectedEntryId === entry.id) {
      this.uiManager.refreshPageCards(entry);
    }
  }

  /**
   * 結合プレビューのページ並び替え処理
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  async handleMergePageReorder(fromIndex, toIndex) {
    this.pdfHandler.reorderMergePage(fromIndex, toIndex);

    // プレビューを再表示
    await this.uiManager.showMergePreview(this.pdfHandler.mergeOrder, this.pdfHandler);
  }

  /**
   * 結合プレビューのページ削除処理
   * @param {number} index
   */
  async handleMergePageDelete(index) {
    if (this.pdfHandler.mergeOrder.length <= 1) {
      this.uiManager.showError('最後のページは削除できません');
      return;
    }

    this.pdfHandler.removeMergePage(index);

    // プレビューを再表示
    await this.uiManager.showMergePreview(this.pdfHandler.mergeOrder, this.pdfHandler);
  }

  /**
   * 結合プレビューのページ回転処理
   * @param {number} index
   */
  async handleMergePageRotate(index) {
    this.pdfHandler.rotateMergePage(index);

    // プレビューを再表示
    await this.uiManager.showMergePreview(this.pdfHandler.mergeOrder, this.pdfHandler);
  }

  /**
   * 結合ダウンロード処理
   */
  async handleMergeDownload() {
    if (this.pdfHandler.mergeOrder.length === 0) {
      this.uiManager.showError('結合するページがありません');
      return;
    }

    this.uiManager.showProgress('PDFを結合中...', `${this.pdfHandler.mergeOrder.length} ページを処理しています`);

    try {
      // PDF結合
      const mergedBytes = await this.pdfHandler.mergePdfsWithOrder();

      // マニフェスト生成
      const manifestJson = this.pdfHandler.generateManifest();

      // ZIP生成
      const zipBlob = await this.zipHandler.createResultZip(mergedBytes, manifestJson);

      // ダウンロード
      const filename = this.zipHandler.generateResultFileName();
      this.zipHandler.downloadBlob(zipBlob, filename);

      this.uiManager.hideProgress();
      this.uiManager.showSuccess(`結合完了！ ${filename} をダウンロードしました`);

      // モーダルを閉じる
      this.uiManager.mergePreviewModalInstance.close();
    } catch (error) {
      console.error('結合エラー:', error);
      this.uiManager.hideProgress();
      this.uiManager.showError(error.message);
    }
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new PdfMergeApp();
  app.init();
});
