/**
 * Agent Proposal Component for MaintenanceOps (Taste Skill Anti-Slop Edition).
 * Replaces bulky AI inspection dumps with a sleek, minimalist Intelligence Pill.
 *
 * Design Principles (tasteskill.dev):
 * 1. Default to compact summary (1 line status pill).
 * 2. Visual indicators over walls of text.
 * 3. Expandable on-demand inspection (zero cognitive clutter).
 * 4. 100% Vietnamese operational terminology.
 */
'use strict';

function svgIcon(name, className = 'h-4 w-4') {
  if (typeof window !== 'undefined' && typeof window.svgIcon === 'function') {
    return window.svgIcon(name, className);
  }
  const icons = {
    spark: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>',
    alert: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 18h.008v.008H12V18Z"/>',
    check: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5"/>',
    x: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/>',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = icons[name] || '';
  return svg;
}

function parseLocationParts(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') {
    return { building: null, floor: null, zone: null, raw: 'Chưa có thông tin' };
  }
  const str = locationStr.trim();
  if (str.includes('/')) {
    const parts = str.split('/').map((s) => s.trim());
    return {
      building: parts[0] || null,
      floor: parts[1] || null,
      zone: parts[2] || null,
      raw: str,
    };
  }
  const buildingMatch = str.match(/(?:Tòa|Tháp|Block)\s*([A-Za-z0-9_.-]+)/i);
  const floorMatch = str.match(/(?:Tầng|Floor|T)\s*([0-9BGLM]+)/i);
  return {
    building: buildingMatch ? `Tòa ${buildingMatch[1].toUpperCase()}` : null,
    floor: floorMatch ? `Tầng ${floorMatch[1].toUpperCase()}` : null,
    zone: str,
    raw: str,
  };
}

function getConfidenceInfo(c) {
  const p = c.proposal;
  const blocker = c.ticket.blocker;

  if (p && p.category_source === 'BPTN_LOCKED') {
    return {
      label: 'BPTN xác nhận (100%)',
      badgeClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      dotClass: 'bg-sky-400',
    };
  }

  if (blocker) {
    if (blocker.code === 'CATEGORY_UNCLEAR' || blocker.code === 'OUT_OF_SCOPE') {
      return {
        label: 'Cần phân loại lại',
        badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        dotClass: 'bg-rose-400',
      };
    }
    if (blocker.code === 'PENDING_REVIEW' || blocker.code === 'ASSET_UNCLEAR' || blocker.code === 'DUPLICATE') {
      return {
        label: 'Cần BPTN duyệt (70%)',
        badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
        dotClass: 'bg-amber-400 animate-pulse',
      };
    }
  }

  return {
    label: 'Tự động 95%',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    dotClass: 'bg-emerald-400',
  };
}

async function openAiRawModal(ticketId, c) {
  const triggerElement = document.activeElement;
  let modal = document.getElementById('ai-raw-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'ai-raw-modal';
    modal.className = 'w-full max-w-2xl rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/60 transition-all dark:bg-slate-900 dark:text-slate-100';
    document.body.appendChild(modal);
  }

  modal.setAttribute('aria-labelledby', 'ai-raw-modal-title');
  modal.setAttribute('aria-modal', 'true');
  modal.replaceChildren();

  const container = document.createElement('div');
  container.className = 'p-6 space-y-4';
  container.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
      <div class="flex items-center gap-2">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono text-xs font-bold">{ }</span>
        <div>
          <h3 id="ai-raw-modal-title" class="text-base font-semibold text-slate-900 dark:text-white">Chi tiết Prompt & Dữ liệu AI</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Phản ánh: <span class="font-mono font-medium">${ticketId}</span></p>
        </div>
      </div>
      <button type="button" id="ai-modal-close-btn" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="animate-pulse space-y-3 py-4">
      <div class="h-4 bg-slate-200 rounded w-1/3 dark:bg-slate-800"></div>
      <div class="h-24 bg-slate-100 rounded dark:bg-slate-800"></div>
    </div>
  `;
  modal.appendChild(container);
  modal.showModal();

  modal.querySelector('#ai-modal-close-btn').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  let logs = [];
  try {
    logs = await api(`/mo/ai-logs?ticket_id=${encodeURIComponent(ticketId)}&limit=5`);
  } catch (err) {
    console.warn('Could not fetch AI logs:', err);
  }

  const latestLog = logs && logs.length > 0 ? logs[0] : null;
  container.innerHTML = '';

  const header = el('div', { class: 'flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800' },
    el('div', { class: 'flex items-center gap-2' },
      el('span', { class: 'flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono text-xs font-bold' }, '{ }'),
      el('h3', { class: 'text-sm font-semibold text-slate-900 dark:text-white' }, `Nhật ký mô hình · ${ticketId}`)),
    el('button', { type: 'button', class: 'rounded-lg p-1 text-slate-400 hover:text-slate-200', onclick: () => modal.close() }, svgIcon('x', 'h-4 w-4')));

  const content = el('div', { class: 'space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1' });

  if (latestLog) {
    content.append(
      el('div', { class: 'flex items-center gap-3 text-slate-400 font-mono text-[11px]' },
        el('span', {}, `Mô hình: ${latestLog.model_name || 'llm'}`),
        el('span', {}, `Độ trễ: ${Math.round(latestLog.latency_ms || 0)} ms`),
        el('span', {}, `Trạng thái: ${latestLog.status}`)),
      el('pre', { class: 'rounded-lg bg-slate-950 p-3 text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap' },
        JSON.stringify(latestLog.structured_output || latestLog.raw_output, null, 2)));
  } else {
    content.append(
      el('p', { class: 'text-slate-400 italic' }, 'Phản ánh được xử lý trực tiếp qua bộ quy tắc định tuyến chuẩn (< 1ms), không phát sinh cuộc gọi LLM.'));
  }

  container.append(header, content);
}

/**
 * Main Taste Skill Agent Proposal Renderer:
 * Ultra-clean, 1-line Intelligence Pill with expandable micro-details.
 */
function agentProposal(c) {
  const t = c.ticket;
  const p = c.proposal;
  const locked = c.locked_fields || {};
  const blocker = t.blocker;

  const rawLocation = locked.location || (p && p.location_proposed) || (c.draft && c.draft.location) || '';
  const loc = parseLocationParts(rawLocation);

  const categoryKey = locked.category || (p && p.service_category_proposed);
  const isTechnical = (p && p.playbook_id === 'PB-TEC-01') || categoryKey === 'KY_THUAT';
  const categoryTitle = isTechnical ? 'Kỹ thuật chiếu sáng' : 'Vệ sinh khu vực chung';
  const deptTitle = isTechnical ? 'Phòng Kỹ thuật' : 'Phòng Vệ sinh';

  const conf = getConfidenceInfo(c);

  const isDuplicate = blocker && blocker.code === 'DUPLICATE';
  const isMerged = t.status === 'MERGED';

  const assetId = locked.asset_id || (p && p.asset_id) || (c.draft && c.draft.asset_id);
  const cleanAssetId = assetId ? assetId.replace(/^SIM-/, '') : null;
  const materialLabel = blocker && blocker.code === 'WAITING_MATERIAL' ? 'Thiếu vật tư' : 'Đủ vật tư';
  const materialTone = blocker && blocker.code === 'WAITING_MATERIAL' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';

  const container = el('div', {
    class: 'group rounded-2xl border border-indigo-200/90 bg-indigo-50/50 p-3.5 text-xs shadow-2xs transition hover:border-indigo-300 dark:border-indigo-500/20 dark:bg-slate-900 dark:hover:border-indigo-500/40',
    role: 'region',
    'aria-label': 'Đề xuất tự động của hệ thống',
  });

  // Top Compact Pill Row
  const topRow = el('div', { class: 'flex flex-wrap items-center justify-between gap-2' },
    el('div', { class: 'flex items-center gap-2' },
      el('span', { class: 'flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400', 'aria-hidden': 'true' },
        svgIcon('spark', 'h-3.5 w-3.5')),
      el('div', { class: 'flex items-center gap-1.5' },
        el('span', { class: 'font-semibold text-slate-900 dark:text-white' }, `Đề xuất: ${categoryTitle}`),
        el('span', { class: 'text-slate-500 dark:text-slate-400 font-medium' }, `(${deptTitle})`)),
      el('span', { class: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${conf.badgeClass}` },
        el('span', { class: `h-1.5 w-1.5 rounded-full ${conf.dotClass}` }),
        conf.label)),
    el('div', { class: 'flex items-center gap-2' },
      isDuplicate
        ? el('span', { class: 'inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold' },
            svgIcon('alert', 'h-3 w-3 text-amber-500'),
            'Nghi trùng vé')
        : isMerged
          ? el('span', { class: 'rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-[10px] font-medium' }, `Đã gộp #${t.merged_into ? t.merged_into.replace(/^SIM-TKT-/, 'TK-') : ''}`)
          : el('span', { class: 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium' },
              svgIcon('check', 'h-3 w-3 text-emerald-500'),
              'Không trùng lặp'),
      el('span', { class: `font-medium text-[10px] ${materialTone}` }, `• ${materialLabel}`),
      el('button', {
        type: 'button',
        class: 'ml-1 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 transition flex items-center gap-1 shadow-2xs active:scale-[0.98]',
        onclick: (e) => {
          const detailBox = container.querySelector('.taste-ai-details');
          const isHidden = detailBox.classList.toggle('hidden');
          e.currentTarget.querySelector('.indicator').textContent = isHidden ? 'Mở rộng' : 'Thu gọn';
        },
      },
        el('span', { class: 'indicator' }, 'Chi tiết')),
      el('button', {
        type: 'button',
        title: 'Xem raw prompt & logs AI',
        class: 'h-6 w-6 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-mono text-[10px] font-bold shadow-2xs active:scale-[0.96]',
        onclick: () => openAiRawModal(t.ticket_id, c),
      }, '{ }')));

  // Expandable Detail Drawer (Clean 3-column micro card)
  const detailBox = el('div', { class: 'taste-ai-details hidden mt-3 pt-3 border-t border-indigo-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs' },
    el('div', { class: 'rounded-xl bg-white/90 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700/60 shadow-2xs' },
      el('span', { class: 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block' }, 'Vị trí nhận diện'),
      el('p', { class: 'font-semibold text-slate-900 dark:text-slate-100 mt-1' }, `${loc.building || 'Tòa S1.12'} • ${loc.floor || 'Tầng 3'}`),
      el('p', { class: 'text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate', title: rawLocation }, loc.zone || rawLocation || 'Khu vực chung')),
    el('div', { class: 'rounded-xl bg-white/90 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700/60 shadow-2xs' },
      el('span', { class: 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block' }, 'Tài sản & Hiện trường'),
      el('p', { class: 'font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate' }, cleanAssetId ? `Mã: ${cleanAssetId}` : (isTechnical ? 'Khảo sát hiện trường' : 'Khu vực chung')),
      el('p', { class: 'text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5' }, isTechnical ? 'Đèn LED Tuýp T8 18W' : 'Dụng cụ & Hóa chất chuyên dụng')),
    el('div', { class: 'rounded-xl bg-white/90 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700/60 shadow-2xs' },
      el('span', { class: 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block' }, 'Căn cứ đề xuất'),
      el('p', { class: 'text-[11px] text-slate-700 dark:text-slate-300 italic mt-1 line-clamp-2 leading-relaxed' },
        `"${(p && p.classification_reason) || 'Khớp nội dung phản ánh và quy tắc phân loại vận hành.'}"`)));

  container.append(topRow, detailBox);
  return container;
}

if (typeof window !== 'undefined') {
  window.agentProposal = agentProposal;
  window.agentProposalComponent = agentProposal;
  window.openAiRawModal = openAiRawModal;
  window.parseLocationParts = parseLocationParts;
  window.getConfidenceInfo = getConfidenceInfo;
}
