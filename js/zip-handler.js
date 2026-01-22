/**
 * ZIP Handler
 * ZIPファイルの展開と生成を担当
 */

class ZipHandler {
  /**
   * ZIPファイルからPDFファイルを抽出
   * @param {File} zipFile
   * @returns {Promise<File[]>} - PDF File オブジェクトの配列
   */
  async extractPdfsFromZip(zipFile) {
    try {
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const pdfFiles = [];

      // ZIP内の全ファイルを走査
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        // ディレクトリはスキップ
        if (zipEntry.dir) continue;

        // PDFファイルのみ抽出（大文字小文字を区別しない）
        if (relativePath.toLowerCase().endsWith('.pdf')) {
          const bytes = await zipEntry.async('uint8array');

          // File オブジェクトとして再構成
          const fileName = this.extractFileName(relativePath);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const file = new File([blob], fileName, { type: 'application/pdf' });

          pdfFiles.push(file);
        }
      }

      console.log(`ZIP内から ${pdfFiles.length} 個のPDFを抽出: ${zipFile.name}`);
      return pdfFiles;
    } catch (error) {
      console.error(`ZIP展開エラー: ${zipFile.name}`, error);
      throw new Error(`ZIPファイルの展開に失敗しました: ${zipFile.name}`);
    }
  }

  /**
   * パスからファイル名を抽出
   * @param {string} path
   * @returns {string}
   */
  extractFileName(path) {
    // Windows/Unix両方のパス区切りに対応
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  /**
   * 結合結果のZIPファイルを生成
   * @param {Uint8Array} mergedPdfBytes - 結合されたPDFのバイト配列
   * @param {string} manifestJson - マニフェストJSON文字列
   * @returns {Promise<Blob>}
   */
  async createResultZip(mergedPdfBytes, manifestJson) {
    try {
      const zip = new JSZip();

      // merged.pdf を追加
      zip.file('merged.pdf', mergedPdfBytes);

      // manifest.json を追加
      zip.file('manifest.json', manifestJson);

      // ZIP生成
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });

      return blob;
    } catch (error) {
      console.error('ZIP生成エラー:', error);
      throw new Error('ZIPファイルの生成に失敗しました');
    }
  }

  /**
   * Blobをダウンロード
   * @param {Blob} blob
   * @param {string} filename
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // メモリリーク防止のためURLを解放
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * 現在の日時を含むファイル名を生成
   * @returns {string}
   */
  generateResultFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    return `pdf-merge-result_${year}${month}${day}_${hour}${minute}.zip`;
  }
}
