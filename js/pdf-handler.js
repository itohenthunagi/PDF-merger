/**
 * PDF Handler
 * PDFファイルの読み込み、プレビュー生成、結合処理を担当
 */

class PdfHandler {
  constructor() {
    this.entries = []; // PdfEntry[]
    this.selectedEntryId = null;
  }

  /**
   * PDFファイルを読み込んでエントリを作成
   * @param {File} file - PDFファイル
   * @returns {Promise<PdfEntry>}
   */
  async loadPdfFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // デバッグ: ファイル読み込み確認
      console.log(`PDFファイル読み込み: ${file.name}`);
      console.log(`  ファイルサイズ: ${file.size} bytes`);
      console.log(`  ArrayBuffer長: ${arrayBuffer.byteLength} bytes`);

      // 重要: PDF.jsがArrayBufferを転送（detach）してしまうため、
      // 独立した2つのコピーを作成する

      // pdf-lib用のコピー（完全に独立したArrayBuffer）
      const bytesForPdfLib = new Uint8Array(new ArrayBuffer(arrayBuffer.byteLength));
      bytesForPdfLib.set(new Uint8Array(arrayBuffer));

      // PDF.js用のコピー（完全に独立したArrayBuffer）
      const bytesForPdfJs = new Uint8Array(new ArrayBuffer(arrayBuffer.byteLength));
      bytesForPdfJs.set(new Uint8Array(arrayBuffer));

      const header = String.fromCharCode(...bytesForPdfLib.slice(0, 5));
      console.log(`  PDFヘッダー: ${header}`);

      // PDF.jsでページ数を取得（CMapを使用して日本語などのマルチバイト文字に対応）
      const loadingTask = pdfjsLib.getDocument({
        data: bytesForPdfJs,
        cMapUrl: './vendor/cmaps/',
        cMapPacked: true
      });
      const pdfjsDoc = await loadingTask.promise;
      const numPages = pdfjsDoc.numPages;

      console.log(`  ✓ 読み込み完了: ${numPages}ページ`);

      // pdf-lib用のコピーを保存
      const entry = {
        id: this.generateId(),
        name: file.name,
        bytes: bytesForPdfLib,  // pdf-lib専用のコピー
        numPages: numPages,
        includePages: new Array(numPages).fill(true), // デフォルトで全ページ含める
        pageRotations: new Array(numPages).fill(0), // 全ページ0度で初期化
        pdfjsDoc: pdfjsDoc
      };

      return entry;
    } catch (error) {
      console.error(`PDFの読み込みに失敗: ${file.name}`, error);
      throw new Error(`PDFの読み込みに失敗しました: ${file.name}`);
    }
  }

  /**
   * エントリを追加
   * @param {PdfEntry} entry
   */
  addEntry(entry) {
    this.entries.push(entry);
  }

  /**
   * 全エントリを取得
   * @returns {PdfEntry[]}
   */
  getEntries() {
    return this.entries;
  }

  /**
   * エントリをファイル名の自然順でソート
   */
  sortEntries() {
    const collator = new Intl.Collator('ja', {
      numeric: true,
      sensitivity: 'base'
    });

    this.entries.sort((a, b) => collator.compare(a.name, b.name));
  }

  /**
   * IDでエントリを取得
   * @param {string} id
   * @returns {PdfEntry|undefined}
   */
  getEntryById(id) {
    return this.entries.find(entry => entry.id === id);
  }

  /**
   * 選択中のエントリを設定
   * @param {string} id
   */
  setSelectedEntry(id) {
    this.selectedEntryId = id;
  }

  /**
   * 選択中のエントリを取得
   * @returns {PdfEntry|null}
   */
  getSelectedEntry() {
    if (!this.selectedEntryId) return null;
    return this.getEntryById(this.selectedEntryId);
  }

  /**
   * 指定ページのサムネイルを生成
   * @param {PdfEntry} entry
   * @param {number} pageNum - 1-based page number
   * @param {number} scale - レンダリングスケール（デフォルト: 0.5）
   * @returns {Promise<string>} - Data URL
   */
  async generateThumbnail(entry, pageNum, scale = 0.5) {
    try {
      const page = await entry.pdfjsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error(`サムネイル生成失敗: ${entry.name} - page ${pageNum}`, error);
      throw error;
    }
  }

  /**
   * ページのコンテンツが正常に表示されているか検証
   * @param {PdfEntry} entry
   * @param {number} pageNum - 1-based page number
   * @returns {Promise<boolean>} - true: 正常, false: 真っ白or問題あり
   */
  async validatePageContent(entry, pageNum) {
    try {
      const page = await entry.pdfjsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.3 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      // ピクセルデータを取得して白色のみかチェック
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let nonWhitePixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        // RGB全てが250以上でない場合は非白色ピクセル
        if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
          nonWhitePixels++;
        }
      }

      // 5%以上の非白色ピクセルがあれば正常とみなす
      const threshold = (canvas.width * canvas.height) * 0.05;
      return nonWhitePixels > threshold;
    } catch (error) {
      console.error(`ページ検証失敗: ${entry.name} - page ${pageNum}`, error);
      return false;
    }
  }

  /**
   * 全エントリのコンテンツを検証
   * @returns {Promise<string[]>} - 問題のあるPDFのファイル名配列
   */
  async validateAllEntries() {
    const warnings = [];
    for (const entry of this.entries) {
      // 最初のページだけチェック（パフォーマンス考慮）
      const isValid = await this.validatePageContent(entry, 1);
      if (!isValid) {
        warnings.push(entry.name);
      }
    }
    return warnings;
  }

  /**
   * 全ページのサムネイルを生成
   * @param {PdfEntry} entry
   * @param {number} scale
   * @returns {Promise<string[]>} - Data URLs
   */
  async generateAllThumbnails(entry, scale = 0.5) {
    const thumbnails = [];
    for (let i = 1; i <= entry.numPages; i++) {
      const thumbnail = await this.generateThumbnail(entry, i, scale);
      thumbnails.push(thumbnail);
    }
    return thumbnails;
  }

  /**
   * 選択されたページのみを結合してPDFを生成
   * @returns {Promise<Uint8Array>}
   */
  async mergePdfs() {
    try {
      console.log('=== PDF結合開始 ===');
      const mergedPdf = await PDFLib.PDFDocument.create();

      for (const entry of this.entries) {
        // デバッグ: PDFデータの確認
        console.log(`処理中: ${entry.name}`);
        console.log(`  bytes型:`, entry.bytes.constructor.name);
        console.log(`  bytes長:`, entry.bytes.length);
        console.log(`  ArrayBuffer detached?:`, entry.bytes.buffer.byteLength === 0 ? 'Yes (問題!)' : 'No (OK)');

        if (entry.bytes.length === 0) {
          throw new Error(`${entry.name} のデータが空です。ArrayBufferがdetachされた可能性があります。`);
        }

        // PDFヘッダーの確認（最初の5バイトは %PDF- のはず）
        const header = String.fromCharCode(...entry.bytes.slice(0, 5));
        console.log(`  PDFヘッダー:`, header);

        if (!header.startsWith('%PDF')) {
          throw new Error(`${entry.name} は有効なPDFファイルではありません（ヘッダー: ${header}）`);
        }

        // 元のPDFを読み込み（暗号化PDFにも対応）
        console.log(`  pdf-libで読み込み中...`);
        const srcPdf = await PDFLib.PDFDocument.load(entry.bytes, {
          ignoreEncryption: true
        });
        console.log(`  ✓ 読み込み成功`);

        // 含めるページのインデックスを取得（0-based）
        const includedIndices = entry.includePages
          .map((flag, index) => flag ? index : null)
          .filter(index => index !== null);

        if (includedIndices.length === 0) {
          console.log(`スキップ: ${entry.name} (含めるページが0)`);
          continue;
        }

        // ページをコピー
        const copiedPages = await mergedPdf.copyPages(srcPdf, includedIndices);

        // コピーしたページを追加（回転も適用）
        for (let i = 0; i < copiedPages.length; i++) {
          const page = copiedPages[i];
          const originalIndex = includedIndices[i];
          const rotation = entry.pageRotations ? entry.pageRotations[originalIndex] : 0;

          // 回転を適用
          if (rotation !== 0) {
            page.setRotation(PDFLib.degrees(rotation));
          }

          mergedPdf.addPage(page);
        }
      }

      // PDFをバイト配列として保存
      const mergedBytes = await mergedPdf.save();
      return mergedBytes;
    } catch (error) {
      console.error('PDF結合エラー:', error);
      throw new Error('PDFの結合に失敗しました');
    }
  }

  /**
   * マニフェストJSONを生成
   * @returns {string}
   */
  generateManifest() {
    const manifest = {
      toolVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      inputs: this.entries.map(entry => {
        // 含めるページを1-basedで記録
        const includedPages = entry.includePages
          .map((flag, index) => flag ? index + 1 : null)
          .filter(page => page !== null);

        return {
          name: entry.name,
          pages: entry.numPages,
          included: includedPages
        };
      })
    };

    return JSON.stringify(manifest, null, 2);
  }

  /**
   * ページの含有フラグを更新
   * @param {string} entryId
   * @param {number} pageIndex - 0-based
   * @param {boolean} include
   */
  setPageInclude(entryId, pageIndex, include) {
    const entry = this.getEntryById(entryId);
    if (entry && pageIndex >= 0 && pageIndex < entry.numPages) {
      entry.includePages[pageIndex] = include;
    }
  }

  /**
   * 全ページを選択/解除
   * @param {string} entryId
   * @param {boolean} include
   */
  setAllPagesInclude(entryId, include) {
    const entry = this.getEntryById(entryId);
    if (entry) {
      entry.includePages = entry.includePages.map(() => include);
    }
  }

  /**
   * ページ選択を反転
   * @param {string} entryId
   */
  invertPageSelection(entryId) {
    const entry = this.getEntryById(entryId);
    if (entry) {
      entry.includePages = entry.includePages.map(flag => !flag);
    }
  }

  /**
   * ページを90度回転
   * @param {string} entryId
   * @param {number} pageIndex - 0-based
   */
  rotatePageBy90(entryId, pageIndex) {
    const entry = this.getEntryById(entryId);
    if (!entry) return;

    const current = entry.pageRotations[pageIndex] || 0;
    entry.pageRotations[pageIndex] = (current + 90) % 360;
  }

  /**
   * 含まれるページ数を取得
   * @param {PdfEntry} entry
   * @returns {number}
   */
  getIncludedPageCount(entry) {
    return entry.includePages.filter(flag => flag).length;
  }

  /**
   * 指定したIDのエントリを削除
   * @param {string[]} ids - 削除するエントリのID配列
   */
  removeEntries(ids) {
    const idsSet = new Set(ids);

    // 削除対象のエントリをクリーンアップ
    this.entries.forEach(entry => {
      if (idsSet.has(entry.id) && entry.pdfjsDoc) {
        entry.pdfjsDoc.destroy();
      }
    });

    // エントリを削除
    this.entries = this.entries.filter(entry => !idsSet.has(entry.id));

    // 選択中のエントリが削除された場合はクリア
    if (this.selectedEntryId && idsSet.has(this.selectedEntryId)) {
      this.selectedEntryId = null;
    }
  }

  /**
   * エントリの順番を入れ替え
   * @param {string} entryId - 移動するエントリのID
   * @param {string} direction - 'up' | 'down'
   * @returns {boolean} - 移動が成功したかどうか
   */
  moveEntry(entryId, direction) {
    const currentIndex = this.entries.findIndex(entry => entry.id === entryId);

    if (currentIndex === -1) return false;

    let targetIndex;
    if (direction === 'up') {
      if (currentIndex === 0) return false; // すでに先頭
      targetIndex = currentIndex - 1;
    } else if (direction === 'down') {
      if (currentIndex === this.entries.length - 1) return false; // すでに末尾
      targetIndex = currentIndex + 1;
    } else {
      return false;
    }

    // 配列内の要素を入れ替え
    const temp = this.entries[currentIndex];
    this.entries[currentIndex] = this.entries[targetIndex];
    this.entries[targetIndex] = temp;

    return true;
  }

  /**
   * 全エントリをクリア
   */
  clear() {
    // PDF.jsドキュメントのクリーンアップ
    this.entries.forEach(entry => {
      if (entry.pdfjsDoc) {
        entry.pdfjsDoc.destroy();
      }
    });

    this.entries = [];
    this.selectedEntryId = null;
  }

  /**
   * ユニークIDを生成
   * @returns {string}
   */
  generateId() {
    return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 結合順序を初期化
   */
  initMergeOrder() {
    this.mergeOrder = [];
    for (const entry of this.entries) {
      for (let i = 0; i < entry.numPages; i++) {
        if (entry.includePages[i]) {
          this.mergeOrder.push({
            entryId: entry.id,
            pageIndex: i,
            rotation: entry.pageRotations ? entry.pageRotations[i] : 0,
            include: true // デフォルトで含める
          });
        }
      }
    }
  }

  /**
   * ページ順序を変更
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  reorderMergePage(fromIndex, toIndex) {
    const [item] = this.mergeOrder.splice(fromIndex, 1);
    this.mergeOrder.splice(toIndex, 0, item);
  }

  /**
   * ページの含める/除外を切り替え
   * @param {number} index
   */
  toggleMergePage(index) {
    if (!this.mergeOrder[index]) return;
    this.mergeOrder[index].include = !this.mergeOrder[index].include;
  }

  /**
   * 結合順序のページを回転
   * @param {number} index
   */
  rotateMergePage(index) {
    if (!this.mergeOrder[index]) return;
    const current = this.mergeOrder[index].rotation || 0;
    this.mergeOrder[index].rotation = (current + 90) % 360;
  }

  /**
   * 結合順序に基づいてPDFを生成
   * @returns {Promise<Uint8Array>}
   */
  async mergePdfsWithOrder() {
    try {
      console.log('=== 結合順序に基づくPDF結合開始 ===');
      const mergedPdf = await PDFLib.PDFDocument.create();

      for (const item of this.mergeOrder) {
        // include=trueのページのみを結合
        if (!item.include) continue;

        const entry = this.getEntryById(item.entryId);
        if (!entry) continue;

        const srcPdf = await PDFLib.PDFDocument.load(entry.bytes, {
          ignoreEncryption: true
        });

        const [copiedPage] = await mergedPdf.copyPages(srcPdf, [item.pageIndex]);

        // 回転を適用
        if (item.rotation !== 0) {
          copiedPage.setRotation(PDFLib.degrees(item.rotation));
        }

        mergedPdf.addPage(copiedPage);
      }

      return await mergedPdf.save();
    } catch (error) {
      console.error('PDF結合エラー:', error);
      throw new Error('PDFの結合に失敗しました');
    }
  }
}
