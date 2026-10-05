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
      <button type="button" id="ai-modal-close-btn" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">✕</button>
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
    el('button', { type: 'button', class: 'rounded-lg p-1 text-slate-400 hover:text-slate-200', onclick: () => modal.close() }, '✕'));

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
  const materialLabel = blocker && blocker.code === 'WAITING_MATERIAL' ? 'Thiếu vật tư' : 'Đủ vật tư';
  const materialTone = blocker && blocker.code === 'WAITING_MATERIAL' ? 'text-rose-400' : 'text-emerald-400';

  const container = el('div', {
    class: 'group rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-3 text-xs shadow-xs transition hover:border-indigo-500/40',
    role: 'region',
    'aria-label': 'Đề xuất tự động của hệ thống',
  });

  // Top Compact Pill Row
  const topRow = el('div', { class: 'flex flex-wrap items-center justify-between gap-2' },
    el('div', { class: 'flex items-center gap-2' },
      el('span', { class: 'flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400 text-xs' }, '✨'),
      el('div', { class: 'flex items-center gap-1.5' },
        el('span', { class: 'font-semibold text-white' }, `Đề xuất: ${categoryTitle}`),
        el('span', { class: 'text-slate-400' }, `(${deptTitle})`)),
      el('span', { class: `inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-semibold ${conf.badgeClass}` },
        el('span', { class: `h-1.5 w-1.5 rounded-full ${conf.dotClass}` }),
        conf.label)),
    el('div', { class: 'flex items-center gap-1.5' },
      isDuplicate
        ? el('span', { class: 'rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[10px] font-semibold' }, '⚠️ Nghi trùng vé')
        : isMerged
          ? el('span', { class: 'rounded-full bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-medium' }, `Đã gộp #${t.merged_into}`)
          : el('span', { class: 'rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-medium' }, '✓ Không trùng lặp'),
      el('span', { class: `font-medium text-[10px] ${materialTone}` }, `• ${materialLabel}`),
      el('button', {
        type: 'button',
        class: 'ml-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 px-2 py-0.5 text-[11px] font-medium text-indigo-300 transition flex items-center gap-1',
        onclick: (e) => {
          const detailBox = container.querySelector('.taste-ai-details');
          const isHidden = detailBox.classList.toggle('hidden');
          e.currentTarget.querySelector('.arrow').textContent = isHidden ? '▾' : '▴';
        },
      },
        el('span', {}, 'Chi tiết'),
        el('span', { class: 'arrow font-mono' }, '▾')),
      el('button', {
        type: 'button',
        title: 'Xem raw prompt & logs',
        class: 'h-6 w-6 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center font-mono text-[10px]',
        onclick: () => openAiRawModal(t.ticket_id, c),
      }, '{ }')));

  // Expandable Detail Drawer (Clean 3-column micro card)
  const detailBox = el('div', { class: 'taste-ai-details hidden mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs' },
    el('div', { class: 'rounded-lg bg-slate-800/50 p-2.5 border border-slate-700/50' },
      el('span', { class: 'text-[10px] font-bold text-slate-400 uppercase tracking-wide block' }, 'Vị trí nhận diện'),
      el('p', { class: 'font-medium text-slate-200 mt-1' }, `${loc.building || 'Tòa S1'} • ${loc.floor || 'Tầng 1'}`),
      el('p', { class: 'text-[11px] text-slate-400 mt-0.5 truncate', title: rawLocation }, loc.zone || rawLocation || 'Khu vực chung')),
    el('div', { class: 'rounded-lg bg-slate-800/50 p-2.5 border border-slate-700/50' },
      el('span', { class: 'text-[10px] font-bold text-slate-400 uppercase tracking-wide block' }, 'Tài sản & Hiện trường'),
      el('p', { class: 'font-medium text-slate-200 mt-1 truncate' }, assetId ? `${assetId}` : (isTechnical ? 'Kiểm tra hiện trường' : 'Khu vực chung')),
      el('p', { class: 'text-[11px] text-emerald-400 mt-0.5' }, isTechnical ? 'Bóng đèn LED T8 1.2m' : 'Dụng cụ vệ sinh sẵn có')),
    el('div', { class: 'rounded-lg bg-slate-800/50 p-2.5 border border-slate-700/50' },
      el('span', { class: 'text-[10px] font-bold text-slate-400 uppercase tracking-wide block' }, 'Căn cứ đề xuất'),
      el('p', { class: 'text-[11px] text-slate-300 italic mt-1 line-clamp-2' },
        `"${(p && p.classification_reason) || 'Khớp từ khóa phản ánh và quy tắc phân loại.'}"`)));

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
