// ==UserScript==
// @name         OZON Review Scanner
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  OZON сканер отзывов с сортировкой просканированных товаров и разделителем
// @author       Yvan57/OZON-review-scanner
// @match        https://www.ozon.ru/*
// @grant        GM_addStyle
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const debounce = (fn, ms) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    const toInt = (v, fb = 0) => { const n = parseInt(v, 10); return isNaN(n) ? fb : n; };
    const toFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? NaN : n; };

    GM_addStyle(`
        #ozon-scanner-box {
            position: fixed; top: 80px; right: 15px; width: 400px; height: 450px;
            background: #fff; color: #1a1a1a; font-size: 12px;
            border: 1px solid #e0e0e0; border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,.1); z-index: 999999;
            display: none; flex-direction: column; resize: both; overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #ozon-scanner-header {
            background: linear-gradient(135deg, #005bff, #0041cc);
            padding: 8px 12px; cursor: move; display: flex;
            justify-content: space-between; align-items: center;
            user-select: none; border-radius: 12px 12px 0 0; color: #fff; font-size: 13px; font-weight: 600;
        }
        .header-title { display: flex; align-items: center; gap: 6px; }
        #ozon-hide-btn {
            width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,.2); color: #fff; border: none; border-radius: 12px;
            cursor: pointer; font-size: 11px; transition: background .2s;
        }
        #ozon-hide-btn:hover { background: rgba(255,255,255,.35); }
        .scanner-body { padding: 8px; flex: 1; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
        .ctrl {
            background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 6px;
            display: flex; justify-content: space-between; align-items: center; gap: 6px;
        }
        .ctrl:hover { background: #f1f3f4; border-color: rgba(0,91,255,.2); }
        .switch { display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 11px; user-select: none; cursor: pointer; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: relative; width: 32px; height: 18px; background: #E5E5EA;
            border-radius: 9px; flex-shrink: 0; transition: background .2s;
        }
        .slider::before {
            content: ""; position: absolute; height: 14px; width: 14px; left: 2px; bottom: 2px;
            background: #fff; border-radius: 7px; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2);
        }
        .switch input:checked + .slider { background: #005bff; }
        .switch input:checked + .slider::before { transform: translateX(14px); }
        .info-card {
            display: none; font-size: 10px; background: #e7f3ff; border: 1px solid #b3d9ff;
            border-radius: 8px; padding: 8px; line-height: 1.5; color: #1a1a1a;
        }
        .info-card strong { color: #005bff; }
        .btn {
            padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 500;
            font-size: 10px; transition: all .15s; border: 1px solid;
        }
        .btn-info  { background: #e7f3ff; border-color: #b3d9ff; color: #005bff; }
        .btn-info:hover  { background: #cce7ff; }
        .btn-reset { background: #fff3cd; border-color: #ffd; color: #856404; }
        .btn-reset:hover { background: #ffeaa7; }
        .btn-clear { background: #ffe6e6; border-color: #ffb3b3; color: #FF3B30; }
        .btn-clear:hover { background: #ffcccc; }
        .table-wrap {
            flex: 1; overflow: auto; max-height: 200px;
            border: 1px solid #e9ecef; border-radius: 8px;
        }
        #ozon-results { margin: 0; border-collapse: collapse; width: 100%; font-size: 10px; }
        #ozon-results th, #ozon-results td { border-bottom: 1px solid #f0f0f0; padding: 6px 8px; text-align: left; }
        #ozon-results th {
            cursor: pointer; background: #f8f9fa; font-weight: 600; position: sticky; top: 0;
            z-index: 1; font-size: 10px; transition: background .15s;
        }
        #ozon-results th:hover { background: #e7f3ff; color: #005bff; }
        #ozon-results tbody tr:hover { background: #f8f9fa; }
        .sort-arrow { float: right; font-size: 9px; color: #005bff; margin-left: 4px; }
        .stats-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #666; }
        .stats-num { color: #005bff; font-weight: 600; }
        .btn-row { display: flex; gap: 4px; }
        #ozon-toggle {
            position: fixed; top: 15px; right: 15px; width: 50px; height: 50px;
            background: #005bff; color: #fff; border: none; border-radius: 12px;
            z-index: 999998; display: flex; align-items: center; justify-content: center;
            text-align: center; white-space: pre-line; font-size: 11px; cursor: move;
            box-shadow: 0 4px 16px rgba(0,91,255,.3); font-weight: 600; transition: all .2s;
        }
        #ozon-toggle:hover { background: #0041cc; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,91,255,.4); }
        .inp {
            flex: 1; padding: 4px 6px; font-size: 11px; border: 1px solid #dee2e6;
            border-radius: 6px; background: #fff; color: #1a1a1a; font-family: inherit; transition: border .15s;
        }
        .inp:focus { outline: none; border-color: #005bff; box-shadow: 0 0 0 2px rgba(0,91,255,.1); }
        .inp::placeholder { color: #8E8E93; font-size: 10px; }
        .inp.sm { width: 45px; flex: none; }
        .dot {
            width: 6px; height: 6px; border-radius: 3px; background: #8E8E93; transition: all .2s; flex-shrink: 0;
        }
        .dot.active { background: #34C759; }
        .dot.scanning { background: #FF9500; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.2)} }
        .ozon-sep {
            position: relative; height: 32px; margin: 16px 0;
            display: flex; align-items: center; justify-content: center;
        }
        .ozon-sep::before {
            content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, #005bff, transparent);
        }
        .ozon-sep-label {
            background: #fff; padding: 4px 10px; border-radius: 10px;
            border: 1.5px solid #005bff; font-size: 10px; font-weight: 600;
            color: #005bff; position: relative; box-shadow: 0 2px 6px rgba(0,91,255,.15);
        }
        .table-wrap::-webkit-scrollbar, .scanner-body::-webkit-scrollbar { width: 3px; }
        .table-wrap::-webkit-scrollbar-track, .scanner-body::-webkit-scrollbar-track { background: #f0f0f0; }
        .table-wrap::-webkit-scrollbar-thumb, .scanner-body::-webkit-scrollbar-thumb { background: rgba(0,91,255,.4); border-radius: 2px; }
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        #ozon-scanner-box.show { animation: slideIn .2s ease; }
    `);

    const createUI = () => {
        const box = document.createElement('div');
        box.id = 'ozon-scanner-box';
        box.innerHTML = `
            <div id="ozon-scanner-header">
                <div class="header-title">
                    <div class="dot" id="dot"></div>
                    OZON Сканер
                </div>
                <button id="ozon-hide-btn">✕</button>
            </div>
            <div class="scanner-body">
                <div class="ctrl">
                    <label class="switch"><input type="checkbox" id="scanToggle"><span class="slider"></span><span>Сканирование</span></label>
                    <button id="toggleInfo" class="btn btn-info">ℹ️</button>
                </div>
                <div class="ctrl">
                    <label class="switch"><input type="checkbox" id="scrollToggle"><span class="slider"></span><span>Автопрокрутка</span></label>
                    <input type="text" id="searchInput" class="inp" placeholder="🔍 Поиск ('точный', /regex/)">
                </div>
                <div class="ctrl">
                    <label class="switch"><input type="checkbox" id="hideNoReview"><span class="slider"></span><span>Мин. отзывов</span></label>
                    <input type="number" id="minReviews" class="inp sm" min="0" value="1">
                </div>
                <div class="ctrl">
                    <div class="stats-row" style="width:100%">
                        <span id="itemCount">Товаров: <span class="stats-num">0</span></span>
                        <div class="btn-row">
                            <button id="resetSort" class="btn btn-reset">↺ Сброс</button>
                            <button id="clearData" class="btn btn-clear">🗑 Очистить</button>
                        </div>
                    </div>
                </div>
                <div id="ozon-info" class="info-card">
                    <strong>Инструкция:</strong><br>
                    <b>Сканирование</b> — сбор товаров на странице<br>
                    <b>Автопрокрутка</b> — прокрутка для сбора всех товаров<br>
                    <b>Поиск:</b> обычный, 'точный' или /regex/<br>
                    Клик по заголовку — сортировка (только просканированные)<br>
                    <b>Разделитель</b> — граница просканированных товаров<br>
                    <b>Сброс</b> — возврат к исходному порядку<br>
                    Название товара — ссылка на страницу
                </div>
                <div class="table-wrap">
                    <table id="ozon-results">
                        <thead><tr>
                            <th data-field="title">Товар <span class="sort-arrow"></span></th>
                            <th data-field="reviews">Отзывы <span class="sort-arrow">▼</span></th>
                            <th data-field="rating">Оценка <span class="sort-arrow"></span></th>
                            <th data-field="price">Цена <span class="sort-arrow"></span></th>
                        </tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>`;
        document.body.appendChild(box);

        const btn = document.createElement('div');
        btn.id = 'ozon-toggle';
        btn.innerHTML = '📱<br>OZON<br>Сканер';
        document.body.appendChild(btn);

        return { box, btn };
    };

    class OZONScanner {
        constructor() {
            this.data = [];
            this.scannedLinks = new Set();
            this.originalOrder = [];
            this.sortState = { field: 'reviews', direction: 'desc' };
            this.scanInterval = null;
            this.filterInterval = null;
            this.isScanning = false;

            const { box, btn } = createUI();
            this.box = box;
            this.toggleBtn = btn;

            this.el = {
                scanToggle:       box.querySelector('#scanToggle'),
                scrollToggle:     box.querySelector('#scrollToggle'),
                searchInput:      box.querySelector('#searchInput'),
                minReviews:       box.querySelector('#minReviews'),
                hideNoReview:     box.querySelector('#hideNoReview'),
                itemCount:        box.querySelector('#itemCount'),
                tbody:            box.querySelector('#ozon-results tbody'),
                dot:              box.querySelector('#dot'),
                infoBlock:        box.querySelector('#ozon-info'),
            };

            this._loadSettings();
            this._bindEvents();
            this._makeDraggable(box, box.querySelector('#ozon-scanner-header'));
            this._makeDraggable(btn, btn);
            this._saveOriginalOrder();
            this.filterInterval = setInterval(() => this._filterPageCards(), 500);

            if (this.el.scanToggle.checked) this._startScan();
        }

        _loadSettings() {
            this.el.hideNoReview.checked = JSON.parse(localStorage.getItem('hideNoReview') || 'false');
            this.el.minReviews.value = toInt(localStorage.getItem('minReviews') || '1', 1);
        }

        _saveSettings() {
            localStorage.setItem('hideNoReview', this.el.hideNoReview.checked);
            localStorage.setItem('minReviews', this.el.minReviews.value);
        }

        _saveOriginalOrder() {
            this.originalOrder = [...document.querySelectorAll('.tile-root[data-index]')].map(el => ({
                el, parent: el.parentElement, next: el.nextElementSibling
            }));
        }

        _restoreOriginalOrder() {
            this._removeSeparator();
            this.originalOrder.forEach(({ el, parent, next }) => {
                if (el.parentElement !== parent) {
                    next && next.parentElement === parent
                        ? parent.insertBefore(el, next)
                        : parent.appendChild(el);
                }
            });
            this.sortState = { field: 'reviews', direction: 'desc' };
            this._updateSortArrows();
        }

        _bindEvents() {
            const { scanToggle, scrollToggle, searchInput, minReviews, hideNoReview } = this.el;
            const debouncedUpdate = debounce(() => { this._renderTable(); this._filterPageCards(); }, 300);

            scanToggle.addEventListener('change', () => {
                scanToggle.checked ? this._startScan() : this._stopScan();
                if (!scanToggle.checked) scrollToggle.checked = false;
            });

            scrollToggle.addEventListener('change', () => {
                if (scrollToggle.checked && !scanToggle.checked) {
                    scanToggle.checked = true;
                    this._startScan();
                }
            });

            searchInput.addEventListener('input', debouncedUpdate);
            minReviews.addEventListener('change', () => { this._saveSettings(); debouncedUpdate(); });
            hideNoReview.addEventListener('change', () => { this._saveSettings(); debouncedUpdate(); });

            this.box.querySelector('#toggleInfo').addEventListener('click', () => {
                const b = this.el.infoBlock;
                b.style.display = b.style.display === 'block' ? 'none' : 'block';
            });

            this.box.querySelector('#ozon-hide-btn').addEventListener('click', () => {
                this.box.style.display = 'none';
                this.toggleBtn.style.display = 'flex';
            });

            this.toggleBtn.addEventListener('click', () => {
                this.box.style.display = 'flex';
                this.box.classList.add('show');
                this.toggleBtn.style.display = 'none';
                setTimeout(() => this.box.classList.remove('show'), 200);
            });

            this.box.querySelector('#clearData').addEventListener('click', () => {
                if (confirm('Очистить все собранные данные о товарах?')) {
                    this.data = [];
                    this.scannedLinks.clear();
                    this._removeSeparator();
                    this._renderTable();
                }
            });

            this.box.querySelector('#resetSort').addEventListener('click', () => this._restoreOriginalOrder());

            this.box.querySelectorAll('#ozon-results th[data-field]').forEach(th => {
                th.addEventListener('click', () => this._handleSort(th.dataset.field));
            });
        }

        _startScan() {
            if (this.scanInterval) return;
            this.isScanning = true;
            this._updateDot();
            this._runScan();
            this.scanInterval = setInterval(() => this._runScan(), 1000);
        }

        _stopScan() {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
            this.isScanning = false;
            this._updateDot();
        }

        _updateDot() {
            const { dot } = this.el;
            dot.className = 'dot' + (this.isScanning ? ' scanning' : this.data.length ? ' active' : '');
        }

        _runScan() {
            if (this.el.scrollToggle.checked) {
                window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });
            }
            this._collectData();
            this._renderTable();
            this._filterPageCards();
        }

        _extractCardData(card) {
            const link = card.querySelector('a.tile-clickable-element')?.href?.split('?')[0];
            const title = card.querySelector('span.tsBody500Medium')?.textContent?.trim();
            if (!link || !title) return null;

            const spans = [...card.querySelectorAll('span')];
            const texts = spans.map(s => s.textContent);
            const textsClean = spans.map(s => s.textContent.replace(/\s/g, ''));

            const ratingText = texts.map(t => t.trim()).find(t => /^\d\.\d$/.test(t));
            const reviewText = texts.find(t => /\d[\d\s]*\s+отзыв/.test(t));
            const priceText = textsClean.find(t => /^\d+₽$/.test(t));

            return {
                title, link,
                rating: toFloat(ratingText),
                reviews: toInt(reviewText?.replace(/\D/g, '')),
                price: toInt(priceText?.replace('₽', '')),
            };
        }

        _collectData() {
            document.querySelectorAll('.tile-root[data-index]').forEach(card => {
                try {
                    const d = this._extractCardData(card);
                    if (d && !this.data.some(x => x.link === d.link)) {
                        this.data.push(d);
                        this.scannedLinks.add(d.link);
                    }
                } catch { /* skip bad card */ }
            });
            if (this.data.length > 1000) {
                this.data = this.data.slice(-1000);
                this.scannedLinks.clear();
                this.data.forEach(x => this.scannedLinks.add(x.link));
            }
        }

        _createMatcher(q) {
            if (!q) return () => true;
            if (q.startsWith("'") && q.endsWith("'")) {
                const exact = q.slice(1, -1).toLowerCase();
                return t => t.toLowerCase().includes(exact);
            }
            if (q.startsWith('/') && q.endsWith('/')) {
                try { const re = new RegExp(q.slice(1, -1), 'i'); return t => re.test(t); } catch { /**/ }
            }
            const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return t => re.test(t);
        }

        _getFiltered() {
            let out = [...this.data];
            const q = this.el.searchInput.value.trim();
            if (q) { const m = this._createMatcher(q); out = out.filter(x => m(x.title)); }
            if (this.el.hideNoReview.checked) {
                const min = toInt(this.el.minReviews.value);
                out = out.filter(x => x.reviews >= min);
            }
            return out;
        }

        _renderTable() {
            const filtered = this._getFiltered();
            const frag = document.createDocumentFragment();

            filtered.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><a href="${item.link}" target="_blank" style="color:#005bff;text-decoration:none;font-weight:500" title="${item.title}">${item.title}</a></td>
                    <td style="font-weight:600;color:${item.reviews > 0 ? '#005bff' : '#999'}">${item.reviews || '—'}</td>
                    <td style="font-weight:600;color:${!isNaN(item.rating) ? '#FF9500' : '#999'}">${isNaN(item.rating) ? '—' : '⭐' + item.rating.toFixed(1)}</td>
                    <td style="font-weight:600;color:${item.price ? '#34C759' : '#999'}">${item.price ? item.price + '₽' : '—'}</td>`;
                frag.appendChild(tr);
            });

            this.el.tbody.innerHTML = '';
            this.el.tbody.appendChild(frag);

            const total = this.data.length;
            const shown = filtered.length;
            this.el.itemCount.innerHTML = `Товаров: <span class="stats-num">${shown}</span>${total !== shown ? ` из <span class="stats-num">${total}</span>` : ''}`;
            this._updateDot();
        }

        _filterPageCards() {
            const q = this.el.searchInput.value.trim();
            const hideNoReview = this.el.hideNoReview.checked;
            const min = toInt(this.el.minReviews.value);
            const matcher = this._createMatcher(q);

            document.querySelectorAll('.tile-root[data-index]').forEach(card => {
                try {
                    if (!q && !hideNoReview) { card.style.display = ''; return; }
                    const title = card.querySelector('span.tsBody500Medium')?.textContent?.trim() || '';
                    let hide = q && !matcher(title);
                    if (!hide && hideNoReview) {
                        const rt = [...card.querySelectorAll('span')].map(s => s.textContent).find(t => /\d[\d\s]*\s+отзыв/.test(t));
                        hide = toInt(rt?.replace(/\D/g, '')) < min;
                    }
                    card.style.display = hide ? 'none' : '';
                } catch { /* skip */ }
            });
        }

        _removeSeparator() {
            document.getElementById('ozon-scanner-sep')?.remove();
        }

        _placeSeparator() {
            this._removeSeparator();
            if (!this.scannedLinks.size) return;

            const allCards = [...document.querySelectorAll('.tile-root[data-index]')];
            const boundaryIdx = allCards.findIndex(card => {
                const link = card.querySelector('a.tile-clickable-element')?.href?.split('?')[0];
                return link && !this.scannedLinks.has(link);
            });

            if (boundaryIdx < 0 || boundaryIdx >= allCards.length) return;

            const sep = document.createElement('div');
            sep.className = 'ozon-sep';
            sep.id = 'ozon-scanner-sep';
            sep.innerHTML = '<div class="ozon-sep-label">📊 Просканированные товары выше</div>';
            allCards[boundaryIdx].parentElement.insertBefore(sep, allCards[boundaryIdx]);
        }

        _getCardValue(card, field) {
            const spans = [...card.querySelectorAll('span')];
            if (field === 'title') return card.querySelector('span.tsBody500Medium')?.textContent?.trim().toLowerCase() || '';
            if (field === 'reviews') {
                const t = spans.map(s => s.textContent).find(t => /\d[\d\s]*\s+отзыв/.test(t));
                return toInt(t?.replace(/\D/g, ''));
            }
            if (field === 'rating') {
                const t = spans.map(s => s.textContent.trim()).find(t => /^\d\.\d$/.test(t));
                return toFloat(t) || 0;
            }
            if (field === 'price') {
                const t = spans.map(s => s.textContent.replace(/\s/g, '')).find(t => /^\d+₽$/.test(t));
                return toInt(t?.replace('₽', ''));
            }
            return 0;
        }

        _sortPageCards(field, dir) {
            if (!this.scannedLinks.size) return;

            const containers = [...document.querySelectorAll('.w5i_24')].filter(c =>
                c.querySelector('.tile-root[data-index]')
            );
            if (!containers.length) return;

            const scanned = [];
            containers.forEach(container =>
                [...container.querySelectorAll('.tile-root[data-index]')].forEach(card => {
                    const link = card.querySelector('a.tile-clickable-element')?.href?.split('?')[0];
                    if (link && this.scannedLinks.has(link)) scanned.push({ el: card, container });
                })
            );

            if (!scanned.length) return;

            scanned.sort((a, b) => {
                const va = this._getCardValue(a.el, field);
                const vb = this._getCardValue(b.el, field);
                if (field === 'title') return dir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
                return dir === 'desc' ? vb - va : va - vb;
            });

            scanned.forEach(({ el }) => el.remove());

            const perContainer = Math.ceil(scanned.length / containers.length);
            containers.forEach((container, i) => {
                const chunk = scanned.slice(i * perContainer, (i + 1) * perContainer);
                if (!chunk.length) return;
                const frag = document.createDocumentFragment();
                chunk.forEach(({ el }) => frag.appendChild(el));
                container.firstChild
                    ? container.insertBefore(frag, container.firstChild)
                    : container.appendChild(frag);
            });

            setTimeout(() => this._placeSeparator(), 100);
        }

        _handleSort(field) {
            if (this.isScanning) {
                this.el.scanToggle.checked = false;
                this.el.scrollToggle.checked = false;
                this._stopScan();
            }

            this.sortState.direction = this.sortState.field === field
                ? (this.sortState.direction === 'desc' ? 'asc' : 'desc')
                : (['reviews', 'rating', 'price'].includes(field) ? 'desc' : 'asc');
            this.sortState.field = field;

            const { direction } = this.sortState;
            this.data.sort((a, b) => {
                const va = a[field], vb = b[field];
                if (field === 'title') return direction === 'desc'
                    ? (vb || '').toLowerCase().localeCompare((va || '').toLowerCase())
                    : (va || '').toLowerCase().localeCompare((vb || '').toLowerCase());
                return direction === 'desc' ? (vb || 0) - (va || 0) : (va || 0) - (vb || 0);
            });

            setTimeout(() => this._sortPageCards(field, direction), 100);
            this._updateSortArrows();
            this._renderTable();
            this._filterPageCards();
        }

        _updateSortArrows() {
            this.box.querySelectorAll('.sort-arrow').forEach(a => a.textContent = '');
            const th = this.box.querySelector(`[data-field="${this.sortState.field}"] .sort-arrow`);
            if (th) th.textContent = this.sortState.direction === 'desc' ? '▼' : '▲';
        }

        _makeDraggable(element, handle) {
            let dragging = false, ox = 0, oy = 0;
            handle.addEventListener('mousedown', e => {
                if (e.target.closest('#ozon-hide-btn')) return;
                dragging = true;
                ox = e.clientX - element.offsetLeft;
                oy = e.clientY - element.offsetTop;
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mouseup', () => { dragging = false; document.body.style.userSelect = ''; });
            document.addEventListener('mousemove', e => {
                if (!dragging) return;
                element.style.left = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, e.clientX - ox)) + 'px';
                element.style.top = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, e.clientY - oy)) + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            });
        }
    }

    const init = () => {
        if (window.__ozonScanner) return;
        try { window.__ozonScanner = new OZONScanner(); } catch (e) { console.error('OZON Scanner init error:', e); }
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : setTimeout(init, 500);

    window.addEventListener('beforeunload', () => {
        const s = window.__ozonScanner;
        if (s) { clearInterval(s.scanInterval); clearInterval(s.filterInterval); }
    });
})();
