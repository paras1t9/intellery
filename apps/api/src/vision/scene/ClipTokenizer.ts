import { readFile } from "node:fs/promises";

/*
 * CLIP tokenizer — TypeScript port of the original OpenAI CLIP tokenizer.
 *
 * References:
 *   https://github.com/openai/CLIP/blob/main/clip/simple_tokenizer.py
 *
 * Key concepts:
 *  - bytes_to_unicode(): maps every possible byte (0-255) to a unique
 *    printable unicode character so BPE can operate on bytes without
 *    needing a special <UNK> token.
 *  - BPE is applied at the character (byte-unicode) level.
 *  - Special tokens: 49406 = <|startoftext|>, 49407 = <|endoftext|>.
 *  - Sequences are always padded / truncated to CONTEXT_LENGTH = 77.
 */

const SOT_TOKEN      = 49406; // <|startoftext|>
const EOT_TOKEN      = 49407; // <|endoftext|>
const CONTEXT_LENGTH = 77;

/*
 * Split pattern that CLIP uses on input text.
 * Handles contractions, words, digits, and punctuation.
 */
const PAT = /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[a-zA-Z\u00C0-\u024F]+|[0-9]|[^\s\w]+/g;

function buildByteToUnicode(): Map<number, string> {
  /*
   * printable ASCII + selected Latin-1 ranges map to themselves.
   * The 66 remaining bytes (0-32, 127-160, 173) shift to 256+.
   * This guarantees every byte maps to a unique, non-whitespace char.
   */
  const bs: number[] = [];
  for (let i = 33;  i <= 126; i++) bs.push(i);  // '!' to '~'
  for (let i = 161; i <= 172; i++) bs.push(i);  // '¡' to '¬'
  for (let i = 174; i <= 255; i++) bs.push(i);  // '®' to 'ÿ'

  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }

  const map = new Map<number, string>();
  for (let i = 0; i < bs.length; i++) {
    map.set(bs[i], String.fromCodePoint(cs[i]));
  }
  return map;
}

function getPairs(word: readonly string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < word.length - 1; i++) {
    pairs.push([word[i], word[i + 1]]);
  }
  return pairs;
}

export class ClipTokenizer {
  private readonly encoder:     Map<string, number>;
  private readonly bpeRanks:    Map<string, number>;
  private readonly byteEncoder: Map<number, string>;
  private readonly cache:       Map<string, string[]> = new Map();

  private constructor(
    encoder:     Map<string, number>,
    bpeRanks:    Map<string, number>,
    byteEncoder: Map<number, string>,
  ) {
    this.encoder     = encoder;
    this.bpeRanks    = bpeRanks;
    this.byteEncoder = byteEncoder;
  }

  static async create(vocabPath: string, mergesPath: string): Promise<ClipTokenizer> {
    const [vocabRaw, mergesRaw] = await Promise.all([
      readFile(vocabPath,  "utf-8"),
      readFile(mergesPath, "utf-8"),
    ]);

    const vocab    = JSON.parse(vocabRaw) as Record<string, number>;
    const encoder  = new Map(Object.entries(vocab));

    /*
     * merges.txt format:
     *   Line 0: "#version: 0.2"  (skip)
     *   Line 1+: "Ġ t"          (two BPE tokens separated by space)
     *
     * The rank is the line index (lower = higher priority).
     */
    const bpeRanks = new Map<string, number>();
    const lines    = mergesRaw.split("\n");
    let rank       = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      bpeRanks.set(trimmed, rank++);
    }

    return new ClipTokenizer(encoder, bpeRanks, buildByteToUnicode());
  }

  private bpe(token: string): string[] {
    if (this.cache.has(token)) return this.cache.get(token)!;

    let word = [...token]; // split into individual unicode chars

    if (word.length === 1) {
      this.cache.set(token, word);
      return word;
    }

    // Append </w> end-of-word marker to last char (CLIP convention)
    word[word.length - 1] += "</w>";

    while (true) {
      const pairs = getPairs(word);
      if (pairs.length === 0) break;

      // Find the pair with the lowest BPE rank (highest priority)
      let bestPair: [string, string] | null = null;
      let bestRank = Infinity;

      for (const pair of pairs) {
        const rank = this.bpeRanks.get(`${pair[0]} ${pair[1]}`);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestPair = pair;
        }
      }

      if (!bestPair) break; // no more merges apply

      const [first, second] = bestPair;
      const merged: string[] = [];
      let i = 0;

      while (i < word.length) {
        const j = word.indexOf(first, i);
        if (j === -1) {
          merged.push(...word.slice(i));
          break;
        }
        merged.push(...word.slice(i, j));
        if (j < word.length - 1 && word[j + 1] === second) {
          merged.push(first + second);
          i = j + 2;
        } else {
          merged.push(first);
          i = j + 1;
        }
      }

      word = merged;
    }

    this.cache.set(token, word);
    return word;
  }

  /**
   * Tokenize `text` into a pair of Int64 tensors ready for the CLIP text model:
   *   - inputIds:      [1, 77] — token IDs (padded with 0)
   *   - attentionMask: [1, 77] — 1 for real tokens, 0 for padding
   */
  encode(text: string): { inputIds: BigInt64Array; attentionMask: BigInt64Array } {
    const lower  = text.toLowerCase().trim();
    const tokens: number[] = [SOT_TOKEN];

    const matches = lower.match(PAT) ?? [];

    for (const word of matches) {
      /*
       * Encode each character of the word to the byte-unicode space,
       * then apply BPE, then look up each subword in the vocabulary.
       */
      const encoded = [...word].map((ch) => {
        const byte = ch.charCodeAt(0);
        return this.byteEncoder.get(byte) ?? ch;
      }).join("");

      const subwords = this.bpe(encoded);

      for (const sw of subwords) {
        const id = this.encoder.get(sw);
        if (id !== undefined) tokens.push(id);
      }

      // Truncate early if we're about to exceed the context window
      if (tokens.length >= CONTEXT_LENGTH - 1) break;
    }

    tokens.push(EOT_TOKEN);

    // Build fixed-length [1, 77] tensors
    const inputIds      = new BigInt64Array(CONTEXT_LENGTH).fill(0n);
    const attentionMask = new BigInt64Array(CONTEXT_LENGTH).fill(0n);

    const len = Math.min(tokens.length, CONTEXT_LENGTH);
    for (let i = 0; i < len; i++) {
      inputIds[i]      = BigInt(tokens[i]);
      attentionMask[i] = 1n;
    }

    return { inputIds, attentionMask };
  }
}
