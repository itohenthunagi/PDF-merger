/**
 * UI Manager
 * UI表示の更新とユーザーインタラクションを管理
 */

class UiManager {
  constructor() {
    this.elements = {
      pdfList: document.getElementById('pdfList'),
      pdfCount: document.getElementById('pdfCount'),
      pagePreview: document.getElementById('pagePreview'),
      pageControls: document.getElementById('pageControls'),
      pageStats: document.getElementById('pageStats'),
      selectedPdfName: document.getElementById('selectedPdfName'),
      clearBtn: document.getElementById('clearBtn'),
      mergeBtn: document.getElementById('mergeBtn'),
      progressModal: document.getElementById('progressModal'),
      progressTitle: document.getElementById('progressTitle'),
      progressText: document.getElementById('progressText'),
      progressBar: document.getElementById('progressBar'),
      // ページプレビューモーダル
      pagePreviewModal: document.getElementById('pagePreviewModal'),
      previewPdfName: document.getElementById('previewPdfName'),
      previewPageInfo: document.getElementById('previewPageInfo'),
      previewImage: document.getElementById('previewImage'),
      previewIncludeCheckbox: document.getElementById('previewIncludeCheckbox'),
      previewIncludeLabel: document.getElementById('previewIncludeLabel'),
      previewPrevBtn: document.getElementById('previewPrevBtn'),
      previewNextBtn: document.getElementById('previewNextBtn'),
      previewRotateBtn: document.getElementById('previewRotateBtn'),
      // 結合プレビューモーダル
      mergePreviewModal: document.getElementById('mergePreviewModal'),
      mergePreviewStats: document.getElementById('mergePreviewStats'),
      mergePreviewGrid: document.getElementById('mergePreviewGrid'),
      mergeDownloadBtn: document.getElementById('mergeDownloadBtn')
    };

    this.modalInstance = null;
    this.pagePreviewModalInstance = null;
    this.onPdfSelectCallback = null;
    this.onPageToggleCallback = null;
    this.onPagePreviewNavigateCallback = null;
    this.onPagePreviewToggleCallback = null;
    this.onPageRotateCallback = null;
    this.onPdfMoveCallback = null;
    this.onPageClickCallback = null;
    this.onMergePageReorderCallback = null;
    this.onMergePageToggleCallback = null;
    this.onMergePageRotateCallback = null;
    this.onMergeDownloadCallback = null;
    this.currentMergePreviewIndex = null;
    this.currentMergeOrder = null;
    this.currentPdfHandler = null;
  }

  /**
   * 初期化
   */
  init() {
    // Materialize プログレスモーダルを初期化
    this.modalInstance = M.Modal.init(this.elements.progressModal, {
      dismissible: false
    });

    // ページプレビューモーダルを初期化
    this.pagePreviewModalInstance = M.Modal.init(this.elements.pagePreviewModal, {
      dismissible: true,
      onOpenEnd: () => this.setupPagePreviewKeyboard(),
      onCloseEnd: () => {
        this.cleanupPagePreviewKeyboard();

        // 結合プレビューのコンテキストがある場合は、結合プレビューに戻る
        if (this.currentMergePreviewIndex !== null) {
          // 結合プレビューモーダルを再度開く
          setTimeout(() => {
            this.mergePreviewModalInstance.open();
          }, 100); // 少し遅延させてスムーズに

          // 結合プレビューのコンテキストをクリア
          this.currentMergePreviewIndex = null;
        }

        // チェックボックスと回転ボタンを再表示
        this.elements.previewIncludeCheckbox.parentElement.style.display = '';
        this.elements.previewRotateBtn.style.display = '';
      }
    });

    // プレビューモーダルのボタンイベント
    this.elements.previewPrevBtn.addEventListener('click', () => {
      if (this.onPagePreviewNavigateCallback) {
        this.onPagePreviewNavigateCallback('prev');
      }
    });

    this.elements.previewNextBtn.addEventListener('click', () => {
      if (this.onPagePreviewNavigateCallback) {
        this.onPagePreviewNavigateCallback('next');
      }
    });

    this.elements.previewIncludeCheckbox.addEventListener('change', (e) => {
      if (this.onPagePreviewToggleCallback) {
        this.onPagePreviewToggleCallback(e.target.checked);
      }
    });

    this.elements.previewRotateBtn.addEventListener('click', () => {
      if (this.onPageRotateCallback) {
        this.onPageRotateCallback();
      }
    });

    // 結合プレビューモーダルを初期化
    this.mergePreviewModalInstance = M.Modal.init(this.elements.mergePreviewModal, {
      dismissible: true
    });

    // ダウンロードボタン
    this.elements.mergeDownloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.onMergeDownloadCallback) {
        this.onMergeDownloadCallback();
      }
    });
  }

  /**
   * PDF一覧を更新
   * @param {PdfEntry[]} entries
   * @param {string} selectedId
   */
  updatePdfList(entries, selectedId) {
    this.elements.pdfCount.textContent = entries.length;

    if (entries.length === 0) {
      this.elements.pdfList.innerHTML = `
        <div class="center-align grey-text" style="padding: 20px;">
          ファイルが選択されていません
        </div>
      `;
      return;
    }

    // 一覧を生成
    this.elements.pdfList.innerHTML = '';

    entries.forEach((entry, index) => {
      const includedCount = entry.includePages.filter(flag => flag).length;
      const isSelected = entry.id === selectedId;

      const item = document.createElement('div');
      item.className = `collection-item pdf-list-item ${isSelected ? 'active' : ''}`;
      item.dataset.entryId = entry.id;

      const isFirst = index === 0;
      const isLast = index === entries.length - 1;

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="margin: 0; display: flex; align-items: center;">
            <input type="checkbox" class="filled-in pdf-checkbox" data-entry-id="${entry.id}"/>
            <span></span>
          </label>
          <div style="flex: 1; cursor: pointer;" class="pdf-item-content">
            <strong>${this.escapeHtml(entry.name)}</strong>
            <span class="badge ${includedCount === entry.numPages ? 'green' : 'orange'} white-text">
              ${includedCount}/${entry.numPages}
            </span>
            <br>
            <small class="grey-text">${entry.numPages} ページ</small>
          </div>
          <div class="pdf-move-buttons">
            <button class="btn-floating btn-small waves-effect waves-light blue pdf-move-up"
                    data-entry-id="${entry.id}"
                    ${isFirst ? 'disabled' : ''}
                    title="上に移動">
              <i class="material-icons">arrow_upward</i>
            </button>
            <button class="btn-floating btn-small waves-effect waves-light blue pdf-move-down"
                    data-entry-id="${entry.id}"
                    ${isLast ? 'disabled' : ''}
                    title="下に移動">
              <i class="material-icons">arrow_downward</i>
            </button>
          </div>
        </div>
      `;

      // PDF名クリックイベント（プレビュー表示）
      const contentDiv = item.querySelector('.pdf-item-content');
      contentDiv.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onPdfSelectCallback) {
          this.onPdfSelectCallback(entry.id);
        }
      });

      // チェックボックスのクリックイベント（クリックを伝播させない）
      const checkbox = item.querySelector('.pdf-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // 上移動ボタン
      const moveUpBtn = item.querySelector('.pdf-move-up');
      if (moveUpBtn) {
        moveUpBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onPdfMoveCallback) {
            this.onPdfMoveCallback(entry.id, 'up');
          }
        });
      }

      // 下移動ボタン
      const moveDownBtn = item.querySelector('.pdf-move-down');
      if (moveDownBtn) {
        moveDownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onPdfMoveCallback) {
            this.onPdfMoveCallback(entry.id, 'down');
          }
        });
      }

      this.elements.pdfList.appendChild(item);
    });
  }

  /**
   * PDF移動時のコールバックを設定
   * @param {Function} callback
   */
  onPdfMove(callback) {
    this.onPdfMoveCallback = callback;
  }

  /**
   * チェックされたPDFのIDを取得
   * @returns {string[]}
   */
  getCheckedPdfIds() {
    const checkboxes = this.elements.pdfList.querySelectorAll('.pdf-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.entryId);
  }

  /**
   * 全PDFのチェック状態を設定
   * @param {boolean} checked
   */
  setAllPdfCheckboxes(checked) {
    const checkboxes = this.elements.pdfList.querySelectorAll('.pdf-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
  }

  /**
   * ページプレビューを更新
   * @param {PdfEntry} entry
   * @param {string[]} thumbnails - Data URLs
   */
  async updatePagePreview(entry, thumbnails) {
    if (!entry) {
      this.elements.pagePreview.innerHTML = `
        <div class="center-align grey-text" style="padding: 40px;">
          PDFを選択するとページが表示されます
        </div>
      `;
      this.elements.pageControls.style.display = 'none';
      this.elements.pageStats.style.display = 'none';
      return;
    }

    // コントロールを表示
    this.elements.pageControls.style.display = 'block';
    this.elements.pageStats.style.display = 'inline-block';
    this.elements.selectedPdfName.textContent = entry.name;

    // 統計を更新
    this.updatePageStats(entry);

    // サムネイルグリッドを生成
    this.elements.pagePreview.innerHTML = '';

    thumbnails.forEach((dataUrl, index) => {
      const pageNum = index + 1;
      const isIncluded = entry.includePages[index];

      const pageCard = document.createElement('div');
      pageCard.className = 'page-card';
      pageCard.dataset.pageIndex = index;

      pageCard.innerHTML = `
        <div class="page-thumbnail ${isIncluded ? 'included' : 'excluded'}">
          <img src="${dataUrl}" alt="Page ${pageNum}">
          <div class="page-overlay">
            <div class="page-number">p.${pageNum}</div>
            <div class="page-checkbox">
              <label>
                <input type="checkbox" class="filled-in" ${isIncluded ? 'checked' : ''}/>
                <span>${isIncluded ? '含める' : '除外'}</span>
              </label>
            </div>
          </div>
        </div>
      `;

      // チェックボックスクリックイベント
      const checkbox = pageCard.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => {
        const include = e.target.checked;
        if (this.onPageToggleCallback) {
          this.onPageToggleCallback(entry.id, index, include);
        }
      });

      // サムネイル画像クリックでプレビューモーダルを開く
      const thumbnail = pageCard.querySelector('.page-thumbnail');
      thumbnail.style.cursor = 'pointer';
      thumbnail.addEventListener('click', (e) => {
        // チェックボックスクリックの場合は無視
        if (e.target.closest('.page-checkbox')) {
          return;
        }
        if (this.onPageClickCallback) {
          this.onPageClickCallback(entry, index, dataUrl);
        }
      });

      this.elements.pagePreview.appendChild(pageCard);
    });
  }

  /**
   * ページクリック時のコールバックを設定
   * @param {Function} callback
   */
  onPageClick(callback) {
    this.onPageClickCallback = callback;
  }

  /**
   * ページ統計を更新
   * @param {PdfEntry} entry
   */
  updatePageStats(entry) {
    const includedCount = entry.includePages.filter(flag => flag).length;
    this.elements.pageStats.textContent = `${includedCount}/${entry.numPages} ページ`;
  }

  /**
   * ボタンの有効/無効を設定
   * @param {boolean} hasFiles
   */
  updateButtons(hasFiles) {
    this.elements.clearBtn.disabled = !hasFiles;
    this.elements.mergeBtn.disabled = !hasFiles;
  }

  /**
   * プログレス表示を開始
   * @param {string} title
   * @param {string} text
   */
  showProgress(title, text) {
    this.elements.progressTitle.textContent = title;
    this.elements.progressText.textContent = text;
    this.modalInstance.open();
  }

  /**
   * プログレス表示を終了
   */
  hideProgress() {
    this.modalInstance.close();
  }

  /**
   * トースト通知を表示
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'info'
   */
  showToast(message, type = 'info') {
    const classes = {
      success: 'green',
      error: 'red',
      info: 'blue'
    };

    M.toast({
      html: message,
      classes: classes[type] || classes.info,
      displayLength: 4000
    });
  }

  /**
   * エラー表示
   * @param {string} message
   */
  showError(message) {
    this.showToast(`エラー: ${message}`, 'error');
  }

  /**
   * 成功メッセージ表示
   * @param {string} message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * PDF選択時のコールバックを設定
   * @param {Function} callback
   */
  onPdfSelect(callback) {
    this.onPdfSelectCallback = callback;
  }

  /**
   * ページトグル時のコールバックを設定
   * @param {Function} callback
   */
  onPageToggle(callback) {
    this.onPageToggleCallback = callback;
  }

  /**
   * HTMLエスケープ
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 選択中のPDFのページカードの表示を更新
   * @param {PdfEntry} entry
   */
  refreshPageCards(entry) {
    const pageCards = this.elements.pagePreview.querySelectorAll('.page-card');

    pageCards.forEach((card, index) => {
      const isIncluded = entry.includePages[index];
      const thumbnail = card.querySelector('.page-thumbnail');
      const checkbox = card.querySelector('input[type="checkbox"]');
      const label = card.querySelector('label span');

      // クラス・チェックボックス・ラベルを更新
      thumbnail.classList.toggle('included', isIncluded);
      thumbnail.classList.toggle('excluded', !isIncluded);
      checkbox.checked = isIncluded;
      label.textContent = isIncluded ? '含める' : '除外';
    });

    this.updatePageStats(entry);
  }

  /**
   * ページプレビューモーダルを開く
   * @param {PdfEntry} entry
   * @param {number} pageIndex - 0-based
   * @param {string} thumbnailDataUrl
   */
  openPagePreviewModal(entry, pageIndex, thumbnailDataUrl) {
    this.elements.previewPdfName.textContent = entry.name;
    this.currentPreviewEntry = entry;

    this.setPreviewModalState(entry, pageIndex, thumbnailDataUrl);
    this.pagePreviewModalInstance.open();
  }

  /**
   * ページプレビューモーダルを閉じる
   */
  closePagePreviewModal() {
    this.pagePreviewModalInstance.close();
  }

  /**
   * ページプレビューモーダルを更新（ナビゲーション後）
   * @param {PdfEntry} entry
   * @param {number} pageIndex
   * @param {string} thumbnailDataUrl
   */
  updatePagePreviewModal(entry, pageIndex, thumbnailDataUrl) {
    this.setPreviewModalState(entry, pageIndex, thumbnailDataUrl);
  }

  /**
   * プレビューモーダルの状態を設定（共通処理）
   * @param {PdfEntry} entry
   * @param {number} pageIndex
   * @param {string} thumbnailDataUrl
   */
  setPreviewModalState(entry, pageIndex, thumbnailDataUrl) {
    const isIncluded = entry.includePages[pageIndex];
    const rotation = entry.pageRotations ? entry.pageRotations[pageIndex] : 0;

    this.elements.previewPageInfo.textContent = `ページ ${pageIndex + 1} / ${entry.numPages}`;
    this.elements.previewImage.src = thumbnailDataUrl;
    this.elements.previewIncludeCheckbox.checked = isIncluded;
    this.elements.previewIncludeLabel.textContent = isIncluded ? 'このページを含める' : 'このページを除外';
    this.elements.previewPrevBtn.disabled = pageIndex === 0;
    this.elements.previewNextBtn.disabled = pageIndex === entry.numPages - 1;

    // 回転状態を反映
    this.elements.previewImage.className = '';
    if (rotation === 90) {
      this.elements.previewImage.classList.add('rotated-90');
    } else if (rotation === 180) {
      this.elements.previewImage.classList.add('rotated-180');
    } else if (rotation === 270) {
      this.elements.previewImage.classList.add('rotated-270');
    }

    this.currentPreviewPageIndex = pageIndex;
  }

  /**
   * キーボードナビゲーションをセットアップ
   */
  setupPagePreviewKeyboard() {
    this.pagePreviewKeyHandler = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!this.elements.previewPrevBtn.disabled && this.onPagePreviewNavigateCallback) {
          this.onPagePreviewNavigateCallback('prev');
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!this.elements.previewNextBtn.disabled && this.onPagePreviewNavigateCallback) {
          this.onPagePreviewNavigateCallback('next');
        }
      }
    };

    document.addEventListener('keydown', this.pagePreviewKeyHandler);
  }

  /**
   * キーボードナビゲーションをクリーンアップ
   */
  cleanupPagePreviewKeyboard() {
    if (this.pagePreviewKeyHandler) {
      document.removeEventListener('keydown', this.pagePreviewKeyHandler);
      this.pagePreviewKeyHandler = null;
    }
  }

  /**
   * ページプレビューナビゲーションのコールバックを設定
   * @param {Function} callback
   */
  onPagePreviewNavigate(callback) {
    this.onPagePreviewNavigateCallback = callback;
  }

  /**
   * ページプレビューのトグルコールバックを設定
   * @param {Function} callback
   */
  onPagePreviewToggle(callback) {
    this.onPagePreviewToggleCallback = callback;
  }

  /**
   * ページ回転のコールバックを設定
   * @param {Function} callback
   */
  onPageRotate(callback) {
    this.onPageRotateCallback = callback;
  }

  /**
   * PDF移動のコールバックを設定
   * @param {Function} callback
   */
  onPdfMove(callback) {
    this.onPdfMoveCallback = callback;
  }

  /**
   * ページクリックのコールバックを設定
   * @param {Function} callback
   */
  onPageClick(callback) {
    this.onPageClickCallback = callback;
  }

  /**
   * 結合プレビューを表示
   * @param {Array} mergeOrder
   * @param {PdfHandler} pdfHandler
   */
  async showMergePreview(mergeOrder, pdfHandler) {
    const grid = this.elements.mergePreviewGrid;
    grid.innerHTML = '';

    this.elements.mergePreviewStats.textContent = `全 ${mergeOrder.length} ページ`;

    // コンテキストを保存
    this.currentMergeOrder = mergeOrder;
    this.currentPdfHandler = pdfHandler;

    for (let i = 0; i < mergeOrder.length; i++) {
      const item = mergeOrder[i];
      const entry = pdfHandler.getEntryById(item.entryId);

      const thumbnail = await pdfHandler.generateThumbnail(entry, item.pageIndex + 1, 0.4);

      const card = document.createElement('div');
      card.className = 'merge-page-card';
      card.draggable = true;
      card.dataset.index = i;

      const rotationStyle = item.rotation ? `transform: rotate(${item.rotation}deg);` : '';
      const includedClass = item.include ? 'included' : 'excluded';

      card.innerHTML = `
        <div class="merge-page-thumbnail ${includedClass}">
          <img src="${thumbnail}" alt="Page ${i + 1}" style="${rotationStyle}">
          <div class="merge-page-number">${i + 1}</div>
          <div class="merge-page-source" title="${entry.name}">${entry.name} p.${item.pageIndex + 1}</div>
          <div class="merge-page-actions">
            <button class="btn-floating btn-small waves-effect waves-light blue rotate-btn" title="90°回転">
              <i class="material-icons">rotate_right</i>
            </button>
          </div>
          <div class="merge-page-checkbox">
            <label>
              <input type="checkbox" class="filled-in" ${item.include ? 'checked' : ''}/>
              <span>${item.include ? '含める' : '除外'}</span>
            </label>
          </div>
        </div>
      `;

      // ドラッグ&ドロップイベント
      this.setupMergePageDragEvents(card);

      // 回転ボタン
      card.querySelector('.rotate-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onMergePageRotateCallback) {
          this.onMergePageRotateCallback(parseInt(card.dataset.index));
        }
      });

      // チェックボックス
      const checkbox = card.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (this.onMergePageToggleCallback) {
          this.onMergePageToggleCallback(parseInt(card.dataset.index));
        }
      });

      // カードクリックで拡大表示
      const thumbnailDiv = card.querySelector('.merge-page-thumbnail');
      thumbnailDiv.addEventListener('click', (e) => {
        // ボタンやチェックボックスのクリックは無視
        if (e.target.closest('.merge-page-actions') || e.target.closest('.merge-page-checkbox')) {
          return;
        }
        this.openMergePagePreviewModal(i, thumbnail);
      });

      grid.appendChild(card);
    }

    this.mergePreviewModalInstance.open();
  }

  /**
   * ドラッグ&ドロップのセットアップ
   * @param {HTMLElement} card
   */
  setupMergePageDragEvents(card) {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.index);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(card.dataset.index);

      if (fromIndex !== toIndex && this.onMergePageReorderCallback) {
        this.onMergePageReorderCallback(fromIndex, toIndex);
      }
    });
  }

  /**
   * 結合プレビューのページ並び替えコールバックを設定
   * @param {Function} callback
   */
  onMergePageReorder(callback) {
    this.onMergePageReorderCallback = callback;
  }

  /**
   * 結合プレビューのページ切り替えコールバックを設定
   * @param {Function} callback
   */
  onMergePageToggle(callback) {
    this.onMergePageToggleCallback = callback;
  }

  /**
   * 結合プレビューのページ回転コールバックを設定
   * @param {Function} callback
   */
  onMergePageRotate(callback) {
    this.onMergePageRotateCallback = callback;
  }

  /**
   * 結合ダウンロードコールバックを設定
   * @param {Function} callback
   */
  onMergeDownload(callback) {
    this.onMergeDownloadCallback = callback;
  }

  /**
   * 結合プレビューのページを拡大表示
   * @param {number} index
   * @param {string} thumbnailUrl
   */
  async openMergePagePreviewModal(index, thumbnailUrl) {
    this.currentMergePreviewIndex = index;

    const item = this.currentMergeOrder[index];
    const entry = this.currentPdfHandler.getEntryById(item.entryId);

    // 結合プレビューモーダルを一時的に閉じる
    this.mergePreviewModalInstance.close();

    // モーダルの内容を設定
    this.elements.previewPdfName.textContent = `${entry.name} - ページ ${item.pageIndex + 1}`;
    this.elements.previewPageInfo.textContent = `結合後のページ ${index + 1} / ${this.currentMergeOrder.length}`;

    // 低解像度のサムネイルで開く
    this.elements.previewImage.src = thumbnailUrl;

    // ナビゲーションボタンの有効/無効
    this.elements.previewPrevBtn.disabled = index === 0;
    this.elements.previewNextBtn.disabled = index === this.currentMergeOrder.length - 1;

    // チェックボックスと回転ボタンは非表示（結合プレビューでは使わない）
    this.elements.previewIncludeCheckbox.parentElement.style.display = 'none';
    this.elements.previewRotateBtn.style.display = 'none';

    // モーダルを開く
    this.pagePreviewModalInstance.open();

    // 高解像度サムネイルを生成
    try {
      const highResThumbnail = await this.currentPdfHandler.generateThumbnail(
        entry,
        item.pageIndex + 1,
        2.5
      );

      // 回転を適用
      this.elements.previewImage.className = '';
      if (item.rotation === 90) {
        this.elements.previewImage.classList.add('rotated-90');
      } else if (item.rotation === 180) {
        this.elements.previewImage.classList.add('rotated-180');
      } else if (item.rotation === 270) {
        this.elements.previewImage.classList.add('rotated-270');
      }

      this.elements.previewImage.src = highResThumbnail;
    } catch (error) {
      console.error('高解像度サムネイル生成エラー:', error);
    }
  }

  /**
   * 結合プレビューのナビゲーション処理
   * @param {string} direction - 'prev' | 'next'
   */
  async navigateMergePagePreview(direction) {
    let newIndex = this.currentMergePreviewIndex;

    if (direction === 'prev' && newIndex > 0) {
      newIndex--;
    } else if (direction === 'next' && newIndex < this.currentMergeOrder.length - 1) {
      newIndex++;
    } else {
      return;
    }

    const item = this.currentMergeOrder[newIndex];
    const entry = this.currentPdfHandler.getEntryById(item.entryId);

    // 高解像度サムネイルを生成
    const thumbnailUrl = await this.currentPdfHandler.generateThumbnail(
      entry,
      item.pageIndex + 1,
      2.5
    );

    // モーダルを更新
    this.currentMergePreviewIndex = newIndex;
    this.elements.previewPdfName.textContent = `${entry.name} - ページ ${item.pageIndex + 1}`;
    this.elements.previewPageInfo.textContent = `結合後のページ ${newIndex + 1} / ${this.currentMergeOrder.length}`;
    this.elements.previewImage.src = thumbnailUrl;
    this.elements.previewPrevBtn.disabled = newIndex === 0;
    this.elements.previewNextBtn.disabled = newIndex === this.currentMergeOrder.length - 1;

    // 回転を適用
    this.elements.previewImage.className = '';
    if (item.rotation === 90) {
      this.elements.previewImage.classList.add('rotated-90');
    } else if (item.rotation === 180) {
      this.elements.previewImage.classList.add('rotated-180');
    } else if (item.rotation === 270) {
      this.elements.previewImage.classList.add('rotated-270');
    }
  }
}
