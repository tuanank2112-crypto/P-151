// Warehouse screens (Kho vật tư) — plan 11 SPEC-P05 §4. Same endpoints as renderWarehouse in src/web/app.js.
import { api } from './api.js?v=17';
import { el, emptyState, field, fill, pageHead, pagedList, pill, refreshButton, toast, writeButton } from './ui.js?v=17';
import {
  caseHead, caseScreen, codeOf, eventsHistory, isSeedTicket, loadCatalog, materialName, materialUnit, reportBox, select,
  summaryCard, webButton,
} from './staff.js?v=17';

// Q37: "Nhập vật tư" replaces "Chờ vật tư" (receipt form + the tickets it unblocks); "Cảnh báo" = stock under the threshold
const TILES = [['receive', 'Nhập vật tư', 'box'], ['stock', 'Tồn kho', 'grid'], ['low', 'Cảnh báo', 'warning']];
/** Warning bands (Q37, same unit for every item): qty < LOW_STOCK ⇒ "Sắp hết", qty < CRITICAL_STOCK ⇒ "Rất thấp". Unknown qty is not warned. */
export const LOW_STOCK = 30;
export const CRITICAL_STOCK = 20;
let tab = 'receive';
/** Item + qty the "Nhập vật tư" form starts with after "Nhập thêm" on a warning row. */
let prefill = null;
/** The header bell opens "Nhập vật tư" (the tickets waiting for material are listed there). */
export function focusQueue() { tab = 'receive'; }

/** Stock rows under LOW_STOCK, lowest first. */
export function lowStock(stock) {
  return stock.filter((s) => s.qty != null && s.qty < LOW_STOCK).sort((a, b) => a.qty - b.qty);
}

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

function stockList(stock) {
  return el('div', { class: 'card pad', id: 'kho-stock' }, el('h2', {}, 'Tồn kho hiện tại'),
    el('ul', { class: 'stock-list' }, stock.map((s) => el('li', { dataset: { item: s.item_code } },
      el('div', {}, el('b', {}, materialName(s.item_code, s.item_name)), el('small', {}, s.item_code)),
      el('span', { class: 'qty' }, s.qty == null ? 'Chưa rõ' : `${s.qty} ${materialUnit(s.item_code, s.unit)}`)))));
}

function lowList(low, onReceive) {
  if (!low.length) return emptyState(`Không có vật tư nào dưới ${LOW_STOCK}.`);
  return el('div', { class: 'card pad', id: 'kho-low' }, el('h2', {}, `Vật tư dưới ngưỡng ${CRITICAL_STOCK}–${LOW_STOCK}`),
    el('ul', { class: 'stock-list' }, low.map((s) => {
      const unit = materialUnit(s.item_code, s.unit);
      const critical = s.qty < CRITICAL_STOCK;
      return el('li', { dataset: { item: s.item_code, level: critical ? 'critical' : 'low' } },
        el('div', {}, el('b', {}, materialName(s.item_code, s.item_name)),
          el('small', {}, `tồn ${s.qty} ${unit} · cần thêm ${LOW_STOCK - s.qty} để đạt ${LOW_STOCK}`)),
        el('div', { class: 'low-act' },
          pill(critical ? 'late' : 'st-moi', s.qty === 0 ? 'Hết hàng' : critical ? `Dưới ${CRITICAL_STOCK}` : `Dưới ${LOW_STOCK}`, { dot: false }),
          el('button', { type: 'button', class: 'btn', onclick: () => onReceive(s) }, 'Nhập thêm')));
    })));
}

// ---------------------------------------------------------------- #/k

export async function list(ctx) {
  const statsBox = el('div', { class: 'stats' });
  const body = el('div', { id: 'staff-list' });
  let rows = [];
  let stock = [];
  let cat = null;
  const draw = (keep) => {
    const low = lowStock(stock);
    ctx.chrome({ navId: 'staff-tabs', active: tab, items: TILES.map(([key, label, iconName]) => ({ key, label, icon: iconName, onclick: () => { tab = key; draw(false); } })) });
    ctx.counts({ receive: rows.length, stock: 0, low: low.length, bell: rows.length });
    fill(statsBox, [['Dưới ngưỡng', low.length], ['Mã vật tư', stock.length], ['Hết hàng', stock.filter((s) => s.qty === 0).length],
      ['Chưa rõ tồn', stock.filter((s) => s.qty == null).length]].map(([label, value]) => el('div', { class: 'card stat' }, el('span', {}, label), el('b', {}, String(value)))));
    if (tab === 'stock') {
      fill(body, pageHead('Tồn kho', 'Số lượng hiện có của từng vật tư.', { right: refreshButton(load, ctx) }),
        el('div', { class: 'updated', dataset: { updated: '' } }), stockList(stock));
      return;
    }
    if (tab === 'low') {
      const onReceive = (s) => { prefill = { item: s.item_code, qty: LOW_STOCK - s.qty }; tab = 'receive'; draw(false); };
      fill(body, pageHead('Cảnh báo tồn kho', `Đỏ: dưới ${CRITICAL_STOCK} · Vàng: dưới ${LOW_STOCK}. "Nhập thêm" điền sẵn số lượng để đạt ${LOW_STOCK}.`, { right: refreshButton(load, ctx) }),
        el('div', { class: 'updated', dataset: { updated: '' } }), lowList(low, onReceive));
      return;
    }
    const previous = keep && body.lastElementChild && body.lastElementChild.dataset.shown ? body.lastElementChild : null;
    const start = prefill || {};
    fill(body, pageHead('Nhập vật tư', 'Nhập kho: phản ánh đang chờ vật tư đó tự chạy tiếp.', { right: refreshButton(load, ctx) }),
      el('div', { class: 'updated', dataset: { updated: '' } }),
      receiveForm(ctx, stock, { item: start.item, qty: start.qty, after: () => { prefill = null; return load(); } }),
      el('h2', { class: 'kho-sec' }, `Phản ánh chờ vật tư (${rows.length})`),
      pagedList(rows, summaryCard(cat, '#/k'), { empty: 'Không có phản ánh nào chờ vật tư.', keep: previous }));
  };
  const load = async () => {
    const [all, stockRows, catalogView] = await Promise.all([api('/mo/tickets'), api('/mo/warehouse/stock'), loadCatalog().catch(() => null)]);
    if (!ctx.alive()) return;
    rows = all.filter((r) => !isSeedTicket(r.ticket_id));
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
        eventsHistory(c, cat),
        webButton()));
    },
  });
}
