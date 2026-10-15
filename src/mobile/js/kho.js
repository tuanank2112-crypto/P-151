// Warehouse screens (Kho vật tư) — plan 11 SPEC-P05 §4. Same endpoints as renderWarehouse in src/web/app.js.
import { api, listMaterialRequests } from './api.js?v=19';
import { el, emptyState, field, fill, formatTime, pageHead, pagedList, pill, refreshButton, toast, writeButton } from './ui.js?v=19';
import {
  caseHead, caseScreen, codeOf, deptName, eventsHistory, isSeedTicket, loadCatalog, materialName, materialUnit, reportBox, select,
} from './staff.js?v=19';

// Q37: "Nhập vật tư" replaces "Chờ vật tư" (receipt form + the open material requests PVT-…, plan 24); "Cảnh báo" = stock under the threshold
const TILES = [['receive', 'Nhập vật tư', 'box'], ['stock', 'Tồn kho', 'grid'], ['low', 'Cảnh báo', 'warning']];
let tab = 'receive';
/** Item + qty the "Nhập vật tư" form starts with after "Nhập thêm" on a warning row. */
let prefill = null;
/** The header bell opens "Nhập vật tư" (the open material requests are listed there). */
export function focusQueue() { tab = 'receive'; }

/** Plan 19 (same rule as portal/src/lib/stock.ts): out when qty <= 0, low when qty <= the item's own min_qty; unknown qty or no threshold is not warned. */
export function lowStock(stock) {
  return stock.filter((s) => s.qty != null && (s.qty <= 0 || (s.min_qty != null && s.qty <= s.min_qty))).sort((a, b) => a.qty - b.qty);
}
/** Quantity that brings the item back above its threshold (at least 1). */
const restockQty = (s) => Math.max(1, (s.min_qty ?? 0) + 1 - s.qty);

/** Form "Nhập kho": item + qty > 0 ⇒ POST /mo/warehouse/stock/{item_code}; `after()` reloads the screen. */
function receiveForm(ctx, stock, { item = '', qty = 1, after }) {
  const itemBox = select(stock.map((s) => [s.item_code, materialName(s.item_code, s.item_name)]), { placeholder: 'Chọn vật tư…', value: item, id: 'kho-item' });
  const qtyBox = el('input', { class: 'field', id: 'kho-qty', type: 'number', inputmode: 'numeric', min: '1', step: '1', value: String(qty) });
  const button = writeButton('Nhập kho', async () => {
    const code = itemBox.value;
    const amount = Number(qtyBox.value);
    if (!code || !(amount > 0)) { ctx.fail({ kind: 'invalid', message: 'Chọn vật tư và số lượng lớn hơn 0' }); return; }
    try {
      const cases = await api(`/mo/warehouse/stock/${encodeURIComponent(code)}`, { method: 'POST', body: { qty: amount } });
      const waiting = cases.filter((x) => codeOf(x.ticket) === 'WAITING_MATERIAL').length;
      toast(['Đã nhập kho', cases.length - waiting ? `${cases.length - waiting} phản ánh chạy tiếp` : null, waiting ? `${waiting} phản ánh vẫn chờ` : null].filter(Boolean).join('; '));
    } catch (err) {
      ctx.fail(err);
    }
    await after().catch((err) => ctx.fail(err));
  });
  return el('div', { class: 'act-box accept', id: 'kho-receive' }, el('b', { class: 'big' }, 'Nhập kho'),
    field('Vật tư', itemBox), field('Số lượng nhập thêm', qtyBox, 'Cộng dồn vào tồn kho hiện có.'), button);
}

/** Plan 24 SPEC-P03 §2: one card per open request (GET /mo/warehouse/requests); "Nhập đủ" on a line fills the receipt form above. */
export function requestCard(cat, onFill) {
  return (r) => el('article', { class: 'card bitem', dataset: { request: r.request_id } },
    el('span', { class: 'trow' }, el('b', {}, r.request_id), pill(r.source === 'AGENT' ? 'st-moi' : 'cat-none', r.source === 'AGENT' ? 'Agent' : deptName(cat, r.department_id) || 'Phòng ban', { dot: false })),
    el('span', { class: 'tmeta' }, el('a', { href: `#/k/${encodeURIComponent(r.ticket_id)}` }, r.ticket_id),
      ` · ${[deptName(cat, r.department_id), r.location, `chờ từ ${formatTime(r.since)}`].filter(Boolean).join(' · ')}`),
    r.note ? el('span', { class: 'ttitle' }, `Ghi chú: ${r.note}`) : null,
    el('ul', { class: 'stock-list' }, r.lines.map((line) => {
      const unit = materialUnit(line.item_code, line.unit);
      return el('li', { dataset: { item: line.item_code } },
        el('div', {}, el('b', {}, materialName(line.item_code, line.item_name)),
          el('small', {}, `cần ${line.needed_qty} ${unit} · tồn ${line.stock_qty != null ? `${line.stock_qty} ${unit}` : 'không rõ'} · thiếu ${line.shortage_qty} ${unit}`)),
        el('button', { type: 'button', class: 'btn', onclick: () => onFill({ item: line.item_code, qty: Math.max(1, Math.ceil(line.shortage_qty)) }) }, 'Nhập đủ'));
    })));
}

function stockList(stock) {
  return el('div', { class: 'card pad', id: 'kho-stock' }, el('h2', {}, 'Tồn kho hiện tại'),
    el('ul', { class: 'stock-list' }, stock.map((s) => el('li', { dataset: { item: s.item_code } },
      el('div', {}, el('b', {}, materialName(s.item_code, s.item_name)), el('small', {}, s.item_code)),
      el('span', { class: 'qty' }, s.qty == null ? 'Chưa rõ' : `${s.qty} ${materialUnit(s.item_code, s.unit)}`)))));
}

function lowList(low, onReceive) {
  if (!low.length) return emptyState('Không có vật tư nào cần nhập thêm.');
  return el('div', { class: 'card pad', id: 'kho-low' }, el('h2', {}, 'Vật tư cần nhập thêm'),
    el('ul', { class: 'stock-list' }, low.map((s) => {
      const unit = materialUnit(s.item_code, s.unit);
      const critical = s.qty <= 0;
      return el('li', { dataset: { item: s.item_code, level: critical ? 'critical' : 'low' } },
        el('div', {}, el('b', {}, materialName(s.item_code, s.item_name)),
          el('small', {}, `tồn ${s.qty} ${unit}${s.min_qty != null ? ` · ngưỡng ${s.min_qty}` : ''}`)),
        el('div', { class: 'low-act' },
          pill(critical ? 'late' : 'st-moi', critical ? 'Hết hàng' : 'Sắp hết', { dot: false }),
          el('button', { type: 'button', class: 'btn', onclick: () => onReceive(s) }, 'Nhập thêm')));
    })));
}

// ---------------------------------------------------------------- #/k

export async function list(ctx) {
  const statsBox = el('div', { class: 'stats' });
  const body = el('div', { id: 'staff-list' });
  let requests = [];
  let stock = [];
  let cat = null;
  const draw = (keep) => {
    const low = lowStock(stock);
    ctx.chrome({ navId: 'staff-tabs', active: tab, items: TILES.map(([key, label, iconName]) => ({ key, label, icon: iconName, onclick: () => { tab = key; draw(false); } })) });
    ctx.counts({ receive: requests.length, stock: 0, low: low.length, bell: requests.length });
    fill(statsBox, [['Cần nhập thêm', low.length], ['Mã vật tư', stock.length], ['Hết hàng', stock.filter((s) => s.qty === 0).length],
      ['Chưa rõ tồn', stock.filter((s) => s.qty == null).length]].map(([label, value]) => el('div', { class: 'card stat' }, el('span', {}, label), el('b', {}, String(value)))));
    if (tab === 'stock') {
      fill(body, pageHead('Tồn kho', 'Số lượng hiện có của từng vật tư.', { right: refreshButton(load, ctx) }),
        el('div', { class: 'updated', dataset: { updated: '' } }), stockList(stock));
      return;
    }
    if (tab === 'low') {
      const onReceive = (s) => { prefill = { item: s.item_code, qty: restockQty(s) }; tab = 'receive'; draw(false); };
      fill(body, pageHead('Cảnh báo tồn kho', 'Đỏ: hết hàng · Vàng: tồn bằng hoặc dưới ngưỡng riêng của vật tư. "Nhập thêm" điền sẵn số lượng để vượt ngưỡng.', { right: refreshButton(load, ctx) }),
        el('div', { class: 'updated', dataset: { updated: '' } }), lowList(low, onReceive));
      return;
    }
    const previous = keep && body.lastElementChild && body.lastElementChild.dataset.shown ? body.lastElementChild : null;
    const start = prefill || {};
    const onFill = (line) => { prefill = line; draw(false); const form = document.getElementById('kho-receive'); if (form) form.scrollIntoView({ block: 'start' }); };
    fill(body, pageHead('Nhập vật tư', 'Nhập kho: phản ánh đang chờ vật tư đó tự chạy tiếp, phòng ban được báo.', { right: refreshButton(load, ctx) }),
      el('div', { class: 'updated', dataset: { updated: '' } }),
      receiveForm(ctx, stock, { item: start.item, qty: start.qty, after: () => { prefill = null; return load(); } }),
      el('h2', { class: 'kho-sec', id: 'kho-requests' }, `Phiếu vật tư cần nhập (${requests.length})`),
      pagedList(requests, requestCard(cat, onFill), { empty: 'Không có phiếu vật tư nào đang chờ nhập.', keep: previous }));
  };
  const load = async () => {
    const [all, stockRows, catalogView] = await Promise.all([listMaterialRequests(), api('/mo/warehouse/stock'), loadCatalog().catch(() => null)]);
    if (!ctx.alive()) return;
    requests = all.filter((r) => !isSeedTicket(r.ticket_id));
    stock = stockRows;
    cat = catalogView;
    draw(true);
    ctx.updatedNow();
  };
  draw(false);
  ctx.screen.append(statsBox, body);
  await load();
  ctx.setLoader(load);
}

// ---------------------------------------------------------------- #/k/<id>

export async function detail(ctx) {
  let reload = async () => {};
  // after a receipt the ticket usually leaves WAITING_MATERIAL, so the warehouse may no longer see it: back to the list
  const afterReceive = () => reload().catch((err) => { if (err.kind === 'not_found') ctx.go('#/k'); else throw err; });
  await caseScreen(ctx, {
    back: '#/k',
    bind: (load) => { reload = load; },
    tiles: { items: TILES, active: 'receive', pick: (key) => { tab = key; } },
    draw: async (live, c, cat) => {
      const stock = await api('/mo/warehouse/stock');
      const onHand = Object.fromEntries(stock.map((s) => [s.item_code, s.qty]));
      // what the ticket still lacks, from the live stock (the line snapshot may be older)
      const shortages = c.material_lines.map((line) => {
        const have = onHand[line.item_code];
        return { line, have, missing: have == null ? null : Math.max(0, line.planned_qty - have) };
      });
      const first = shortages.find((s) => s.missing > 0);
      fill(live, el('section', { class: 'card pad detail' },
        caseHead(c, cat),
        el('div', { class: 'box', id: 'kho-needs' }, el('span', { class: 'cap' }, 'VẬT TƯ CẦN CHO PHẢN ÁNH NÀY'),
          shortages.length ? el('ul', { class: 'stock-list' }, shortages.map(({ line, have, missing }) => {
            const unit = materialUnit(line.item_code, line.unit);
            return el('li', {},
              el('div', {}, el('b', {}, materialName(line.item_code, line.item_name)),
                el('small', {}, `cần ${line.planned_qty} ${unit} · tồn ${have != null ? `${have} ${unit}` : 'không rõ'}`)),
              missing == null ? pill('st-moi', 'Tồn không rõ', { dot: false })
                : missing > 0 ? pill('late', `thiếu ${missing} ${unit}`, { dot: false }) : pill('st-dang_xu_ly', 'Đủ', { dot: false }));
          })) : emptyState('Không có vật tư dự kiến.')),
        receiveForm(ctx, stock, { item: first ? first.line.item_code : '', qty: first ? first.missing : 1, after: afterReceive }),
        reportBox(c),
        eventsHistory(c, cat)));
    },
  });
}
