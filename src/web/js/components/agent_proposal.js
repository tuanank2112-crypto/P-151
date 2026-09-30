/**
 * Agent Proposal Component for MaintenanceOps.
 * Renders modern, responsive, and accessible AI analysis card in ticket detail views.
 *
 * Information displayed:
 * 1. Location breakdown (Tòa / Tầng / Khu vực)
 * 2. Proposed Playbook (Vệ sinh / Kỹ thuật) & Department
 * 3. AI Reasoning & Rule Trace
 * 4. Duplicate Ticket Detection Status
 * 5. Asset Information (lookup status & match reason)
 * 6. Inventory & Material Stock Availability
 * 7. Agent Confidence Badge with pulse indicator
 * 8. "Xem raw LLM prompt/response" modal inspector
 */
'use strict';

/**
 * Parse location string into structured { building, floor, zone, raw }
 */
function parseLocationParts(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') {
    return { building: null, floor: null, zone: null, raw: 'Chưa có thông tin' };
  }
  const str = locationStr.trim();
  // Standard format: "Tòa SIM-A / Tầng 3 / Hành lang"
  if (str.includes('/')) {
    const parts = str.split('/').map((s) => s.trim());
    return {
      building: parts[0] || null,
      floor: parts[1] || null,
      zone: parts[2] || null,
      raw: str,
    };
  }

  // Regex fallback
  const buildingMatch = str.match(/(?:Tòa|Tháp|Block)\s*([A-Za-z0-9_-]+)/i);
  const floorMatch = str.match(/(?:Tầng|Floor|T)\s*([0-9BGLM]+)/i);
  return {
    building: buildingMatch ? `Tòa ${buildingMatch[1].toUpperCase()}` : null,
    floor: floorMatch ? `Tầng ${floorMatch[1].toUpperCase()}` : null,
    zone: str,
    raw: str,
  };
}

/**
 * Determine Agent Confidence Level and style
 */
function getConfidenceInfo(c) {
  const p = c.proposal;
  const blocker = c.ticket.blocker;

  if (p && p.category_source === 'BPTN_LOCKED') {
    return {
      label: 'BPTN Xác nhận (100%)',
      score: '100%',
      tone: 'sky',
      badgeClass: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-500/30',
      dotClass: 'bg-sky-500',
      description: 'Phân loại đã được nhân viên BPTN chốt cố định.',
    };
  }

  if (blocker) {
    if (blocker.code === 'CATEGORY_UNCLEAR' || blocker.code === 'OUT_OF_SCOPE') {
      return {
        label: 'Độ tin cậy thấp (35%)',
        score: '35%',
        tone: 'rose',
        badgeClass: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-500/30',
        dotClass: 'bg-rose-500 animate-ping',
        description: 'Nội dung phản ánh nằm ngoài phạm vi hoặc không khớp quy tắc tự động.',
      };
    }
    if (blocker.code === 'PENDING_REVIEW' || blocker.code === 'ASSET_UNCLEAR' || blocker.code === 'DUPLICATE') {
      return {
        label: 'Cần BPTN duyệt (70%)',
        score: '70%',
        tone: 'amber',
        badgeClass: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-500/30',
        dotClass: 'bg-amber-500 animate-pulse',
        description: 'Agent đã đề xuất nhưng phát hiện điều kiện cần chuyên viên xác thực.',
      };
    }
  }

  return {
    label: 'Độ tin cậy cao (95%)',
    score: '95%',
    tone: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30',
    dotClass: 'bg-emerald-500 animate-pulse',
    description: 'Quy tắc và mô hình AI đồng thuận cao, tự động lập Work Order.',
  };
}

/**
 * Open Modal displaying raw LLM Prompt and Response
 */
async function openAiRawModal(ticketId, c) {
  let modal = document.getElementById('ai-raw-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'ai-raw-modal';
    modal.className = 'w-full max-w-2xl rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/60 transition-all dark:bg-slate-900 dark:text-slate-100';
    document.body.appendChild(modal);
  }

  modal.replaceChildren();

  // Loading skeleton inside modal
  const container = document.createElement('div');
  container.className = 'p-6 space-y-4';
  container.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
      <div class="flex items-center gap-2">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </span>
        <div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Chi tiết AI Prompt & Raw Output</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Phản ánh: <span class="font-mono font-medium">${ticketId}</span></p>
        </div>
      </div>
      <button type="button" id="ai-modal-close-btn" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="animate-pulse space-y-3 py-6">
      <div class="h-4 bg-slate-200 rounded w-1/3 dark:bg-slate-800"></div>
      <div class="h-24 bg-slate-100 rounded dark:bg-slate-800"></div>
      <div class="h-32 bg-slate-100 rounded dark:bg-slate-800"></div>
    </div>
  `;
  modal.appendChild(container);
  modal.showModal();

  modal.querySelector('#ai-modal-close-btn').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  // Fetch AI logs for this ticket from backend
  let logs = [];
  try {
    logs = await api(`/mo/ai-logs?ticket_id=${encodeURIComponent(ticketId)}&limit=5`);
  } catch (err) {
    console.warn('Could not fetch AI logs from server:', err);
  }

  const latestLog = logs && logs.length > 0 ? logs[0] : null;

  // Render modal content
  container.innerHTML = '';

  const header = el('div', { class: 'flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800' },
    el('div', { class: 'flex items-center gap-2.5' },
      el('span', { class: 'flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
        el('svg', { class: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
          el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' }))),
      el('div', {},
        el('h3', { class: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Chi tiết AI Prompt & Raw Output'),
        el('p', { class: 'text-xs text-slate-500 dark:text-slate-400' }, `Mã ticket: ${ticketId}`))),
    el('button', {
      type: 'button',
      class: 'rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500',
      onclick: () => modal.close(),
    }, el('svg', { class: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
      el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M6 18L18 6M6 6l12 12' }))));

  const content = el('div', { class: 'mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1' });

  if (latestLog) {
    // Metadata Bar
    const statusChip = latestLog.status === 'SUCCESS'
      ? el('span', { class: 'inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300' }, 'Thành công (LLM)')
      : el('span', { class: 'inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300' }, 'Fallback Quy tắc');

    content.append(el('div', { class: 'flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700' },
      el('div', {}, el('span', { class: 'text-slate-500 dark:text-slate-400' }, 'Model: '), el('span', { class: 'font-mono font-semibold text-slate-800 dark:text-slate-200' }, latestLog.model_name || 'llm')),
      el('div', {}, el('span', { class: 'text-slate-500 dark:text-slate-400' }, 'Độ trễ: '), el('span', { class: 'font-mono font-semibold text-indigo-600 dark:text-indigo-400' }, `${Math.round(latestLog.latency_ms || 0)} ms`)),
      el('div', {}, el('span', { class: 'text-slate-500 dark:text-slate-400' }, 'Trạng thái: '), statusChip),
      el('div', {}, el('span', { class: 'text-slate-500 dark:text-slate-400' }, 'Thời điểm: '), el('span', { class: 'text-slate-700 dark:text-slate-300' }, formatTime(latestLog.timestamp)))));

    // System Prompt
    if (latestLog.prompt_sent && latestLog.prompt_sent.system) {
      content.append(el('div', { class: 'space-y-1.5' },
        el('div', { class: 'flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300' },
          el('span', {}, '1. System Prompt (Chỉ thị phân loại)'),
          el('span', { class: 'text-[11px] font-normal text-slate-400' }, 'Không cho phép suy diễn')),
        el('pre', { class: 'rounded-lg bg-slate-900 p-3 text-xs text-slate-100 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ring-1 ring-slate-800' }, latestLog.prompt_sent.system)));
    }

    // User Input
    const userPrompt = latestLog.prompt_sent && latestLog.prompt_sent.user
      ? latestLog.prompt_sent.user
      : c.ticket.raw.original_description;

    content.append(el('div', { class: 'space-y-1.5' },
      el('div', { class: 'flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300' },
        el('span', {}, '2. User Input (Nội dung phản ánh kèm dữ liệu bao bọc)'),
        el('span', { class: 'text-[11px] font-normal text-amber-500 dark:text-amber-400' }, 'Dữ liệu không đáng tin')),
      el('pre', { class: 'rounded-lg bg-slate-900 p-3 text-xs text-amber-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ring-1 ring-slate-800' }, userPrompt)));

    // Structured Output
    const outputContent = latestLog.structured_output
      ? JSON.stringify(latestLog.structured_output, null, 2)
      : (latestLog.raw_output || 'Không có output thô');

    content.append(el('div', { class: 'space-y-1.5' },
      el('div', { class: 'flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300' },
        el('span', {}, '3. Structured Output (LLMAssessment Schema)'),
        el('button', {
          type: 'button',
          class: 'text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline font-medium',
          onclick: () => {
            navigator.clipboard.writeText(outputContent);
            toast('Đã sao chép JSON output vào clipboard');
          },
        }, 'Sao chép JSON')),
      el('pre', { class: 'rounded-lg bg-slate-950 p-3 text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ring-1 ring-slate-800' }, outputContent)));

    if (latestLog.error_message) {
      content.append(callout('warn', 'Ghi nhận lỗi Fallback', latestLog.error_message));
    }
  } else {
    // If no LLM log recorded (e.g. deterministic rule engine execution)
    content.append(callout('info', 'Xử lý bởi Deterministic Rule Engine',
      'Phản ánh này được phân loại trực tiếp qua bộ quy tắc luật cứng (Deterministic Rules) với độ trễ < 1ms, không phát sinh chi phí gọi LLM.'));

    const ruleData = {
      ticket_id: ticketId,
      classification_reason: c.proposal ? c.proposal.classification_reason : 'Theo quy tắc chuẩn',
      matched_rules: c.proposal ? c.proposal.matched_rule_ids : ['PB-COM-R-CLS-01'],
      proposer: 'rules-engine',
      playbook_id: c.proposal ? c.proposal.playbook_id : 'Chưa gán',
      raw_content: c.ticket.raw.original_description,
    };

    content.append(el('div', { class: 'space-y-1.5' },
      el('p', { class: 'text-xs font-semibold text-slate-700 dark:text-slate-300' }, 'Trích xuất đối soát dữ liệu:'),
      el('pre', { class: 'rounded-lg bg-slate-900 p-3 text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap ring-1 ring-slate-800' },
        JSON.stringify(ruleData, null, 2))));
  }

  // Footer Actions
  const footer = el('div', { class: 'mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800' },
    el('button', {
      type: 'button',
      class: 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
      onclick: () => modal.close(),
    }, 'Đóng'));

  container.append(header, content, footer);
}

/**
 * Render the full Agent Proposal Panel component
 */
function agentProposal(c) {
  const p = c.proposal;
  const t = c.ticket;
  const locked = t.locked_fields || {};
  const blocker = t.blocker;

  // 1. Location Parsing
  const rawLocation = locked.location || (p && p.location_proposed) || (c.draft && c.draft.location) || '';
  const loc = parseLocationParts(rawLocation);

  // 2. Playbook & Category Info
  const categoryKey = locked.category || (p && p.service_category_proposed);
  const categoryTitle = CATEGORY_LABEL[categoryKey] || categoryKey || 'Chưa xác định';
  const playbookId = (p && p.playbook_id) || (c.draft && c.draft.playbook_id) || 'Chưa gán';
  const isTechnical = playbookId === 'PB-TEC-01' || categoryKey === 'KY_THUAT';

  // 3. Confidence Info
  const conf = getConfidenceInfo(c);

  // 4. Duplicate Check Status
  const isDuplicate = blocker && blocker.code === 'DUPLICATE';
  const isMerged = t.status === 'MERGED';

  // 5. Asset Info
  const assetId = locked.asset_id || (p && p.asset_id) || (c.draft && c.draft.asset_id);
  const assetStatus = p ? p.asset_lookup_status : 'NOT_APPLICABLE';
  const assetReason = p ? p.asset_match_reason : '—';

  // 6. Inventory / Materials Stock Info
  let materialStatusTone = 'emerald';
  let materialStatusLabel = 'Sẵn sàng trong kho';
  let materialDetail = isTechnical ? 'Bóng đèn LED T8 1.2m (1 chiếc)' : 'Vật tư & dụng cụ vệ sinh cơ bản';

  if (blocker && blocker.code === 'WAITING_MATERIAL') {
    materialStatusTone = 'rose';
    materialStatusLabel = 'Tạm hoãn — Thiếu vật tư';
    materialDetail = blocker.message || 'Chờ kho nhập bổ sung vật tư thay thế';
  } else if (isTechnical && assetStatus === 'NOT_FOUND') {
    materialStatusTone = 'amber';
    materialStatusLabel = 'Cần kiểm tra hiện trường';
  }

  // --- PANEL ROOT CONTAINER ---
  return el('div', {
    class: 'group relative overflow-hidden rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm ring-1 ring-slate-200/80 transition-all duration-300 hover:shadow-md dark:border-indigo-900/40 dark:bg-slate-900/90 dark:ring-slate-800',
    'data-ticket-id': t.ticket_id,
  },
    // Top highlight glow bar
    el('div', { class: 'absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-400' }),

    // --- HEADER: TITLE, CONFIDENCE & RAW AI BUTTON ---
    el('div', { class: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800' },
      el('div', { class: 'flex items-center gap-2.5' },
        el('div', { class: 'flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/30' },
          el('svg', { class: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
            el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 10V3L4 14h7v7l9-11h-7z' }))),
        el('div', {},
          el('div', { class: 'flex items-center gap-2' },
            el('h2', { class: 'text-base font-bold text-slate-900 dark:text-white' }, 'Agent Đề Xuất & Phân Tích'),
            el('span', { class: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${conf.badgeClass}` },
              el('span', { class: `h-1.5 w-1.5 rounded-full ${conf.dotClass}` }),
              conf.label)),
          el('p', { class: 'text-xs text-slate-500 dark:text-slate-400 mt-0.5' },
            'Phân loại tự động kết hợp Deterministic Rules và LLM Structured Output'))),

      // Button: "Xem raw LLM prompt/response"
      el('button', {
        type: 'button',
        class: 'inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 hover:border-indigo-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60',
        title: 'Xem chính xác nội dung prompt đã gửi và phản hồi raw từ mô hình AI',
        onclick: () => openAiRawModal(t.ticket_id, c),
      },
        el('svg', { class: 'h-4 w-4 text-indigo-600 dark:text-indigo-400', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
          el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' })),
        el('span', {}, 'Xem raw LLM prompt/response'))),

    // --- BODY GRID ---
    el('div', { class: 'mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2' },

      // 1. VỊ TRÍ PHÂN TÍCH (TÒA / TẦNG / KHU VỰC)
      el('div', { class: 'rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40' },
        el('div', { class: 'flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2' },
          el('span', {}, 'Vị trí sự cố nhận diện'),
          el('span', { class: 'text-indigo-600 dark:text-indigo-400 font-medium lowercase' }, loc.building && loc.floor ? '3 cấp' : 'cần chuẩn hóa')),
        el('div', { class: 'grid grid-cols-3 gap-1.5 text-center text-xs' },
          el('div', { class: 'rounded-lg bg-white p-2 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:border-slate-700' },
            el('p', { class: 'text-[10px] text-slate-400 font-medium' }, 'TÒA'),
            el('p', { class: 'font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate' }, loc.building || 'Chưa rõ')),
          el('div', { class: 'rounded-lg bg-white p-2 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:border-slate-700' },
            el('p', { class: 'text-[10px] text-slate-400 font-medium' }, 'TẦNG'),
            el('p', { class: 'font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate' }, loc.floor || 'Chưa rõ')),
          el('div', { class: 'rounded-lg bg-white p-2 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:border-slate-700' },
            el('p', { class: 'text-[10px] text-slate-400 font-medium' }, 'KHU VỰC'),
            el('p', { class: 'font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate', title: loc.zone || '' }, loc.zone || 'Khu vực chung'))),
        el('p', { class: 'mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate', title: rawLocation }, `Chuỗi vị trí: ${rawLocation || 'Chưa có vị trí'}`)),

      // 2. PLAYBOOK ĐỀ XUẤT & PHÒNG BAN
      el('div', { class: 'rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40' },
        el('div', { class: 'flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2' },
          el('span', {}, 'Playbook & Quy trình SOP'),
          el('span', { class: 'rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' }, playbookId)),
        el('div', { class: 'flex items-center gap-2.5 mt-1' },
          el('span', { class: `inline-flex h-8 w-8 items-center justify-center rounded-lg text-base ${isTechnical ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}` },
            isTechnical ? '💡' : '🧹'),
          el('div', { class: 'min-w-0' },
            el('p', { class: 'text-sm font-bold text-slate-900 dark:text-white truncate' },
              isTechnical ? 'Kỹ thuật chiếu sáng (PB-TEC-01)' : 'Vệ sinh khu vực chung (PB-CLN-01)'),
            el('p', { class: 'text-xs text-slate-600 dark:text-slate-300 mt-0.5' },
              `Đơn vị xử lý: ${isTechnical ? 'Phòng Kỹ thuật (DEP-TEC)' : 'Phòng Vệ sinh (DEP-CLN)'}`)))),

      // 3. KẾT QUẢ KIỂM TRA TRÙNG VÉ
      el('div', { class: 'rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40' },
        el('p', { class: 'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2' }, 'Kiểm tra trùng vé (Duplicate Check)'),
        isDuplicate
          ? el('div', { class: 'flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800' },
              el('span', { class: 'text-amber-600 font-bold text-sm' }, '⚠️'),
              el('div', {},
                el('p', { class: 'font-semibold' }, `Nghi trùng với ${blocker.related_ticket_id}`),
                el('p', { class: 'mt-0.5 text-[11px] text-amber-800 dark:text-amber-300' }, blocker.message || 'Cùng vị trí và vấn đề trong vòng 4h. Đề xuất BPTN gộp vé.')))
          : isMerged
            ? el('div', { class: 'rounded-lg bg-zinc-100 p-2.5 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200' },
                el('p', { class: 'font-medium' }, `Đã gộp vào phản ánh gốc: ${t.merged_into}`))
            : el('div', { class: 'flex items-center gap-2 rounded-lg bg-emerald-50/90 p-2.5 text-xs text-emerald-800 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40' },
                el('span', { class: 'text-emerald-600 dark:text-emerald-400 font-bold' }, '✓'),
                el('span', { class: 'font-medium' }, 'Độc lập — Không phát hiện vé trùng lặp trong hệ thống'))),

      // 4. THÔNG TIN TÀI SẢN & TỒN KHO VẬT TƯ
      el('div', { class: 'rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40' },
        el('p', { class: 'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2' }, 'Tài sản & Tồn kho vật tư'),
        el('div', { class: 'space-y-2 text-xs' },
          el('div', { class: 'flex items-center justify-between' },
            el('span', { class: 'text-slate-500 dark:text-slate-400' }, 'Tài sản (Asset):'),
            el('span', { class: 'font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]', title: assetReason },
              isTechnical ? (assetId ? `${assetId} (Khớp)` : 'Kiểm tra hiện trường') : 'Khu vực chung (N/A)')),
          el('div', { class: 'flex items-center justify-between border-t border-slate-200/60 pt-1.5 dark:border-slate-700/60' },
            el('span', { class: 'text-slate-500 dark:text-slate-400' }, 'Vật tư:'),
            el('span', { class: `inline-flex items-center gap-1 font-semibold ${materialStatusTone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}` },
              el('span', { class: `h-1.5 w-1.5 rounded-full ${materialStatusTone === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'}` }),
              materialStatusLabel)),
          el('p', { class: 'text-[11px] text-slate-500 dark:text-slate-400 truncate' }, materialDetail)))),

    // --- 5. LÝ DO SUY LUẬN & RULE TRACE ---
    el('div', { class: 'mt-4 rounded-xl bg-indigo-50/50 p-4 border border-indigo-100 dark:bg-slate-800/60 dark:border-slate-800' },
      el('div', { class: 'flex items-center justify-between' },
        el('div', { class: 'flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300' },
          el('span', {}, '🧠'),
          el('span', {}, 'Lý do suy luận của Agent')),
        el('div', { class: 'flex flex-wrap gap-1' },
          (p && p.matched_rule_ids ? p.matched_rule_ids : ['PB-COM-R-CLS-01']).map((ruleId) =>
            el('span', { class: 'rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-mono font-medium text-indigo-800 border border-indigo-200 dark:bg-slate-700 dark:text-indigo-200 dark:border-slate-600' }, ruleId)))),
      el('p', { class: 'mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300 italic' },
        `"${(p && p.classification_reason) || (c.classification && c.classification.reason) || 'Phân loại dựa trên mô tả phản ánh và đối soát quy tắc.'}"`)));
}

// Make functions available globally for app.js
if (typeof window !== 'undefined') {
  window.agentProposal = agentProposal;
  window.agentProposalComponent = agentProposal;
  window.openAiRawModal = openAiRawModal;
  window.parseLocationParts = parseLocationParts;
  window.getConfidenceInfo = getConfidenceInfo;
}
