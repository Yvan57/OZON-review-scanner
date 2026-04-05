// ==UserScript==
// @name         OZON Review Scanner (v2.6 Scanned Only)
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  OZON сканер отзывов с сортировкой только просканированных товаров и разделителем
// @match        https://www.ozon.ru/*
// @grant        GM_addStyle
// @run-at       document-end
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // --- Утилиты ---
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const safeParseInt = (value, fallback = 0) => {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? fallback : parsed;
    };

    const safeParseFloat = (value, fallback = NaN) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed;
    };

    // --- Компактные стили с разделителем ---
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600;700&display=swap');

        #ozon-scanner-box {
            position: fixed;
            top: 80px;
            right: 15px;
            width: 400px;
            height: 450px;
            background: #ffffff;
            color: #1a1a1a;
            font-size: 12px;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            z-index: 999999;
            display: none;
            flex-direction: column;
            resize: both;
            overflow: hidden;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: box-shadow 0.2s ease;
        }

        #ozon-scanner-box:hover {
            box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }

        #ozon-scanner-header {
            background: linear-gradient(135deg, #005bff 0%, #0041cc 100%);
            padding: 8px 12px;
            cursor: move;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-radius: 12px 12px 0 0;
            color: white;
            font-size: 13px;
        }

        .header-title {
            display: flex;
            align-items: center;
            font-size: 13px;
            font-weight: 600;
        }

        .header-title::before {
            content: '📱';
            margin-right: 6px;
            font-size: 14px;
        }

        #ozon-hide-btn {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 11px;
        }

        #ozon-hide-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }

        .scanner-body {
            padding: 8px;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 6px;
            overflow-y: auto;
        }

        .control-card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 6px;
            transition: all 0.2s ease;
        }

        .control-card:hover {
            background: #f1f3f4;
            border-color: rgba(0,91,255,0.2);
        }

        .control-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 0;
            gap: 6px;
        }

        .switch {
            display: flex;
            align-items: center;
            user-select: none;
            gap: 6px;
            font-weight: 500;
            font-size: 11px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: relative;
            width: 32px;
            height: 18px;
            background: #E5E5EA;
            border-radius: 9px;
            transition: all 0.2s ease;
            flex-shrink: 0;
            cursor: pointer;
        }

        .slider:before {
            content: "";
            position: absolute;
            height: 14px;
            width: 14px;
            left: 2px;
            bottom: 2px;
            background: white;
            border-radius: 7px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .switch input:checked + .slider {
            background: #005bff;
        }

        .switch input:checked + .slider:before {
            transform: translateX(14px);
        }

        .info-card {
            display: none;
            font-size: 10px;
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 8px;
            padding: 8px;
            line-height: 1.4;
            color: #1a1a1a;
        }

        .info-card strong {
            color: #005bff;
            font-weight: 600;
        }

        .modern-button {
            padding: 4px 8px;
            border: none;
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 10px;
            color: #005bff;
            transition: all 0.2s ease;
        }

        .modern-button:hover {
            background: #cce7ff;
            transform: translateY(-1px);
        }

        .modern-button:active {
            transform: scale(0.98);
        }

        .modern-button.danger {
            background: #ffe6e6;
            border-color: #ffb3b3;
            color: #FF3B30;
        }

        .modern-button.danger:hover {
            background: #ffcccc;
        }

        .modern-button.reset {
            background: #fff3cd;
            border-color: #ffeaa7;
            color: #856404;
        }

        .modern-button.reset:hover {
            background: #ffeaa7;
        }

        .table-container {
            flex: 1;
            overflow: auto;
            max-height: 200px;
            background: #ffffff;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }

        #ozon-results {
            margin: 0;
            border-collapse: separate;
            border-spacing: 0;
            width: 100%;
            font-size: 10px;
        }

        #ozon-results th, #ozon-results td {
            border: none;
            border-bottom: 1px solid #f0f0f0;
            padding: 6px 8px;
            text-align: left;
        }

        #ozon-results th {
            cursor: pointer;
            background: #f8f9fa;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 1;
            color: #1a1a1a;
            transition: all 0.2s ease;
            font-size: 10px;
        }

        #ozon-results th:hover {
            background: #e7f3ff;
            color: #005bff;
        }

        #ozon-results tbody tr {
            transition: all 0.2s ease;
        }

        #ozon-results tbody tr:hover {
            background: #f8f9fa;
        }

        .ozon-sort-arrow {
            float: right;
            font-size: 9px;
            color: #005bff;
            margin-left: 4px;
        }

        #ozon-toggle {
            position: fixed;
            top: 15px;
            right: 15px;
            width: 50px;
            height: 50px;
            background: #005bff;
            color: white;
            border: none;
            border-radius: 12px;
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            white-space: pre-line;
            font-size: 11px;
            cursor: move;
            box-shadow: 0 4px 16px rgba(0,91,255,0.3);
            transition: all 0.2s ease;
            font-weight: 600;
        }

        #ozon-toggle:hover {
            background: #0041cc;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,91,255,0.4);
        }

        .modern-input {
            flex: 1;
            padding: 4px 6px;
            font-size: 11px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background: #ffffff;
            color: #1a1a1a;
            font-family: inherit;
            transition: all 0.2s ease;
        }

        .modern-input:focus {
            outline: none;
            border-color: #005bff;
            box-shadow: 0 0 0 2px rgba(0,91,255,0.1);
        }

        .modern-input::placeholder {
            color: #8E8E93;
            font-size: 10px;
        }

        .modern-input.small {
            width: 45px;
            flex: none;
        }

        .status-indicator {
            width: 6px;
            height: 6px;
            border-radius: 3px;
            margin-right: 6px;
            background: #8E8E93;
            transition: all 0.2s ease;
        }

        .status-indicator.active {
            background: #34C759;
        }

        .status-indicator.scanning {
            background: #FF9500;
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
        }

        .loading {
            opacity: 0.6;
            transition: opacity 0.2s ease;
        }

        .stats-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #666;
            font-weight: 500;
        }

        .stats-number {
            color: #005bff;
            font-weight: 600;
        }

        .button-row {
            display: flex;
            gap: 4px;
        }

        /* Стили для разделителя между просканированными и непросканированными товарами */
        .ozon-scanner-separator {
            position: relative;
            width: 100%;
            height: 40px;
            margin: 20px 0;
            background: linear-gradient(90deg, transparent 0%, rgba(0,91,255,0.1) 20%, rgba(0,91,255,0.3) 50%, rgba(0,91,255,0.1) 80%, transparent 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }

        .ozon-scanner-separator::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent 0%, #005bff 50%, transparent 100%);
            transform: translateY(-50%);
        }

        .ozon-scanner-separator-text {
            background: #ffffff;
            padding: 6px 12px;
            border-radius: 12px;
            border: 2px solid #005bff;
            font-size: 11px;
            font-weight: 600;
            color: #005bff;
            z-index: 1;
            position: relative;
            box-shadow: 0 2px 8px rgba(0,91,255,0.2);
        }

        .ozon-scanner-separator-text::before {
            content: '📊';
            margin-right: 4px;
        }

        /* Кастомный скроллбар */
        .table-container::-webkit-scrollbar,
        .scanner-body::-webkit-scrollbar {
            width: 3px;
        }

        .table-container::-webkit-scrollbar-track,
        .scanner-body::-webkit-scrollbar-track {
            background: #f0f0f0;
            border-radius: 2px;
        }

        .table-container::-webkit-scrollbar-thumb,
        .scanner-body::-webkit-scrollbar-thumb {
            background: rgba(0,91,255,0.4);
            border-radius: 2px;
        }

        .table-container::-webkit-scrollbar-thumb:hover,
        .scanner-body::-webkit-scrollbar-thumb:hover {
            background: rgba(0,91,255,0.6);
        }

        /* Анимации появления */
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        #ozon-scanner-box.show {
            animation: slideIn 0.25s ease;
        }
    `);

    // --- UI создание ---
    const createUI = () => {
        const box = document.createElement('div');
        box.id = 'ozon-scanner-box';
        box.innerHTML = `
            <div id="ozon-scanner-header">
                <div class="header-title">
                    <div class="status-indicator" id="statusIndicator"></div>
                    OZON Сканер
                </div>
                <button id="ozon-hide-btn">✕</button>
            </div>
            <div class="scanner-body">
                <div class="control-card">
                    <div class="control-row">
                        <label class="switch">
                            <input type="checkbox" id="scanToggle">
                            <span class="slider"></span>
                            <span>Сканирование</span>
                        </label>
                        <button id="toggleInfo" class="modern-button">ℹ️</button>
                    </div>
                </div>

                <div class="control-card">
                    <div class="control-row">
                        <label class="switch">
                            <input type="checkbox" id="scrollToggle">
                            <span class="slider"></span>
                            <span>Автопрокрутка</span>
                        </label>
                        <input type="text" id="searchInput" class="modern-input" placeholder="🔍 Поиск ('точный', /regex/)">
                    </div>
                </div>

                <div class="control-card">
                    <div class="control-row">
                        <label class="switch">
                            <input type="checkbox" id="hideNoReview">
                            <span class="slider"></span>
                            <span>Мин. отзывов</span>
                        </label>
                        <input type="number" id="minReviews" class="modern-input small" min="0" value="1" title="Минимальное количество отзывов">
                    </div>
                </div>

                <div class="control-card">
                    <div class="stats-row">
                        <span id="itemCount">Товаров: <span class="stats-number">0</span></span>
                        <div class="button-row">
                            <button id="resetSort" class="modern-button reset">↺ Сброс</button>
                            <button id="clearData" class="modern-button danger">🗑 Очистить</button>
                        </div>
                    </div>
                </div>

                <div id="ozon-info" class="info-card">
                    <strong>📱 Инструкция:</strong><br>
                    ✅ <strong>Сканирование</strong> — сбор товаров на странице<br>
                    🔄 <strong>Автопрокрутка</strong> — прокрутка для сбора всех товаров<br>
                    🔍 <strong>Поиск:</strong> обычный, 'точный' или /regex/<br>
                    📊 Клик по заголовку для сортировки (только просканированные)<br>
                    📏 <strong>Разделитель</strong> — граница между просканированными товарами<br>
                    ↺ <strong>Сброс</strong> — возврат к исходному порядку<br>
                    🔗 Название товара — ссылка на страницу
                </div>

                <div class="table-container">
                    <table id="ozon-results">
                        <thead>
                            <tr>
                                <th id="sortTitle">Товар <span class="ozon-sort-arrow"></span></th>
                                <th id="sortReviews">Отзывы <span class="ozon-sort-arrow">▼</span></th>
                                <th id="sortRating">Оценка <span class="ozon-sort-arrow"></span></th>
                                <th id="sortPrice">Цена <span class="ozon-sort-arrow"></span></th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>`;
        document.body.appendChild(box);

        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'ozon-toggle';
        toggleBtn.innerHTML = '📱<br>OZON<br>Сканер';
        document.body.appendChild(toggleBtn);

        return { box, toggleBtn };
    };

    // --- Основной класс ---
    class OZONScanner {
        constructor() {
            this.data = [];
            this.scanInterval = null;
            this.filterInterval = null;
            this.sortState = { field: 'reviews', direction: 'desc' };
            this.isScanning = false;
            this.infoVisible = false;
            this.originalOrder = []; // Сохраняем исходный порядок карточек
            this.scannedLinks = new Set(); // Сет ссылок просканированных товаров

            const { box, toggleBtn } = createUI();
            this.box = box;
            this.toggleBtn = toggleBtn;

            this.initElements();
            this.loadSettings();
            this.bindEvents();
            this.makeDraggable();

            // Сохраняем исходный порядок карточек
            this.saveOriginalOrder();

            // Запуск постоянной фильтрации
            this.startConstantFiltering();

            if (this.scanToggle.checked) {
                this.startScan();
            }
        }

        initElements() {
            this.scanToggle = this.box.querySelector('#scanToggle');
            this.scrollToggle = this.box.querySelector('#scrollToggle');
            this.searchInput = this.box.querySelector('#searchInput');
            this.minReviewsInput = this.box.querySelector('#minReviews');
            this.hideNoReviewToggle = this.box.querySelector('#hideNoReview');
            this.itemCount = this.box.querySelector('#itemCount');
            this.tbody = this.box.querySelector('#ozon-results tbody');
            this.statusIndicator = this.box.querySelector('#statusIndicator');
            this.infoBlock = this.box.querySelector('#ozon-info');
        }

        loadSettings() {
            this.scanToggle.checked = false;
            this.scrollToggle.checked = false;

            this.hideNoReviewToggle.checked = JSON.parse(localStorage.getItem('hideNoReview') || 'false');
            this.minReviewsInput.value = safeParseInt(localStorage.getItem('minReviews') || '1', 1);
        }

        saveSettings() {
            localStorage.setItem('hideNoReview', this.hideNoReviewToggle.checked);
            localStorage.setItem('minReviews', this.minReviewsInput.value);
        }

        // Сохраняем исходный порядок карточек с их контейнерами
        saveOriginalOrder() {
            const cards = document.querySelectorAll('.tile-root[data-index]');
            this.originalOrder = Array.from(cards).map(card => ({
                element: card,
                parent: card.parentElement,
                nextSibling: card.nextElementSibling
            }));
            console.log(`💾 Сохранен исходный порядок из ${this.originalOrder.length} карточек`);
        }

        // Восстанавливаем исходный порядок карточек
        restoreOriginalOrder() {
            console.log('🔄 Восстанавливаем исходный порядок карточек');

            // Убираем разделитель если он есть
            this.removeSeparator();

            this.originalOrder.forEach(({ element, parent, nextSibling }) => {
                if (element.parentElement !== parent) {
                    if (nextSibling && nextSibling.parentElement === parent) {
                        parent.insertBefore(element, nextSibling);
                    } else {
                        parent.appendChild(element);
                    }
                }
            });

            // Сбрасываем состояние сортировки
            this.sortState = { field: 'reviews', direction: 'desc' };
            this.updateSortArrows();

            console.log('✅ Исходный порядок восстановлен');
        }

        startConstantFiltering() {
            this.filterInterval = setInterval(() => {
                this.filterPageCards();
            }, 500);
        }

        bindEvents() {
            this.scanToggle.addEventListener('change', () => {
                this.scanToggle.checked ? this.startScan() : this.stopScan();
                if (!this.scanToggle.checked && this.scrollToggle.checked) {
                    this.scrollToggle.checked = false;
                }
            });

            this.scrollToggle.addEventListener('change', () => {
                if (this.scrollToggle.checked && !this.scanToggle.checked) {
                    this.scanToggle.checked = true;
                    this.startScan();
                }
            });

            const debouncedFilter = debounce(() => {
                this.renderTable();
                this.filterPageCards();
            }, 300);

            this.searchInput.addEventListener('input', debouncedFilter);

            this.minReviewsInput.addEventListener('change', () => {
                this.saveSettings();
                debouncedFilter();
            });

            this.hideNoReviewToggle.addEventListener('change', () => {
                this.saveSettings();
                debouncedFilter();
            });

            this.box.querySelector('#toggleInfo').addEventListener('click', () => {
                this.infoVisible = !this.infoVisible;
                this.infoBlock.style.display = this.infoVisible ? 'block' : 'none';
            });

            this.box.querySelector('#ozon-hide-btn').addEventListener('click', () => {
                this.box.style.display = 'none';
                this.toggleBtn.style.display = 'flex';
            });

            this.toggleBtn.addEventListener('click', () => {
                this.box.style.display = 'flex';
                this.box.classList.add('show');
                this.toggleBtn.style.display = 'none';
                setTimeout(() => this.box.classList.remove('show'), 250);
            });

            this.box.querySelector('#clearData').addEventListener('click', () => {
                if (confirm('🗑 Очистить все собранные данные о товарах?')) {
                    this.data = [];
                    this.scannedLinks.clear();
                    this.removeSeparator();
                    this.renderTable();
                }
            });

            // Кнопка сброса сортировки
            this.box.querySelector('#resetSort').addEventListener('click', () => {
                this.restoreOriginalOrder();
            });

            ['sortTitle', 'sortReviews', 'sortRating', 'sortPrice'].forEach(id => {
                const element = this.box.querySelector(`#${id}`);
                if (element) {
                    element.addEventListener('click', () => {
                        this.handleSort(id.replace('sort', '').toLowerCase());
                    });
                }
            });
        }

        startScan() {
            if (this.scanInterval) return;

            this.isScanning = true;
            this.updateStatus();
            this.runScan();
            this.scanInterval = setInterval(() => this.runScan(), 1000);
        }

        stopScan() {
            if (this.scanInterval) {
                clearInterval(this.scanInterval);
                this.scanInterval = null;
            }
            this.isScanning = false;
            this.updateStatus();
        }

        updateStatus() {
            this.statusIndicator.className = 'status-indicator';
            if (this.isScanning) {
                this.statusIndicator.classList.add('scanning');
            } else if (this.data.length > 0) {
                this.statusIndicator.classList.add('active');
            }
        }

        runScan() {
            if (this.scrollToggle.checked) {
                window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });
            }

            this.collectData();
            this.renderTable();
            this.filterPageCards();
        }

        collectData() {
            const cards = document.querySelectorAll('.tile-root[data-index]');
            let newItems = 0;

            cards.forEach(card => {
                try {
                    const data = this.extractCardData(card);
                    if (data && !this.data.some(x => x.link === data.link)) {
                        this.data.push(data);
                        this.scannedLinks.add(data.link); // Добавляем ссылку в сет просканированных
                        newItems++;
                    }
                } catch (error) {
                    console.warn('Ошибка при обработке карточки:', error);
                }
            });

            if (this.data.length > 1000) {
                this.data = this.data.slice(-1000);
                // Обновляем сет ссылок после обрезки данных
                this.scannedLinks.clear();
                this.data.forEach(item => this.scannedLinks.add(item.link));
            }
        }

        extractCardData(card) {
            const linkElement = card.querySelector('a.tile-clickable-element');
            const link = linkElement?.href?.split('?')[0];
            const title = card.querySelector('span.tsBody500Medium')?.textContent?.trim();

            if (!link || !title) return null;

            const ratingText = [...card.querySelectorAll('span')]
                .map(s => s.textContent.trim())
                .find(t => /^\d\.\d$/.test(t));
            const rating = safeParseFloat(ratingText);

            const reviewText = [...card.querySelectorAll('span')]
                .map(s => s.textContent)
                .find(t => /\d[\d\s]*\s+отзыв/.test(t));
            const reviews = safeParseInt(reviewText?.replace(/\D/g, ''));

            const priceText = [...card.querySelectorAll('span')]
                .map(s => s.textContent.replace(/\s/g, ''))
                .find(t => /^\d+₽$/.test(t));
            const price = safeParseInt(priceText?.replace('₽', ''));

            return { title, link, rating, reviews, price };
        }

        createSearchMatcher(query) {
            if (!query) return () => true;

            if (query.startsWith('"') && query.endsWith('"')) {
                const exact = query.slice(1, -1).toLowerCase();
                return text => text.toLowerCase().includes(exact);
            }

            if (query.startsWith('/') && query.endsWith('/')) {
                try {
                    const regex = new RegExp(query.slice(1, -1), 'i');
                    return text => regex.test(text);
                } catch {
                    const escaped = query.slice(1, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escaped, 'i');
                    return text => regex.test(text);
                }
            }

            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'i');
            return text => regex.test(text);
        }

        getFilteredData() {
            let filtered = [...this.data];

            const searchQuery = this.searchInput.value.trim();
            if (searchQuery) {
                const matcher = this.createSearchMatcher(searchQuery);
                filtered = filtered.filter(item => matcher(item.title));
            }

            if (this.hideNoReviewToggle.checked) {
                const minReviews = safeParseInt(this.minReviewsInput.value);
                filtered = filtered.filter(item => item.reviews >= minReviews);
            }

            return filtered;
        }

        renderTable() {
            this.tbody.classList.add('loading');

            setTimeout(() => {
                const filtered = this.getFilteredData();

                this.tbody.innerHTML = '';

                filtered.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><a href="${item.link}" target="_blank" style="color: #005bff; text-decoration: none; font-weight: 500;" title="${item.title}">${item.title}</a></td>
                        <td style="font-weight: 600; color: ${item.reviews > 0 ? '#005bff' : '#999'}">${item.reviews || '—'}</td>
                        <td style="font-weight: 600; color: ${!isNaN(item.rating) ? '#FF9500' : '#999'}">${isNaN(item.rating) ? '—' : '⭐' + item.rating.toFixed(1)}</td>
                        <td style="font-weight: 600; color: ${item.price ? '#34C759' : '#999'}">${item.price ? item.price + '₽' : '—'}</td>
                    `;
                    this.tbody.appendChild(tr);
                });

                this.itemCount.innerHTML = `Товаров: <span class="stats-number">${filtered.length}</span>${this.data.length !== filtered.length ? ` из <span class="stats-number">${this.data.length}</span>` : ''}`;
                this.tbody.classList.remove('loading');
                this.updateStatus();
            }, 0);
        }

        filterPageCards() {
            const searchQuery = this.searchInput.value.trim();
            const minReviews = safeParseInt(this.minReviewsInput.value);
            const hideNoReview = this.hideNoReviewToggle.checked;

            const allCards = document.querySelectorAll('.tile-root[data-index]');

            if (!searchQuery && !hideNoReview) {
                allCards.forEach(card => {
                    card.style.display = '';
                });
                return;
            }

            const searchMatcher = this.createSearchMatcher(searchQuery);

            allCards.forEach(card => {
                try {
                    const title = card.querySelector('span.tsBody500Medium')?.textContent?.trim() || '';
                    let shouldHide = false;

                    if (searchQuery && !searchMatcher(title)) {
                        shouldHide = true;
                    }

                    if (!shouldHide && hideNoReview) {
                        const reviewText = [...card.querySelectorAll('span')]
                            .map(s => s.textContent)
                            .find(t => /\d[\d\s]*\s+отзыв/.test(t));

                        const reviewCount = reviewText ? safeParseInt(reviewText.replace(/\D/g, '')) : 0;

                        if (reviewCount < minReviews) {
                            shouldHide = true;
                        }
                    }

                    card.style.display = shouldHide ? 'none' : '';
                } catch (error) {
                    console.warn('Ошибка при фильтрации карточки:', error);
                }
            });
        }

        // Создание разделителя между просканированными и непросканированными товарами
        createSeparator() {
            const separator = document.createElement('div');
            separator.className = 'ozon-scanner-separator';
            separator.id = 'ozon-scanner-separator';
            separator.innerHTML = '<div class="ozon-scanner-separator-text">Просканированные товары выше</div>';
            return separator;
        }

        // Удаление разделителя
        removeSeparator() {
            const existingSeparator = document.getElementById('ozon-scanner-separator');
            if (existingSeparator) {
                existingSeparator.remove();
            }
        }

        // Функция для поиска границы между просканированными и непросканированными товарами
        findScanBoundary() {
            const allCards = [...document.querySelectorAll('.tile-root[data-index]')];

            for (let i = 0; i < allCards.length; i++) {
                const card = allCards[i];
                const linkElement = card.querySelector('a.tile-clickable-element');
                const link = linkElement?.href?.split('?')[0];

                if (link && !this.scannedLinks.has(link)) {
                    return i; // Возвращаем индекс первой непросканированной карточки
                }
            }

            return allCards.length; // Все карточки просканированы
        }

        // Размещение разделителя на странице
        placeSeparator() {
            this.removeSeparator(); // Удаляем старый разделитель если есть

            if (this.scannedLinks.size === 0) return; // Нет просканированных товаров

            const boundaryIndex = this.findScanBoundary();
            const allCards = [...document.querySelectorAll('.tile-root[data-index]')];

            if (boundaryIndex < allCards.length) {
                const boundaryCard = allCards[boundaryIndex];
                const separator = this.createSeparator();

                // Вставляем разделитель перед первой непросканированной карточкой
                boundaryCard.parentElement.insertBefore(separator, boundaryCard);

                console.log(`📏 Разделитель размещен перед карточкой ${boundaryIndex + 1} из ${allCards.length}`);
            }
        }

        // Функция сортировки только просканированных карточек
        sortPageCards(field, direction) {
            console.log('🔄 Начинаем сортировку только просканированных товаров по полю:', field);

            if (this.scannedLinks.size === 0) {
                console.warn('❌ Нет просканированных товаров для сортировки');
                return;
            }

            // Собираем все контейнеры с карточками
            const containers = [...document.querySelectorAll('.w5i_24')].filter(container =>
                container.querySelector('.tile-root[data-index]')
            );

            if (containers.length === 0) {
                console.warn('❌ Контейнеры с карточками не найдены');
                return;
            }

            // Собираем только просканированные карточки
            let scannedCards = [];
            containers.forEach(container => {
                const cards = [...container.querySelectorAll('.tile-root[data-index]')];
                cards.forEach(card => {
                    const linkElement = card.querySelector('a.tile-clickable-element');
                    const link = linkElement?.href?.split('?')[0];

                    if (link && this.scannedLinks.has(link)) {
                        scannedCards.push({
                            element: card,
                            container: container,
                            link: link
                        });
                    }
                });
            });

            console.log(`📊 Найдено ${scannedCards.length} просканированных карточек для сортировки`);

            if (scannedCards.length === 0) return;

            // Сортируем только просканированные карточки
            scannedCards.sort((a, b) => {
                try {
                    let valueA, valueB;

                    if (field === 'title') {
                        valueA = (a.element.querySelector('span.tsBody500Medium')?.textContent?.trim() || '').toLowerCase();
                        valueB = (b.element.querySelector('span.tsBody500Medium')?.textContent?.trim() || '').toLowerCase();
                        return direction === 'desc' ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
                    }

                    if (field === 'reviews') {
                        const reviewTextA = [...a.element.querySelectorAll('span')].map(s => s.textContent).find(t => /\d[\d\s]*\s+отзыв/.test(t));
                        const reviewTextB = [...b.element.querySelectorAll('span')].map(s => s.textContent).find(t => /\d[\d\s]*\s+отзыв/.test(t));
                        valueA = reviewTextA ? safeParseInt(reviewTextA.replace(/\D/g, '')) : 0;
                        valueB = reviewTextB ? safeParseInt(reviewTextB.replace(/\D/g, '')) : 0;
                    }

                    if (field === 'rating') {
                        const ratingTextA = [...a.element.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /^\d\.\d$/.test(t));
                        const ratingTextB = [...b.element.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /^\d\.\d$/.test(t));
                        valueA = ratingTextA ? safeParseFloat(ratingTextA) : 0;
                        valueB = ratingTextB ? safeParseFloat(ratingTextB) : 0;
                    }

                    if (field === 'price') {
                        const priceTextA = [...a.element.querySelectorAll('span')].map(s => s.textContent.replace(/\s/g, '')).find(t => /^\d+₽$/.test(t));
                        const priceTextB = [...b.element.querySelectorAll('span')].map(s => s.textContent.replace(/\s/g, '')).find(t => /^\d+₽$/.test(t));
                        valueA = priceTextA ? safeParseInt(priceTextA.replace('₽', '')) : 0;
                        valueB = priceTextB ? safeParseInt(priceTextB.replace('₽', '')) : 0;
                    }

                    return direction === 'desc' ? valueB - valueA : valueA - valueB;
                } catch (error) {
                    console.warn('⚠️ Ошибка при сортировке карточки:', error);
                    return 0;
                }
            });

            // Удаляем просканированные карточки из их текущих позиций
            scannedCards.forEach(({ element }) => element.remove());

            // Равномерно распределяем отсортированные просканированные карточки по контейнерам
            const cardsPerContainer = Math.ceil(scannedCards.length / containers.length);

            containers.forEach((container, containerIndex) => {
                const startIndex = containerIndex * cardsPerContainer;
                const endIndex = Math.min(startIndex + cardsPerContainer, scannedCards.length);

                const fragment = document.createDocumentFragment();
                for (let i = startIndex; i < endIndex; i++) {
                    if (scannedCards[i]) {
                        fragment.appendChild(scannedCards[i].element);
                    }
                }

                // Вставляем просканированные карточки в начало контейнера
                if (container.firstChild) {
                    container.insertBefore(fragment, container.firstChild);
                } else {
                    container.appendChild(fragment);
                }
            });

            // Размещаем разделитель после сортировки
            setTimeout(() => {
                this.placeSeparator();
            }, 100);

            console.log('✅ Сортировка просканированных карточек завершена с разделителем');
        }

        handleSort(field) {
            if (this.isScanning) {
                this.scanToggle.checked = false;
                this.scrollToggle.checked = false;
                this.stopScan();
            }

            if (this.sortState.field === field) {
                this.sortState.direction = this.sortState.direction === 'desc' ? 'asc' : 'desc';
            } else {
                this.sortState.field = field;
                this.sortState.direction = field === 'reviews' || field === 'rating' || field === 'price' ? 'desc' : 'asc';
            }

            // Сортировка данных в таблице
            this.data.sort((a, b) => {
                let valueA = a[field];
                let valueB = b[field];

                if (field === 'title') {
                    valueA = (valueA || '').toLowerCase();
                    valueB = (valueB || '').toLowerCase();
                    return this.sortState.direction === 'desc'
                        ? valueB.localeCompare(valueA)
                        : valueA.localeCompare(valueB);
                }

                valueA = valueA || 0;
                valueB = valueB || 0;

                return this.sortState.direction === 'desc'
                    ? valueB - valueA
                    : valueA - valueB;
            });

            // Сортировка только просканированных карточек на сайте
            setTimeout(() => {
                this.sortPageCards(field, this.sortState.direction);
            }, 100);

            this.updateSortArrows();
            this.renderTable();
            this.filterPageCards();
        }

        updateSortArrows() {
            this.box.querySelectorAll('.ozon-sort-arrow').forEach(arrow => {
                arrow.textContent = '';
            });

            const activeArrow = this.box.querySelector(`#sort${this.sortState.field.charAt(0).toUpperCase() + this.sortState.field.slice(1)} .ozon-sort-arrow`);
            if (activeArrow) {
                activeArrow.textContent = this.sortState.direction === 'desc' ? '▼' : '▲';
            }
        }

        // Возвращаем обычное перетаскивание без синхронизации
        makeDraggable() {
            const makeDraggable = (element, handle) => {
                let isDragging = false;
                let offset = { x: 0, y: 0 };

                const onMouseDown = (e) => {
                    if (e.target.closest('#ozon-hide-btn')) return;
                    isDragging = true;
                    offset.x = e.clientX - element.offsetLeft;
                    offset.y = e.clientY - element.offsetTop;
                    document.body.style.userSelect = 'none';
                };

                const onMouseUp = () => {
                    isDragging = false;
                    document.body.style.userSelect = '';
                };

                const onMouseMove = (e) => {
                    if (!isDragging) return;

                    const x = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, e.clientX - offset.x));
                    const y = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, e.clientY - offset.y));

                    element.style.left = x + 'px';
                    element.style.top = y + 'px';
                    element.style.right = 'auto';
                    element.style.bottom = 'auto';
                };

                handle.addEventListener('mousedown', onMouseDown);
                document.addEventListener('mouseup', onMouseUp);
                document.addEventListener('mousemove', onMouseMove);
            };

            makeDraggable(this.box, this.box.querySelector('#ozon-scanner-header'));
            makeDraggable(this.toggleBtn, this.toggleBtn);
        }
    }

    // --- Инициализация ---
    let scanner = null;

    const init = () => {
        if (scanner) return;

        try {
            scanner = new OZONScanner();
            console.log('🚀 OZON Scanner с сортировкой только просканированных товаров инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации OZON Scanner:', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }

    window.addEventListener('beforeunload', () => {
        if (scanner?.scanInterval) {
            clearInterval(scanner.scanInterval);
        }
        if (scanner?.filterInterval) {
            clearInterval(scanner.filterInterval);
        }
    });

})();