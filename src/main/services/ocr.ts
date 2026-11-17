import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { OcrBox } from '../../shared/types';

const TESSERACT_CANDIDATES = [
  '/opt/homebrew/bin/tesseract',
  '/usr/local/bin/tesseract',
  '/usr/bin/tesseract',
];

interface TsvWord {
  block: string;
  paragraph: string;
  line: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  text: string;
}

/**
 * OCR for phone screenshots. Tesseract is used because Android Unity/Flutter
 * surfaces expose no accessible UI tree, while their rendered text is still
 * readable in a native-resolution screenshot.
 */
export class OcrService {
  private readonly binary =
    process.env.PHONEEXPLORER_TESSERACT ||
    TESSERACT_CANDIDATES.find((candidate) => existsSync(candidate)) ||
    'tesseract';

  async recognize(path: string, imageWidth: number, imageHeight: number): Promise<OcrBox[]> {
    const raw = await new Promise<string>((resolve, reject) => {
      execFile(
        this.binary,
        [path, 'stdout', '--psm', '11', 'tsv'],
        { timeout: 45_000, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `Phone OCR failed (${this.binary}): ${stderr.trim() || error.message}`,
              ),
            );
            return;
          }
          resolve(stdout);
        },
      );
    });

    const words: TsvWord[] = [];
    for (const line of raw.split(/\r?\n/).slice(1)) {
      const parts = line.split('\t');
      if (parts.length < 12) continue;
      const text = parts.slice(11).join('\t').trim();
      const confidence = Number(parts[10]);
      const left = Number(parts[6]);
      const top = Number(parts[7]);
      const width = Number(parts[8]);
      const height = Number(parts[9]);
      if (
        !text ||
        !Number.isFinite(confidence) ||
        confidence < 30 ||
        !Number.isFinite(left) ||
        !Number.isFinite(top) ||
        width <= 0 ||
        height <= 0
      ) {
        continue;
      }
      words.push({
        block: parts[2],
        paragraph: parts[3],
        line: parts[4],
        left,
        top,
        width,
        height,
        confidence,
        text,
      });
    }

    const lines = new Map<string, TsvWord[]>();
    for (const word of words) {
      const key = `${word.block}:${word.paragraph}:${word.line}`;
      const group = lines.get(key) ?? [];
      group.push(word);
      lines.set(key, group);
    }

    return Array.from(lines.values())
      .map((group) => {
        const left = Math.min(...group.map((word) => word.left));
        const top = Math.min(...group.map((word) => word.top));
        const right = Math.max(...group.map((word) => word.left + word.width));
        const bottom = Math.max(...group.map((word) => word.top + word.height));
        const width = right - left;
        const height = bottom - top;
        return {
          text: group
            .sort((a, b) => a.left - b.left)
            .map((word) => word.text)
            .join(' ')
            .trim(),
          confidence:
            group.reduce((sum, word) => sum + word.confidence, 0) / group.length / 100,
          x: left / imageWidth,
          y: top / imageHeight,
          width: width / imageWidth,
          height: height / imageHeight,
          center: {
            x: (left + width / 2) / imageWidth,
            y: (top + height / 2) / imageHeight,
          },
        };
      })
      .filter((box) => box.text.length > 0)
      .sort((a, b) => (Math.abs(a.y - b.y) > 0.012 ? a.y - b.y : a.x - b.x));
  }
}
