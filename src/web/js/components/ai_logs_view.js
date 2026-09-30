/**
 * AI Logs View Component for MaintenanceOps.
 * Provides a dedicated screen for tracking, filtering, inspecting, and resetting LLM calls.
 *
 * Features:
 * 1. Fetches logs from GET /api/v1/mo/ai-logs
 * 2. Displays Timestamp, Tool, Event, Prompt Summary, Model, Latency, Status
 * 3. Filter by Model dropdown
 * 4. Keyword search input (by ticket_id, prompt content, classification reason)
 * 5. Modal "Chi tiết AI Log" showing prompt, structured output JSON, latency, and full copy
 * 6. "Làm mới" (Refresh) and "Reset Logs" (POST /api/v1/mo/ai-logs/reset) buttons
 */
'use strict';

let _aiLogsCache = [];
let _aiLogsFilter = {
  model: 'ALL',
  status: 'ALL',
  search: '',
};

/**
 * Fetch logs from backend
 */
async function fetchAiLogs() {
  try {
    const logs = await api('/mo/ai-logs?limit=100');
    _aiLogsCache = Array.isArray(logs) ? logs : [];
    return _aiLogsCache;
  } catch (error) {
    console.error('Failed to fetch AI logs:', error);
    toast(`Không tải được AI logs: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Open Modal displaying full detail of an AI Log entry
 */
function openAiLogDetailModal(entry) {
  let modal = document.getElementById('ai-log-entry-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'ai-log-entry-modal';
    modal.className = 'w-full max-w-3xl rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100';
    document.body.appendChild(modal);
  }

  modal.replaceChildren();

  const statusTone = entry.status === 'SUCCESS' ? 'emerald' : entry.status === 'FALLBACK_RULE' ? 'amber' : 'rose';
  const statusLabel = entry.status === 'SUCCESS' ? 'Thành công (SUCCESS)' : entry.status === 'FALLBACK_RULE' ? 'Fallback Quy tắc' : 'Lỗi (ERROR)';

  const userPromptText = (entry.prompt_sent && entry.prompt_sent.user) ? entry.prompt_sent.user : (typeof entry.prompt_sent === 'string' ? entry.prompt_sent : JSON.stringify(entry.prompt_sent, null, 2));
  const systemPromptText = (entry.prompt_sent && entry.prompt_sent.system) ? entry.prompt_sent.system : 'Chỉ thị hệ thống mặc định';
  const outputText = entry.structured_output ? JSON.stringify(entry.structured_output, null, 2) : (entry.raw_output || 'Không có output');

  const container = el('div', { class: 'p-6 space-y-4' },
    // Header
    el('div', { class: 'flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800' },
      el('div', { class: 'flex items-center gap-3' },
        el('span', { class: 'flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm' },
          el('svg', { class: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
            el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }))),
        el('div', {},
          el('h3', { class: 'text-lg font-bold text-slate-900 dark:text-white' }, 'Chi tiết Lượt gọi AI / LLM'),
          el('p', { class: 'font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5' },
            `ID: ${entry.entry_id} · Ticket: ${entry.ticket_id}`))),
      el('button', {
        type: 'button',
        class: 'rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        onclick: () => modal.close(),
      }, el('svg', { class: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M6 18L18 6M6 6l12 12' })))),

    // Meta Badge Bar
    el('div', { class: 'grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700' },
      el('div', {}, el('p', { class: 'text-slate-500 dark:text-slate-400' }, 'Mô hình (Model)'), el('p', { class: 'font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5' }, entry.model_name || 'llm')),
      el('div', {}, el('p', { class: 'text-slate-500 dark:text-slate-400' }, 'Độ trễ (Latency)'), el('p', { class: 'font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5' }, `${Math.round(entry.latency_ms || 0)} ms`)),
      el('div', {}, el('p', { class: 'text-slate-500 dark:text-slate-400' }, 'Trạng thái'), el('p', { class: `font-semibold text-${statusTone}-600 dark:text-${statusTone}-400 mt-0.5` }, statusLabel)),
      el('div', {}, el('p', { class: 'text-slate-500 dark:text-slate-400' }, 'Thời gian ghi'), el('p', { class: 'text-slate-700 dark:text-slate-300 mt-0.5' }, formatTime(entry.timestamp)))),

    // Scrollable sections
    el('div', { class: 'max-h-[60vh] space-y-4 overflow-y-auto pr-1' },
      // 1. System Prompt
      el('div', { class: 'space-y-1' },
        el('p', { class: 'text-xs font-semibold text-slate-700 dark:text-slate-300' }, '1. System Prompt (Chỉ thị & Giới hạn phân loại)'),
        el('pre', { class: 'rounded-lg bg-slate-900 p-3 text-xs text-slate-200 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ring-1 ring-slate-800' }, systemPromptText)),

      // 2. User Prompt
      el('div', { class: 'space-y-1' },
        el('p', { class: 'text-xs font-semibold text-slate-700 dark:text-slate-300' }, '2. Prompt Sent / User Input (Dữ liệu gửi lên LLM)'),
        el('pre', { class: 'rounded-lg bg-slate-900 p-3 text-xs text-amber-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ring-1 ring-slate-800' }, userPromptText)),

      // 3. Structured Output JSON
      el('div', { class: 'space-y-1' },
        el('div', { class: 'flex items-center justify-between' },
          el('p', { class: 'text-xs font-semibold text-slate-700 dark:text-slate-300' }, '3. Structured Output (JSON phân loại)'),
          el('button', {
            type: 'button',
            class: 'text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline',
            onclick: () => {
              navigator.clipboard.writeText(outputText);
              toast('Đã sao chép Structured Output vào clipboard');
            },
          }, 'Sao chép JSON')),
        el('pre', { class: 'rounded-lg bg-slate-950 p-3 text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ring-1 ring-slate-800' }, outputText)),

      // Error if fallback
      entry.error_message ? callout('danger', 'Thông báo lỗi Fallback', entry.error_message) : null),

    // Footer actions
    el('div', { class: 'flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800' },
      el('button', {
        type: 'button',
        class: BTN.secondary,
        onclick: () => {
          navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
          toast('Đã sao chép toàn bộ bản ghi log vào clipboard');
        },
      }, 'Sao chép toàn bộ log (JSON)'),
      el('button', {
        type: 'button',
        class: BTN.primary,
        onclick: () => modal.close(),
      }, 'Đóng')));

  modal.appendChild(container);
  modal.showModal();

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

/**
 * Filter and search logs
 */
function getFilteredAiLogs() {
  const { model, status, search } = _aiLogsFilter;
  const q = search.trim().toLowerCase();

  return _aiLogsCache.filter((entry) => {
    // Filter model
    if (model !== 'ALL' && entry.model_name !== model) return false;

    // Filter status
    if (status !== 'ALL' && entry.status !== status) return false;

    // Search query
    if (q) {
      const ticketMatch = (entry.ticket_id || '').toLowerCase().includes(q);
      const modelMatch = (entry.model_name || '').toLowerCase().includes(q);
      const promptMatch = JSON.stringify(entry.prompt_sent || '').toLowerCase().includes(q);
      const outputMatch = JSON.stringify(entry.structured_output || '').toLowerCase().includes(q);
      const errorMatch = (entry.error_message || '').toLowerCase().includes(q);
      if (!ticketMatch && !modelMatch && !promptMatch && !outputMatch && !errorMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Main render function for "Lịch sử AI Logs" view
 */
async function renderAiLogsView(container) {
  container.replaceChildren();

  // Load initial logs
  const logs = await fetchAiLogs();

  // Calculate statistics
  const total = logs.length;
  const successCount = logs.filter((l) => l.status === 'SUCCESS').length;
  const fallbackCount = logs.filter((l) => l.status === 'FALLBACK_RULE').length;
  const avgLatency = total > 0 ? Math.round(logs.reduce((acc, l) => acc + (l.latency_ms || 0), 0) / total) : 0;

  // Extract distinct models for filter
  const distinctModels = Array.from(new Set(logs.map((l) => l.model_name).filter(Boolean)));

  // Root view layout
  const root = el('div', { class: 'space-y-6' });

  // 1. STATS BANNER
  const statsCard = el('div', { class: 'grid grid-cols-2 gap-4 sm:grid-cols-4' },
    el('div', { class: 'rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900' },
      el('p', { class: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, 'Tổng lượt gọi LLM'),
      el('p', { class: 'mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white' }, String(total))),
    el('div', { class: 'rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900' },
      el('p', { class: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, 'Thành công (LLM Output)'),
      el('p', { class: 'mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400' }, String(successCount))),
    el('div', { class: 'rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900' },
      el('p', { class: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, 'Fallback Quy tắc'),
      el('p', { class: 'mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400' }, String(fallbackCount))),
    el('div', { class: 'rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900' },
      el('p', { class: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, 'Độ trễ trung bình'),
      el('p', { class: 'mt-1 text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400' }, `${avgLatency} ms`)));

  // 2. TOOLBAR: Search, Model Filter, Status Filter, Refresh, Reset
  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Tìm theo Ticket ID, từ khóa prompt, lý do...',
    class: 'block w-full rounded-lg border-0 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-xs ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
    value: _aiLogsFilter.search,
    oninput: (e) => {
      _aiLogsFilter.search = e.target.value;
      updateTable();
    },
  });

  const modelSelect = el('select', {
    class: 'rounded-lg border-0 py-2 pl-3 pr-8 text-sm text-slate-900 shadow-xs ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
    onchange: (e) => {
      _aiLogsFilter.model = e.target.value;
      updateTable();
    },
  },
    el('option', { value: 'ALL' }, 'Tất cả Model'),
    distinctModels.map((m) => el('option', { value: m, selected: _aiLogsFilter.model === m }, m)));

  const statusSelect = el('select', {
    class: 'rounded-lg border-0 py-2 pl-3 pr-8 text-sm text-slate-900 shadow-xs ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
    onchange: (e) => {
      _aiLogsFilter.status = e.target.value;
      updateTable();
    },
  },
    el('option', { value: 'ALL' }, 'Tất cả trạng thái'),
    el('option', { value: 'SUCCESS' }, 'Thành công (SUCCESS)'),
    el('option', { value: 'FALLBACK_RULE' }, 'Fallback Quy tắc'),
    el('option', { value: 'ERROR' }, 'Lỗi (ERROR)'));

  const refreshBtn = el('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    onclick: async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = `
        <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Đang nạp...</span>`;
      await fetchAiLogs();
      renderAiLogsView(container);
      toast('Đã làm mới danh sách AI Logs');
    },
  },
    el('svg', { class: 'h-4 w-4 text-slate-500 dark:text-slate-400', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
      el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' })),
    el('span', {}, 'Làm mới'));

  const resetBtn = el('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 shadow-xs hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60',
    onclick: async () => {
      const ok = await confirmDialog(
        'Reset toàn bộ AI Logs?',
        'Thao tác này sẽ xóa sạch danh sách lịch sử gọi LLM trong bộ nhớ in-memory để phục vụ kịch bản demo hoặc kiểm thử mới.'
      );
      if (!ok) return;
      try {
        await api('/mo/ai-logs/reset', { method: 'POST' });
        toast('Đã reset toàn bộ AI Logs thành công!');
        await fetchAiLogs();
        renderAiLogsView(container);
      } catch (err) {
        toast(`Lỗi khi reset: ${err.message}`, 'error');
      }
    },
  },
    el('svg', { class: 'h-4 w-4 text-rose-600 dark:text-rose-400', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
      el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })),
    el('span', {}, 'Reset Logs'));

  const toolbar = el('div', { class: 'flex flex-wrap items-center justify-between gap-3' },
    el('div', { class: 'relative min-w-[280px] flex-1 sm:max-w-md' },
      el('div', { class: 'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3' },
        el('svg', { class: 'h-4 w-4 text-slate-400', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
          el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }))),
      searchInput),
    el('div', { class: 'flex flex-wrap items-center gap-2.5' },
      modelSelect,
      statusSelect,
      refreshBtn,
      resetBtn));

  // 3. TABLE CONTAINER
  const tableContainer = el('div', { class: 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900' });

  function updateTable() {
    const filtered = getFilteredAiLogs();
    if (!filtered.length) {
      tableContainer.replaceChildren(
        emptyState('Không tìm thấy bản ghi AI Log phù hợp', 'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.')
      );
      return;
    }

    const table = el('table', { class: 'min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800' },
      el('thead', { class: 'bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400' },
        el('tr', {},
          el('th', { class: 'py-3.5 pl-4 pr-3 sm:pl-6' }, 'Thời gian'),
          el('th', { class: 'px-3 py-3.5' }, 'Ticket ID'),
          el('th', { class: 'px-3 py-3.5' }, 'Tool / Event'),
          el('th', { class: 'px-3 py-3.5' }, 'Prompt tóm tắt'),
          el('th', { class: 'px-3 py-3.5' }, 'Model'),
          el('th', { class: 'px-3 py-3.5 text-right' }, 'Latency'),
          el('th', { class: 'px-3 py-3.5 text-center' }, 'Trạng thái'),
          el('th', { class: 'py-3.5 pl-3 pr-4 text-center sm:pr-6' }, 'Thao tác'))),
      el('tbody', { class: 'divide-y divide-slate-100 dark:divide-slate-800' },
        filtered.map((entry) => {
          const userPrompt = (entry.prompt_sent && entry.prompt_sent.user) ? entry.prompt_sent.user : String(entry.prompt_sent || '');
          const summary = userPrompt.replace(/<[^>]+>/g, '').trim().slice(0, 75);

          const statusTone = entry.status === 'SUCCESS' ? 'emerald' : entry.status === 'FALLBACK_RULE' ? 'amber' : 'rose';
          const statusText = entry.status === 'SUCCESS' ? 'SUCCESS' : entry.status === 'FALLBACK_RULE' ? 'FALLBACK' : 'ERROR';

          const latency = Math.round(entry.latency_ms || 0);
          const latencyColor = latency < 500 ? 'text-emerald-600 dark:text-emerald-400' : latency < 1500 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

          return el('tr', {
            class: 'hover:bg-slate-50/80 transition-colors cursor-pointer dark:hover:bg-slate-800/40',
            onclick: () => openAiLogDetailModal(entry),
          },
            // 1. Time
            el('td', { class: 'whitespace-nowrap py-3.5 pl-4 pr-3 font-mono text-xs text-slate-600 sm:pl-6 dark:text-slate-400' }, formatTime(entry.timestamp)),
            // 2. Ticket ID
            el('td', { class: 'whitespace-nowrap px-3 py-3.5 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400' }, entry.ticket_id || 'PENDING'),
            // 3. Tool & Event
            el('td', { class: 'whitespace-nowrap px-3 py-3.5 text-xs' },
              el('div', { class: 'font-medium text-slate-800 dark:text-slate-200' }, 'proposer'),
              el('div', { class: 'text-[11px] text-slate-500 dark:text-slate-400' }, entry.status === 'SUCCESS' ? 'LLM_PROPOSE' : 'FALLBACK_RULE')),
            // 4. Prompt Summary
            el('td', { class: 'px-3 py-3.5 max-w-[260px]' },
              el('p', { class: 'truncate text-xs text-slate-700 dark:text-slate-300 font-medium', title: userPrompt }, summary || '(không có nội dung)')),
            // 5. Model
            el('td', { class: 'whitespace-nowrap px-3 py-3.5' },
              el('span', { class: 'inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-mono font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-950 dark:text-indigo-300' }, entry.model_name || 'llm')),
            // 6. Latency
            el('td', { class: `whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-bold ${latencyColor}` }, `${latency} ms`),
            // 7. Status Badge
            el('td', { class: 'whitespace-nowrap px-3 py-3.5 text-center' },
              el('span', { class: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-${statusTone}-50 text-${statusTone}-700 ring-1 ring-inset ring-${statusTone}-600/20 dark:bg-${statusTone}-950 dark:text-${statusTone}-300` },
                el('span', { class: `h-1.5 w-1.5 rounded-full bg-${statusTone}-500` }),
                statusText)),
            // 8. Action button
            el('td', { class: 'whitespace-nowrap py-3.5 pl-3 pr-4 text-center sm:pr-6' },
              el('button', {
                type: 'button',
                class: 'rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800',
                title: 'Xem chi tiết log này',
                onclick: (e) => {
                  e.stopPropagation();
                  openAiLogDetailModal(entry);
                },
              }, el('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
                el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })))));
        })));

    tableContainer.replaceChildren(table);
  }

  updateTable();

  root.append(statsCard, toolbar, tableContainer);
  container.append(root);
}

// Global exposure
if (typeof window !== 'undefined') {
  window.renderAiLogsView = renderAiLogsView;
  window.fetchAiLogs = fetchAiLogs;
  window.openAiLogDetailModal = openAiLogDetailModal;
}
