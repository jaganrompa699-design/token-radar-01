// The three screenshots, painted from the entry's own computed board.
//
// Each view is a render of the dashboard the entry ships: the same
// palette, the same numbers, the same rows, drawn with the bitmap font in
// lib/font.ts through the canvas in lib/png.ts. The board view shows the
// top of the ranked board, the detail view shows rank 1's model and farm
// plan, and the filtered view shows one category filter applied. All three
// are deterministic: the same snapshot always paints the same bytes.
//
// Geometry note: drawText takes the top of the text's em box, not the
// baseline — a 14px line occupies about y+3..y+19, a bold 20px line about
// y+3..y+23 — so every y below is an em top with room below it.

import { Canvas, drawText, ellipsize, encodePng, textWidth, wrapText, type RGB } from './png.ts';
import { whyLine, type BoardRow, type RadarData } from './model.ts';

const W = 1440;
const H = 900;
const BG: RGB = [238, 240, 234];
const SURFACE: RGB = [255, 255, 255];
const INK: RGB = [20, 32, 29];
const MUTED: RGB = [95, 111, 103];
const BORDER: RGB = [213, 221, 214];
const ACCENT: RGB = [15, 122, 90];
const BAND: RGB = [14, 43, 38];
const BAND_MUTED: RGB = [158, 178, 169];
const AMBER: RGB = [183, 121, 31];
const NEG: RGB = [178, 59, 46];
const LIGHT: RGB = [244, 246, 243];

export function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}
export function fmtPct(n: number | null): string {
  if (n === null) return 'n/a';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}
export function fmtAge(days: number | null): string {
  if (days === null) return 'unknown';
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  return `${days}d`;
}
function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

/** The dark top band every view shares, with the page's name and snapshot. */
function band(cv: Canvas, radar: RadarData): void {
  cv.rect(0, 0, W, 64, BAND);
  cv.rect(48, 26, 12, 12, ACCENT);
  drawText(cv, 'TOKEN RADAR', 68, 30, [255, 255, 255], false, true);
  const right = `Snapshot ${radar.as_of}  ·  DefiLlama protocol index  ·  ${radar.model_version} model`;
  drawText(cv, right, W - 48 - textWidth(right, false), 30, BAND_MUTED);
}

/** One stat box: a small label over a big value. Box is 66px tall. */
function stat(cv: Canvas, x: number, y: number, w: number, label: string, value: string): void {
  cv.rect(x, y, w, 66, SURFACE);
  cv.rect(x, y, w, 1, BORDER);
  cv.rect(x, y + 65, w, 1, BORDER);
  cv.rect(x, y, 1, 66, BORDER);
  cv.rect(x + w - 1, y, 1, 66, BORDER);
  drawText(cv, label, x + 16, y + 14, MUTED);
  drawText(cv, value, x + 16, y + 36, INK, true);
}

/** A board table's column headings, at em top `y`. */
function tableHead(cv: Canvas, x: number, y: number): void {
  drawText(cv, 'RANK', x + 16, y, MUTED);
  drawText(cv, 'PROTOCOL', x + 76, y, MUTED);
  drawText(cv, 'TVL', x + 470, y, MUTED);
  drawText(cv, '7D', x + 590, y, MUTED);
  drawText(cv, 'AGE', x + 700, y, MUTED);
  drawText(cv, 'IMPLIED VALUE', x + 800, y, MUTED);
  drawText(cv, 'TOKEN', x + 1180, y, MUTED);
}

/** One board row, 54px tall from `top`. */
function tableRow(cv: Canvas, x: number, top: number, w: number, r: BoardRow, maxImplied: number): void {
  if (r.rank % 2 === 0) cv.rect(x, top, w, 54, LIGHT);
  drawText(cv, String(r.rank), x + 16, top + 18, MUTED);
  drawText(cv, ellipsize(r.name, 360, false), x + 76, top + 6, INK, false, true);
  drawText(cv, ellipsize(`${r.category ?? 'Other'} on ${(r.chains[0] ?? 'an unnamed chain')}`, 360, false), x + 76, top + 26, MUTED);
  drawText(cv, fmtUsd(r.tvl_usd), x + 470, top + 18, INK);
  const growth = r.change_7d === null ? MUTED : r.change_7d >= 0 ? ACCENT : NEG;
  drawText(cv, fmtPct(r.change_7d), x + 590, top + 18, growth);
  drawText(cv, fmtAge(r.age_days), x + 700, top + 18, INK);
  const barW = Math.max(4, Math.round((r.implied_value_usd / maxImplied) * 130));
  cv.rect(x + 800, top + 24, 130, 6, [220, 228, 220]);
  cv.rect(x + 800, top + 24, barW, 6, ACCENT);
  drawText(cv, fmtUsd(r.implied_value_usd), x + 946, top + 18, INK, false, true);
  cv.rect(x + 1180, top + 24, 6, 6, ACCENT);
  drawText(cv, 'no token', x + 1194, top + 18, MUTED);
}

/** A board panel: heading, then `rows` of 54px rows. Returns its bottom y. */
function boardPanel(cv: Canvas, panelY: number, rows: BoardRow[], maxImplied: number): number {
  const panelX = 48;
  const panelW = W - 96;
  const height = 40 + rows.length * 54;
  cv.rect(panelX, panelY, panelW, height, SURFACE);
  cv.rect(panelX, panelY, panelW, 1, BORDER);
  cv.rect(panelX, panelY + height - 1, panelW, 1, BORDER);
  tableHead(cv, panelX, panelY + 14);
  cv.hline(panelX + 16, panelY + 40, panelW - 32, BORDER);
  rows.forEach((r, i) => {
    const top = panelY + 40 + i * 54;
    tableRow(cv, panelX, top, panelW, r, maxImplied);
    if (i < rows.length - 1) cv.hline(panelX + 16, top + 54, panelW - 32, BORDER);
  });
  return panelY + height;
}

/** 1-board.png: the ranked board, top rows first. */
export function paintBoard(board: BoardRow[], radar: RadarData): Uint8Array {
  const cv = new Canvas(W, H, BG);
  band(cv, radar);
  drawText(cv, `${radar.watchlist_size} watchlist protocols, ranked by implied value`, 48, 100, INK, true);
  const sub = `The watchlist is the floor: every protocol with at least $50M of TVL and no token on record. The early radar adds ${radar.early_size} pre-token protocols below that floor. Implied value is a model, not a promise.`;
  wrapText(sub, 1344).forEach((line, i) => drawText(cv, line, 48, 132 + i * 20, MUTED));
  const statsY = 186;
  const sw = 312;
  stat(cv, 48, statsY, sw, 'Watchlist covered', `${radar.watchlist_size} / ${radar.watchlist_size}`);
  stat(cv, 48 + (sw + 16) * 1, statsY, sw, 'Pre-token rows scored', fmtInt(radar.board_size));
  stat(cv, 48 + (sw + 16) * 2, statsY, sw, 'Early rows below the floor', fmtInt(radar.early_size));
  stat(cv, 48 + (sw + 16) * 3, statsY, sw, 'Board TVL', fmtUsd(radar.board_tvl_usd));
  const maxImplied = board[0]?.implied_value_usd ?? 1;
  boardPanel(cv, 272, board.slice(0, 10), maxImplied);
  drawText(cv, `Showing 10 of ${radar.board_size} rows — search, filter and sort on the page. Implied value is a model, not a price.`, 48, 872, MUTED);
  return encodePng(cv);
}

/** 2-detail.png: rank 1's detail view — its model, its why, its farm plan. */
export function paintDetail(board: BoardRow[], radar: RadarData): Uint8Array {
  const cv = new Canvas(W, H, BG);
  const top = board[0]!;
  band(cv, radar);
  drawText(cv, `Rank 1 of ${radar.board_size} — ${top.name}`, 48, 100, INK, true);
  const chainText = top.chains.length <= 3 ? top.chains.join(', ') : `${top.chains.slice(0, 3).join(', ')} + ${top.chains.length - 3} more chains`;
  drawText(cv, ellipsize(`${top.category ?? 'Other'} on ${chainText}  ·  records no token`, 1344, false), 48, 132, MUTED);
  // Left: the model breakdown.
  const lx = 48;
  const ly = 164;
  const lh = 436;
  const lw = 740;
  cv.rect(lx, ly, lw, lh, SURFACE);
  cv.rect(lx, ly, lw, 1, BORDER);
  cv.rect(lx, ly + lh - 1, lw, 1, BORDER);
  drawText(cv, 'Implied value', lx + 24, ly + 28, INK, true);
  drawText(cv, fmtUsd(top.implied_value_usd), lx + 24, ly + 64, AMBER, true);
  const rows: Array<[string, string]> = [
    ['TVL', fmtUsd(top.tvl_usd)],
    ['Base multiple', `${top.model.base_multiple}x  ->  base ${fmtUsd(Math.round(top.tvl_usd * top.model.base_multiple))}`],
    ['Seven-day growth', `${fmtPct(top.change_7d)}  ->  growth x${top.model.growth_multiplier}`],
    ['Age with no token', `${fmtAge(top.age_days)}  ->  maturity x${top.model.maturity_multiplier}`],
    ['Chains', `${top.chains.length}  ->  breadth x${top.model.breadth_multiplier}`],
    ['Implied value', fmtUsd(top.implied_value_usd)],
  ];
  rows.forEach(([label, value], i) => {
    const y = ly + 108 + i * 38;
    drawText(cv, label, lx + 24, y, MUTED);
    drawText(cv, value, lx + 300, y, INK, false, i === rows.length - 1);
    if (i < rows.length - 1) cv.hline(lx + 24, y + 26, lw - 48, BORDER);
  });
  drawText(cv, 'The page recomputes this row from the same function and checks the', lx + 24, ly + 348, MUTED);
  drawText(cv, 'number board.json carries. This is an estimate, not a price.', lx + 24, ly + 370, MUTED);
  // Right: the farm plan.
  const rx = 812;
  const rw = W - 48 - rx;
  cv.rect(rx, ly, rw, lh, SURFACE);
  cv.rect(rx, ly, rw, 1, BORDER);
  cv.rect(rx, ly + lh - 1, rw, 1, BORDER);
  drawText(cv, 'Farm plan', rx + 24, ly + 28, INK, true);
  let fy = ly + 58;
  top.farm_steps.forEach((step, i) => {
    const at = step.indexOf(' Cost: ');
    const action = at >= 0 ? step.slice(0, at) : step;
    const tail = at >= 0 ? step.slice(at + 1) : '';
    drawText(cv, `${i + 1}.`, rx + 24, fy, ACCENT, false, true);
    wrapText(action, rw - 76).forEach((line) => {
      drawText(cv, line, rx + 52, fy, INK);
      fy += 16;
    });
    wrapText(tail, rw - 76).forEach((line) => {
      drawText(cv, line, rx + 52, fy, MUTED);
      fy += 16;
    });
    fy += 8;
  });
  // Why this rank, full width.
  drawText(cv, 'Why this rank', 48, 624, INK, true);
  wrapText(whyLine(top), 1344).forEach((line, i) => drawText(cv, line, 48, 652 + i * 20, MUTED));
  // Mini board: the next three rows.
  drawText(cv, 'Next on the board', 48, 700, INK, true);
  board.slice(1, 4).forEach((r, i) => {
    const y = 726 + i * 36;
    drawText(cv, String(r.rank), 48, y + 10, MUTED);
    drawText(cv, ellipsize(r.name, 420, false), 96, y + 10, INK, false, true);
    drawText(cv, fmtUsd(r.tvl_usd), 560, y + 10, INK);
    drawText(cv, fmtPct(r.change_7d), 700, y + 10, r.change_7d !== null && r.change_7d >= 0 ? ACCENT : NEG);
    drawText(cv, fmtUsd(r.implied_value_usd), 860, y + 10, INK, false, true);
    if (i < 2) cv.hline(48, y + 32, 1000, BORDER);
  });
  drawText(cv, 'Select any row on the board to open its detail view.', 48, 868, MUTED);
  return encodePng(cv);
}

/** 3-filtered.png: the board filtered to one category, Lending. */
export function paintFiltered(board: BoardRow[], radar: RadarData): Uint8Array {
  const cv = new Canvas(W, H, BG);
  band(cv, radar);
  const category = 'Lending';
  const filtered = board.filter((r) => r.category === category);
  drawText(cv, `Filtered: ${category} — ${filtered.length} protocols`, 48, 100, INK, true);
  drawText(cv, `One category, still ranked by implied value. Clear the filter to see all ${radar.board_size} rows again.`, 48, 132, MUTED);
  // Controls bar, as the page draws it.
  const cy = 164;
  cv.rect(48, cy, W - 96, 56, SURFACE);
  cv.rect(48, cy, W - 96, 1, BORDER);
  cv.rect(48, cy + 55, W - 96, 1, BORDER);
  drawText(cv, 'Search', 68, cy + 20, MUTED);
  cv.rect(140, cy + 10, 300, 36, SURFACE);
  cv.rect(140, cy + 10, 300, 1, BORDER);
  cv.rect(140, cy + 45, 300, 1, BORDER);
  cv.rect(140, cy + 10, 1, 36, BORDER);
  cv.rect(439, cy + 10, 1, 36, BORDER);
  drawText(cv, 'Search name, category or chain', 152, cy + 20, MUTED);
  drawText(cv, 'Category', 470, cy + 20, MUTED);
  cv.rect(550, cy + 10, 180, 36, [232, 240, 234]);
  drawText(cv, category, 562, cy + 20, INK, false, true);
  drawText(cv, 'Token status', 760, cy + 20, MUTED);
  cv.rect(860, cy + 10, 110, 36, INK);
  drawText(cv, 'Pre-token', 876, cy + 20, SURFACE, false, true);
  cv.rect(978, cy + 10, 110, 36, SURFACE);
  cv.rect(978, cy + 10, 110, 1, BORDER);
  cv.rect(978, cy + 45, 110, 1, BORDER);
  drawText(cv, 'Live token', 992, cy + 20, MUTED);
  drawText(cv, `${filtered.length} rows shown`, W - 48 - textWidth(`${filtered.length} rows shown`, false), cy + 20, MUTED);
  const maxImplied = board[0]?.implied_value_usd ?? 1;
  boardPanel(cv, 236, filtered.slice(0, 10), maxImplied);
  drawText(cv, `Filter: category = ${category}. The board, the detail view and the filter all read the same data.js.`, 48, 856, MUTED);
  return encodePng(cv);
}

/** All three screenshots, in dossier order. */
export function paintScreenshots(board: BoardRow[], radar: RadarData): Array<{ name: string; bytes: Uint8Array }> {
  return [
    { name: '1-board.png', bytes: paintBoard(board, radar) },
    { name: '2-detail.png', bytes: paintDetail(board, radar) },
    { name: '3-filtered.png', bytes: paintFiltered(board, radar) },
  ];
}
