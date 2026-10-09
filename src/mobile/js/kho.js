// Warehouse screens (Kho vật tư) — plan 11 SPEC-P05 §4. Same endpoints as renderWarehouse in src/web/app.js.
import { api } from './api.js?v=3';
import { el, emptyState, field, fill, pageHead, pagedList, pill, refreshButton, toast, writeButton } from './ui.js?v=3';
import {
  caseHead, caseScreen, codeOf, eventsHistory, isSeedTicket, loadCatalog, materialName, materialUnit, reportBox, select,
  summaryCard, webButton,
} from './staff.js?v=3';

const TILES = [['wait', 'Chờ vật tư', 'box'], ['stock', 'Tồn kho', 'grid']];
let tab = 'wait';
/** The header bell opens "Chờ vật tư". */
export function focusQueue() { tab = 'wait'; }

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

// ---------------------------------------------------------------- #/k

export async function list(ctx) {
  const statsBox = el('div', { class: 'stats' });
  const body = el('div', { id: 'staff-list' });
  let rows = [];
  let stock = [];
  let cat = null;
  const draw = (keep) => {
    ctx.chrome({ navId: 'staff-tabs', active: tab, items: TILES.map(([key, label, iconName]) => ({ key, label, icon: iconName, onclick: () => { tab = key; draw(false); } })) });
    ctx.counts({ wait: rows.length, stock: 0, bell: rows.length });
    fill(statsBox, [['Chờ vật tư', rows.length], ['Mã vật tư', stock.length], ['Hết hàng', stock.filter((s) => s.qty === 0).length],
      ['Chưa rõ tồn', stock.filter((s) => s.qty == null).length]].map(([label, value]) => el('div', { class: 'card stat' }, el('span', {}, label), el('b', {}, String(value)))));
    if (tab === 'stock') {
      fill(body, pageHead('Tồn kho', 'Nhập kho: ticket đang chờ vật tư đó tự chạy tiếp.', { right: refreshButton(load, ctx) }),
        el('div', { class: 'updated', dataset: { updated: '' } }), receiveForm(ctx, stock, { after: load }), stockList(stock));
      return;
    }
    const previous = keep && body.lastElementChild && body.lastElementChild.dataset.shown ? body.lastElementChild : null;
    fill(body, pageHead('Phản ánh chờ vật tư', 'Mở ticket để xem vật tư còn thiếu và nhập kho.', { right: refreshButton(load, ctx) }),
      el('div', { class: 'updated', dataset: { updated: '' } }),
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
    tiles: { items: TILES, active: 'wait', pick: (key) => { tab = key; } },
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
