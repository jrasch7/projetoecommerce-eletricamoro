/**
 * main-components.js
 * Centraliza header, footer, carrinho e modais.
 * Gerencia dados via API (com fallback mock) e eventos globais.
 */

(function(global) {
    'use strict';

    // ---------- CONSTANTES ----------
    const CART_STORAGE_KEY = 'eletrica_moro_cart';
    const CATEGORY_HISTORY_KEY = 'eletrica_moro_category_history';
    const IMAGE_PLACEHOLDER = 'https://placehold.co/300x300/f3f4f6/9ca3af?text=Produto';
    let cartItems = [];

    // Global image fallback: any <img> that fails to load gets the placeholder.
    // Uses capture phase since `error` events don't bubble.
    document.addEventListener('error', (e) => {
        const el = e.target;
        if (el && el.tagName === 'IMG' && !el.dataset.fallbackApplied) {
            el.dataset.fallbackApplied = '1';
            el.src = IMAGE_PLACEHOLDER;
        }
    }, true);

    // ---------- API ----------
    async function fetchCategories() {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Falha ao carregar categorias');
        return res.json();
    }

    async function fetchSuggestedProducts(categoryIds = null) {
        const url = categoryIds 
            ? `/api/products/suggested?categoryIds=${categoryIds}`
            : '/api/products/suggested';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Falha ao carregar produtos sugeridos');
        return res.json();
    }

    // ---------- CATEGORY HISTORY TRACKING ----------
    function trackCategoryVisit(categoryId) {
        if (!categoryId) return;
        
        try {
            let history = JSON.parse(localStorage.getItem(CATEGORY_HISTORY_KEY)) || [];
            
            // Remove if already exists (to move to front)
            history = history.filter(id => id !== categoryId);
            
            // Add to front
            history.unshift(categoryId);
            
            // Keep only last 3
            history = history.slice(0, 3);
            
            localStorage.setItem(CATEGORY_HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.warn('Erro ao rastrear visita à categoria:', e);
        }
    }

    function getCategoryHistory() {
        try {
            return JSON.parse(localStorage.getItem(CATEGORY_HISTORY_KEY)) || [];
        } catch {
            return [];
        }
    }

    // ---------- COMPONENTES COMPARTILHADOS ----------
    function renderProductCard(product) {
        const price = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
        const parcelas = 3;
        const valorParcela = price / parcelas;
        const desconto = product.on_sale ? Math.floor(Math.random() * 12 + 5) : 0;
        const precoFinal = desconto > 0 ? (price * (1 - desconto / 100)).toFixed(2) : price.toFixed(2);

        let imageUrl = 'https://placehold.co/300x300/f3f4f6/9ca3af?text=Produto';
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            imageUrl = product.images[0];
        } else if (product.image_url) {
            imageUrl = product.image_url;
        }

        const orderCount = product.orderCount || 0;
        const badges = [];
        if (orderCount > 0) badges.push('<span class="pcard-badge" style="background:#16a34a">Mais Vendido</span>');
        else if (product.is_featured) badges.push('<span class="pcard-badge" style="background:#2563eb">Destaque</span>');
        if (desconto > 0) {
            const left = (orderCount > 0 || product.is_featured) ? 'left:76px' : 'left:12px';
            badges.push(`<span class="pcard-badge" style="background:var(--color-accent);${left}">-${desconto}%</span>`);
        }

        const productJson = JSON.stringify({ id: product.id, name: product.name, price, image: imageUrl }).replace(/'/g, "&apos;");

        return `<div class="pcard">
            <div class="pcard-badges">${badges.join('')}</div>
            <a href="/produto.html?id=${product.id}" class="pcard-img-wrap">
                <img src="${imageUrl}" alt="${product.name}" loading="lazy" class="pcard-img" onerror="this.src='https://placehold.co/300x300/f3f4f6/9ca3af?text=Produto'">
            </a>
            <div class="pcard-body">
                <p class="pcard-brand">${product.brand || '&nbsp;'}</p>
                <h3 class="pcard-name"><a href="/produto.html?id=${product.id}">${product.name}</a></h3>
                <div class="pcard-price-wrap">
                    ${desconto > 0 ? `<span class="pcard-oldprice">R$ ${price.toFixed(2)}</span>` : ''}
                    <span class="pcard-price">R$ ${precoFinal}</span>
                    <p class="pcard-installment">${parcelas}x R$ ${valorParcela.toFixed(2)} sem juros</p>
                </div>
                <button class="pcard-btn add-to-cart-btn" data-product='${productJson}'>
                    <i class="ph ph-shopping-cart-simple"></i> Adicionar
                </button>
            </div>
        </div>`;
    }

    // ---------- RENDERIZAÇÃO DO HEADER ----------
    function renderHeader() {
        const headerPlaceholder = document.getElementById('global-header');
        if (!headerPlaceholder) return;

        // Announcement bar text from config (loaded async, updated later)
        const cfg = window.storeConfig || {};
        const bannerText = cfg.bannerText || '🚚 Entrega ágil para todo o Brasil  ·  🔧 Assistência técnica especializada  ·  💳 Parcele em até 3x sem juros';
        const bannerEnabled = cfg.bannerEnabled !== false;

        headerPlaceholder.innerHTML = `
            ${bannerEnabled ? `<!-- Announcement Bar -->
            <div id="announcement-bar" style="background:var(--color-accent);color:white;height:34px;display:flex;align-items:center;overflow:hidden;position:relative;font-size:12px;font-weight:500;">
                <div style="mask-image:linear-gradient(to right,transparent,black 8%,black 92%,transparent);-webkit-mask-image:linear-gradient(to right,transparent,black 8%,black 92%,transparent);width:100%;overflow:hidden;">
                    <div class="animate-slide" id="announcement-text">${bannerText.split('·').map(t => `<span style="padding:0 2.5rem;">${t.trim()}</span>`).join('')}${bannerText.split('·').map(t => `<span style="padding:0 2.5rem;">${t.trim()}</span>`).join('')}</div>
                </div>
            </div>` : ''}
            <!-- Main Header -->
            <header id="main-header" style="background:var(--color-primary);position:sticky;top:0;z-index:100;transition:box-shadow .3s;">
                <div style="max-width:1280px;margin:0 auto;padding:0 1.25rem;height:72px;display:flex;align-items:center;gap:1.5rem;">
                    <!-- Logo -->
                    <a href="/" style="flex-shrink:0;display:flex;align-items:center;">
                        <img id="header-logo" src="${cfg.logo || 'img/logo-moro.webp'}" alt="${cfg.storeName || 'Loja'}" style="height:42px;width:auto;object-fit:contain;filter:brightness(0) invert(1);" onerror="this.style.display='none';document.getElementById('header-logo-text').style.display='flex'">
                        <span id="header-logo-text" style="display:none;font-weight:800;font-size:1.25rem;color:#fff;letter-spacing:-.02em;">${cfg.storeName || 'Elétrica Moro'}</span>
                    </a>
                    <!-- Search -->
                    <form id="header-search-form" style="flex:1;max-width:600px;position:relative;" onsubmit="event.preventDefault();const v=document.getElementById('header-search-input').value.trim();if(v)window.location.href='/categoria.html?search='+encodeURIComponent(v);">
                        <div style="display:flex;align-items:center;background:rgba(255,255,255,.15);border-radius:10px;border:1.5px solid rgba(255,255,255,.2);transition:all .25s;overflow:hidden;" id="search-box">
                            <i class="ph ph-magnifying-glass" style="padding:0 .75rem;font-size:1.1rem;color:rgba(255,255,255,.6);flex-shrink:0;"></i>
                            <input id="header-search-input" type="search" placeholder="Buscar produtos..." autocomplete="off"
                                style="flex:1;background:transparent;border:none;outline:none;padding:.7rem 0;font-size:.85rem;color:#fff;" 
                                onfocus="document.getElementById('search-box').style.background='rgba(255,255,255,.25)';document.getElementById('search-box').style.borderColor='rgba(255,255,255,.4)'"
                                onblur="document.getElementById('search-box').style.background='rgba(255,255,255,.15)';document.getElementById('search-box').style.borderColor='rgba(255,255,255,.2)'">
                            <button type="submit" style="background:rgba(255,255,255,.2);color:white;border:none;padding:.7rem 1.25rem;font-size:.78rem;font-weight:600;cursor:pointer;flex-shrink:0;transition:background .2s;" onmouseenter="this.style.background='rgba(255,255,255,.35)'" onmouseleave="this.style.background='rgba(255,255,255,.2)'">Buscar</button>
                        </div>
                    </form>
                    <!-- Nav icons -->
                    <nav style="display:flex;align-items:center;gap:.25rem;flex-shrink:0;">
                        <div id="accountWidget" style="position:relative;">
                            <button style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:.625rem;background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.85);font-size:.85rem;font-weight:500;transition:background .2s;" onmouseenter="this.style.background='rgba(255,255,255,.12)'" onmouseleave="this.style.background='transparent'">
                                <i class="ph ph-user" style="font-size:1.3rem;"></i>
                                <span class="hide-mobile">Conta</span>
                            </button>
                        </div>
                        <button onclick="AppCore.toggleCart()" style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:.625rem;background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.85);font-size:.85rem;font-weight:500;transition:background .2s;position:relative;" onmouseenter="this.style.background='rgba(255,255,255,.12)'" onmouseleave="this.style.background='transparent'">
                            <div style="position:relative;">
                                <i class="ph ph-shopping-bag" style="font-size:1.3rem;"></i>
                                <span id="cartCount" style="display:none;position:absolute;top:-7px;right:-7px;background:var(--color-accent);color:white;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;padding:0 4px;">0</span>
                            </div>
                            <span class="hide-mobile">Carrinho</span>
                        </button>
                    </nav>
                </div>
            </header>
            <!-- Category Nav -->
            <nav id="category-nav" style="background:#fff;border-bottom:1px solid #f0f0f0;">
                <div style="max-width:1280px;margin:0 auto;padding:0 1.25rem;">
                    <ul id="dynamicMenu" style="display:flex;align-items:center;gap:0;list-style:none;margin:0;padding:0;overflow-x:auto;scrollbar-width:none;white-space:nowrap;">
                        <li><a href="/categoria.html" style="display:flex;align-items:center;gap:.35rem;padding:.75rem 1rem;font-size:.83rem;font-weight:600;color:var(--color-primary);text-decoration:none;border-bottom:2px solid var(--color-primary);"><i class="ph ph-squares-four"></i> Todas</a></li>
                    </ul>
                </div>
            </nav>
        `;

        // Update announcement bar when config loads
        window.addEventListener('themeLoaded', (e) => {
            const c = e.detail || {};
            const bar = document.getElementById('announcement-bar');
            const textEl = document.getElementById('announcement-text');
            if (bar && c.bannerEnabled === false) bar.style.display = 'none';
            if (textEl && c.bannerText) {
                const parts = c.bannerText.split('·').map(t => `<span style="padding:0 2.5rem;">${t.trim()}</span>`).join('');
                textEl.innerHTML = parts + parts;
            }
            // Update logo
            const logo = document.getElementById('header-logo');
            const logoText = document.getElementById('header-logo-text');
            if (logo && c.logo) logo.src = c.logo;
            if (logoText && c.storeName) logoText.textContent = c.storeName;
        });

        // Scroll shadow effect
        window.addEventListener('scroll', () => {
            const h = document.getElementById('main-header');
            if (h) h.style.boxShadow = window.scrollY > 10 ? '0 4px 24px rgba(0,0,0,.15)' : 'none';
        });

        populateMegaMenu();
    }



    async function populateMegaMenu() {
        const menu = document.getElementById('dynamicMenu');
        if (!menu) return;

        const categories = await fetchCategories();
        // Preservar primeiro item "Todas as Categorias"
        const firstItem = menu.firstElementChild;
        menu.innerHTML = '';
        menu.appendChild(firstItem);

        categories.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="/categoria.html?categoryId=${cat.id}" style="display:block;padding:.75rem 1rem;font-size:.83rem;font-weight:500;color:#374151;text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent;transition:all .2s;" onmouseenter="this.style.color='var(--color-primary)';this.style.borderBottomColor='var(--color-primary)'" onmouseleave="this.style.color='#374151';this.style.borderBottomColor='transparent'">${cat.name}</a>`;
            menu.appendChild(li);
        });
    }

    // ---------- RENDERIZAÇÃO DO FOOTER ----------
    async function renderFooter() {
        const footerPlaceholder = document.getElementById('global-footer');
        if (!footerPlaceholder) return;

        // Fetch store config for dynamic data
        let config = {};
        try {
            const configRes = await fetch('/api/config');
            const configData = await configRes.json();
            config = configData.config || {};
        } catch (err) {
            console.warn('Failed to load config for footer, using defaults:', err);
        }

        const year = new Date().getFullYear();
        const logo = config.logo || 'img/logo-moro.webp';
        const footerText = config.footerText || `© ${year} Elétrica Moro. CNPJ: 07.907.008/0001-85.`;
        const instagramUrl = config.instagramUrl || 'https://www.instagram.com/eletricamorooficial/';
        const facebookUrl = config.facebookUrl || 'https://www.facebook.com/eletricamoro/?locale=pt_BR';
        const whatsappUrl = config.whatsappUrl || '';

        // Format WhatsApp URL if it's just a number
        let whatsappLink = whatsappUrl;
        if (whatsappUrl && !whatsappUrl.startsWith('http')) {
            whatsappLink = `https://wa.me/${whatsappUrl.replace(/\D/g, '')}`;
        }

        footerPlaceholder.innerHTML = `
            <footer style="background:#111827;color:rgba(255,255,255,.7);font-size:.83rem;">
                <div style="max-width:1280px;margin:0 auto;padding:2rem 1.25rem 1rem;">
                    <!-- Top row: Logo + Links -->
                    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:2rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(255,255,255,.08);">
                        <div style="display:flex;flex-direction:column;gap:.75rem;">
                            <img src="${logo}" alt="Logo" style="height:32px;width:auto;object-fit:contain;filter:brightness(0) invert(1);opacity:.9;" onerror="this.style.display='none'">
                            <div style="display:flex;gap:.5rem;">
                                ${instagramUrl ? `<a href="${instagramUrl}" target="_blank" rel="noopener" style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5);text-decoration:none;transition:all .2s;" onmouseenter="this.style.background='var(--color-accent)';this.style.color='#fff'" onmouseleave="this.style.background='rgba(255,255,255,.08)';this.style.color='rgba(255,255,255,.5)'"><i class="ph ph-instagram-logo" style="font-size:1rem;"></i></a>` : ''}
                                ${facebookUrl ? `<a href="${facebookUrl}" target="_blank" rel="noopener" style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5);text-decoration:none;transition:all .2s;" onmouseenter="this.style.background='var(--color-accent)';this.style.color='#fff'" onmouseleave="this.style.background='rgba(255,255,255,.08)';this.style.color='rgba(255,255,255,.5)'"><i class="ph ph-facebook-logo" style="font-size:1rem;"></i></a>` : ''}
                                ${whatsappLink ? `<a href="${whatsappLink}" target="_blank" rel="noopener" style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5);text-decoration:none;transition:all .2s;" onmouseenter="this.style.background='#25d366';this.style.color='#fff'" onmouseleave="this.style.background='rgba(255,255,255,.08)';this.style.color='rgba(255,255,255,.5)'"><i class="ph ph-whatsapp-logo" style="font-size:1rem;"></i></a>` : ''}
                            </div>
                        </div>
                        <div style="display:flex;gap:3rem;flex-wrap:wrap;">
                            <div>
                                <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);margin:0 0 .625rem;">Institucional</p>
                                <div style="display:flex;flex-direction:column;gap:.4rem;">
                                    <a href="javascript:void(0)" onclick="AppCore.openInstitucional('sobre')" style="color:rgba(255,255,255,.55);text-decoration:none;transition:color .2s;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,.55)'">Sobre Nós</a>
                                    <a href="javascript:void(0)" onclick="AppCore.openInstitucional('entrega')" style="color:rgba(255,255,255,.55);text-decoration:none;transition:color .2s;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,.55)'">Política de Entrega</a>
                                    <a href="javascript:void(0)" onclick="AppCore.openInstitucional('privacidade')" style="color:rgba(255,255,255,.55);text-decoration:none;transition:color .2s;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,.55)'">Privacidade</a>
                                    <a href="javascript:void(0)" onclick="AppCore.openInstitucional('termos')" style="color:rgba(255,255,255,.55);text-decoration:none;transition:color .2s;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,.55)'">Termos</a>
                                </div>
                            </div>
                            <div>
                                <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);margin:0 0 .625rem;">Contato</p>
                                <div style="display:flex;flex-direction:column;gap:.4rem;">
                                    <span style="display:flex;align-items:center;gap:.35rem;cursor:pointer;" onclick="AppCore.openMapModal()"><i class="ph ph-map-pin" style="color:var(--color-accent);"></i> Novo Hamburgo - RS</span>
                                    <span style="display:flex;align-items:center;gap:.35rem;"><i class="ph ph-phone" style="color:var(--color-accent);"></i> (51) 3581-5940</span>
                                </div>
                            </div>
                            <div>
                                <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);margin:0 0 .625rem;">Segurança</p>
                                <div style="display:flex;gap:.5rem;align-items:center;">
                                    <span style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;color:rgba(255,255,255,.4);"><i class="ph ph-shield-check" style="color:#4ade80;"></i> Site Seguro</span>
                                    <span style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;color:rgba(255,255,255,.4);"><i class="ph ph-lock-key" style="color:#60a5fa;"></i> SSL</span>
                                </div>
                                <div style="display:flex;gap:.375rem;margin-top:.5rem;color:rgba(255,255,255,.3);"><i class="ph ph-credit-card" style="font-size:1.25rem;"></i><i class="ph ph-barcode" style="font-size:1.25rem;"></i><i class="ph ph-pix-logo" style="font-size:1.25rem;"></i></div>
                            </div>
                        </div>
                    </div>
                    <!-- Bottom row -->
                    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;padding-top:.875rem;gap:.5rem;font-size:.7rem;color:rgba(255,255,255,.3);">
                        <p style="margin:0;">${footerText}</p>
                        <a href="https://sulcore.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;color:rgba(255,255,255,.3);text-decoration:none;transition:color .2s;" onmouseenter="this.style.color='rgba(255,255,255,.6)'" onmouseleave="this.style.color='rgba(255,255,255,.3)'">
                            <span style="width:14px;height:14px;border-radius:3px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);"><i class="ph-bold ph-cube" style="font-size:7px;"></i></span>
                            <span style="font-family:'Inter',monospace;letter-spacing:.15em;font-size:.6rem;">SULCORE</span>
                            <span>· © ${year}</span>
                        </a>
                    </div>
                </div>
            </footer>
        `;
    }

    // ---------- MODAIS GLOBAIS (inseridos no body) ----------
    function injectGlobalModals() {
        const modalsHTML = `
            <!-- Modal de mensagens -->
            <div id="globalModal" class="fixed inset-0 z-[200] flex items-center justify-center p-5 invisible opacity-0 transition-all duration-300" style="pointer-events: none;">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="AppCore.closeGlobalModal()"></div>
                <div id="globalModalContent" class="relative bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl transform transition-all duration-300 scale-95" style="pointer-events: auto;"></div>
            </div>
            <!-- Painel Institucional -->
            <div id="institucional-overlay" class="fixed inset-0 z-[110] bg-black/50 opacity-0 invisible transition-all duration-300" onclick="AppCore.closeInstitucional()"></div>
            <div id="institucional-panel" class="fixed bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 w-full md:max-w-3xl bg-white rounded-t-[2.5rem] shadow-2xl z-[120] translate-y-full transition-transform duration-500 overflow-hidden">
                <div class="pt-4 pb-2 flex justify-center"><div class="panel-handle"></div></div>
                <div class="px-6 pb-2 flex items-center justify-between">
                    <h2 id="panel-title" class="text-2xl font-bold text-primary">Sobre Nós</h2>
                    <button onclick="AppCore.closeInstitucional()" class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"><i class="ph ph-x text-xl"></i></button>
                </div>
                <div class="panel-content px-6 pb-8 text-gray-700 leading-relaxed space-y-4 text-sm md:text-base" id="panel-content">Carregando...</div>
            </div>
            <!-- Modal Mapa -->
            <div id="map-modal" class="fixed inset-0 z-[130] flex items-center justify-center p-4 opacity-0 invisible transition-all duration-300 bg-black/60 backdrop-blur-sm" onclick="AppCore.closeMapModal()">
                <div class="modal-container bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h3 class="text-xl font-bold text-primary flex items-center gap-2"><i class="ph ph-map-pin text-accent"></i> Nossa Localização · Elétrica Moro</h3>
                        <button onclick="AppCore.closeMapModal()" class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><i class="ph ph-x text-xl"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-6 space-y-5">
                        <div class="rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-100">
                            <iframe class="map-iframe" src="https://www.google.com/maps?q=Rua+Santa+Sofia+53+Novo+Hamburgo+RS&output=embed&z=16" allowfullscreen loading="lazy"></iframe>
                        </div>
                        <div class="bg-gray-50 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div><p class="text-sm text-gray-500 mb-1">Endereço completo</p><p class="text-gray-800 font-medium"><i class="ph ph-map-pin text-accent mr-1"></i>Rua Santa Sofia, 53 - Ideal, Novo Hamburgo - RS</p><p class="text-xs text-gray-400 mt-1">CEP: 93336-200</p></div>
                            <a href="https://www.google.com/maps/search/?api=1&query=Rua+Santa+Sofia+53+Novo+Hamburgo+RS" target="_blank" class="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-secondary"><i class="ph ph-arrow-square-out text-lg"></i>Abrir no Google Maps</a>
                        </div>
                    </div>
                    <div class="px-6 py-4 border-t border-gray-100 flex justify-end"><button onclick="AppCore.closeMapModal()" class="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium">Fechar</button></div>
                </div>
            </div>
            <!-- Carrinho Drawer -->
            <div id="cart-overlay" style="position:fixed;inset:0;z-index:130;background:rgba(0,0,0,.45);opacity:0;visibility:hidden;transition:all .3s;" onclick="AppCore.closeCart()"></div>
            <div id="cart-drawer" style="position:fixed;top:0;right:0;height:100%;width:100%;max-width:420px;background:#fff;box-shadow:-4px 0 40px rgba(0,0,0,.12);z-index:140;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.25rem 1rem;border-bottom:1px solid #f0f0f0;">
                    <div style="display:flex;align-items:center;gap:.625rem;">
                        <i class="ph ph-shopping-bag" style="font-size:1.4rem;color:var(--color-primary);"></i>
                        <h3 style="font-size:1rem;font-weight:700;color:#111;margin:0;">Meu Carrinho</h3>
                        <span id="cart-header-count" style="background:var(--color-primary);color:white;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;display:none;">0</span>
                    </div>
                    <button onclick="AppCore.closeCart()" style="width:36px;height:36px;border-radius:50%;border:none;background:#f4f5f7;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;" onmouseenter="this.style.background='#e5e7eb'" onmouseleave="this.style.background='#f4f5f7'">
                        <i class="ph ph-x" style="font-size:1rem;"></i>
                    </button>
                </div>
                <div id="cart-items-list" style="flex:1;overflow-y:auto;padding:1rem;"></div>
                <div style="border-top:1px solid #f0f0f0;padding:1.25rem;background:#fff;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                        <span style="font-size:.875rem;color:#6b7280;font-weight:500;">Subtotal</span>
                        <span id="cart-subtotal" style="font-size:1.5rem;font-weight:800;color:var(--color-primary);">R$ 0,00</span>
                    </div>
                    <button onclick="window.location.href='/checkout.html'" style="width:100%;padding:1rem;border-radius:12px;border:none;background:var(--color-primary);color:white;font-size:.9rem;font-weight:700;cursor:pointer;margin-bottom:.5rem;transition:opacity .2s;" onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">Finalizar Pedido →</button>
                    <button onclick="AppCore.closeCart()" style="width:100%;padding:.65rem;border-radius:12px;border:1.5px solid #e5e7eb;background:transparent;color:#6b7280;font-size:.83rem;font-weight:500;cursor:pointer;transition:all .2s;" onmouseenter="this.style.borderColor='#9ca3af';this.style.color='#374151'" onmouseleave="this.style.borderColor='#e5e7eb';this.style.color='#6b7280'">Continuar Comprando</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    }
    // ---------- ESTILOS GLOBAIS DO DESIGN SYSTEM ----------
const style = document.createElement('style');
style.textContent = `
    @keyframes slideBanner { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .animate-slide { animation: slideBanner 40s linear infinite; }
    .hide-mobile { }
    @media (max-width: 768px) { .hide-mobile { display: none !important; } }

    /* Product Card */
    .pcard { background:#fff;border-radius:14px;overflow:hidden;border:1px solid #f0f0f0;display:flex;flex-direction:column;height:100%;transition:box-shadow .25s,transform .25s;position:relative; }
    .pcard:hover { box-shadow:0 8px 30px rgba(0,0,0,.11);transform:translateY(-3px); }
    .pcard-badges { position:absolute;top:12px;left:12px;z-index:10;display:flex;gap:6px; }
    .pcard-badge { font-size:10px;font-weight:700;color:#fff;padding:3px 8px;border-radius:20px; }
    .pcard-img-wrap { display:block;position:relative;padding-bottom:100%;overflow:hidden;background:#f8f9fa; }
    .pcard-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:14px;transition:transform .4s ease; }
    .pcard:hover .pcard-img { transform:scale(1.06); }
    .pcard-body { padding:1rem;display:flex;flex-direction:column;flex:1; }
    .pcard-brand { font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin:0 0 4px; }
    .pcard-name { font-size:.83rem;font-weight:600;color:#1f2937;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1;margin:0 0 10px; }
    .pcard-name a { color:inherit;text-decoration:none; }
    .pcard-name a:hover { color:var(--color-primary); }
    .pcard-price-wrap { border-top:1px solid #f4f5f7;padding-top:10px;margin-top:auto; }
    .pcard-oldprice { font-size:11px;color:#9ca3af;text-decoration:line-through;display:block; }
    .pcard-price { font-size:1.2rem;font-weight:800;color:var(--color-primary);display:block;line-height:1.2; }
    .pcard-installment { font-size:10.5px;color:#9ca3af;margin:2px 0 10px; }
    .pcard-btn { width:100%;padding:.625rem;border-radius:10px;border:none;background:color-mix(in srgb,var(--color-primary) 8%,white);color:var(--color-primary);font-size:.8rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s; }
    .pcard-btn:hover { background:var(--color-primary);color:#fff; }

    /* Cart items */
    .cart-item { display:flex;gap:.875rem;padding:.875rem;background:#f9fafb;border-radius:12px;align-items:flex-start; }
    .cart-item-img { width:64px;height:64px;background:#fff;border-radius:8px;object-fit:contain;flex-shrink:0;border:1px solid #f0f0f0; }
    .cart-item-body { flex:1;min-width:0; }
    .cart-item-name { font-size:.82rem;font-weight:600;color:#1f2937;line-height:1.3;margin:0 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .cart-item-price { font-size:.9rem;font-weight:700;color:var(--color-primary); }
    .cart-item-remove { background:none;border:none;color:#d1d5db;cursor:pointer;padding:4px;border-radius:6px;transition:color .2s;flex-shrink:0; }
    .cart-item-remove:hover { color:#ef4444; }

    /* Panel institucional */
    .panel-content { max-height:calc(90vh - 100px);overflow-y:auto;padding-right:4px;scrollbar-width:thin;scrollbar-color:#cbd5e1 #f1f5f9; }
    .panel-content::-webkit-scrollbar { width:4px; }
    .panel-content::-webkit-scrollbar-thumb { background-color:#cbd5e1;border-radius:4px; }
    @media (min-width:768px) {
        #institucional-panel { max-width:720px;left:50%;transform:translateX(-50%) translateY(100%); }
        #institucional-panel.translate-y-0 { transform:translateX(-50%) translateY(0) !important; }
    }
    /* Map iframe */
    .map-iframe { width:100%;height:300px;border:0; }

    /* Search placeholder */
    #header-search-input::placeholder { color:rgba(255,255,255,.45); }
    #header-search-input::-webkit-search-cancel-button { filter:invert(1); }

    /* Carousel nav buttons show on hover */
    .group:hover button[id$="PrevBtn"], .group:hover button[id$="NextBtn"] { opacity:1 !important; }

    /* Bento grid responsive */
    @media (max-width: 768px) {
        #bentoCategoryGrid { grid-template-columns:repeat(2,1fr) !important;grid-auto-rows:140px !important; }
        #bentoCategoryGrid > a:first-child { grid-column:span 2 !important;grid-row:span 1 !important; }
    }

    /* Smooth fade for dynamic sections */
    @keyframes fadeUp { from { opacity:0;transform:translateY(12px); } to { opacity:1;transform:translateY(0); } }
    #bentoCategoryGrid > a { animation: fadeUp .5s ease both; }
    #bentoCategoryGrid > a:nth-child(2) { animation-delay:.05s; }
    #bentoCategoryGrid > a:nth-child(3) { animation-delay:.1s; }
    #bentoCategoryGrid > a:nth-child(4) { animation-delay:.15s; }
    #bentoCategoryGrid > a:nth-child(5) { animation-delay:.2s; }
    #bentoCategoryGrid > a:nth-child(6) { animation-delay:.25s; }
`;
document.head.appendChild(style);

    // ---------- LÓGICA DO CARRINHO ----------
    function loadCart() {
        try {
            cartItems = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
        } catch {
            cartItems = [];
        }
    }

    function saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    }

    function calcTotal() {
        return cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    }

    function updateCartUI() {
        const counter = document.getElementById('cartCount');
        const headerCount = document.getElementById('cart-header-count');
        const itemsContainer = document.getElementById('cart-items-list');
        const subtotalEl = document.getElementById('cart-subtotal');
        if (!itemsContainer || !subtotalEl) return;

        const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
        if (counter) { counter.textContent = totalItems; counter.style.display = totalItems > 0 ? 'flex' : 'none'; }
        if (headerCount) { headerCount.textContent = totalItems; headerCount.style.display = totalItems > 0 ? 'inline-block' : 'none'; }

        if (cartItems.length === 0) {
            itemsContainer.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:3rem 1rem;color:#9ca3af;text-align:center;"><i class="ph ph-shopping-bag" style="font-size:3rem;margin-bottom:1rem;opacity:.4;"></i><p style="font-size:.9rem;font-weight:500;">Seu carrinho está vazio</p><p style="font-size:.8rem;margin-top:.25rem;">Adicione produtos para continuar</p></div>`;
            subtotalEl.textContent = 'R$ 0,00';
            return;
        }

        let html = '<div style="display:flex;flex-direction:column;gap:.625rem;">';
        cartItems.forEach(item => {
            const img = item.image || 'https://placehold.co/64x64/f3f4f6/9ca3af?text=P';
            const qty = item.quantity || 1;
            html += `<div class="cart-item">
                <img src="${img}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://placehold.co/64x64/f3f4f6/9ca3af?text=P'">
                <div class="cart-item-body">
                    <p class="cart-item-name">${item.name}${qty > 1 ? ` <span style="color:#9ca3af;font-weight:400;">×${qty}</span>` : ''}</p>
                    <span class="cart-item-price">R$ ${(item.price * qty).toFixed(2)}</span>
                </div>
                <button class="cart-item-remove" onclick="AppCore.removeFromCart('${item.id}')" title="Remover">
                    <i class="ph ph-x" style="font-size:.875rem;"></i>
                </button>
            </div>`;
        });
        html += '</div>';
        itemsContainer.innerHTML = html;
        subtotalEl.textContent = `R$ ${calcTotal().toFixed(2)}`;
    }

    function addToCart(product) {
        if (!product || !product.id) return;
        const existing = cartItems.find(item => item.id === product.id);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cartItems.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image || (product.images && product.images[0]) || product.image_url || null,
                quantity: 1
            });
        }
        saveCart();
        updateCartUI();
        AppCore.showMessage('Produto adicionado', `${product.name} foi adicionado ao carrinho.`);
    }

    function removeFromCart(productId) {
        cartItems = cartItems.filter(item => item.id !== productId);
        saveCart();
        updateCartUI();
    }

    function toggleCart() {
        const drawer = document.getElementById('cart-drawer');
        if (!drawer) return;
        const isOpen = drawer.style.transform === 'translateX(0%)';
        isOpen ? closeCart() : openCart();
    }

    function openCart() {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        if (drawer) drawer.style.transform = 'translateX(0%)';
        if (overlay) { overlay.style.opacity = '1'; overlay.style.visibility = 'visible'; }
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        if (drawer) drawer.style.transform = 'translateX(100%)';
        if (overlay) { overlay.style.opacity = '0'; overlay.style.visibility = 'hidden'; }
        document.body.style.overflow = '';
    }

    // ---------- MODAIS GLOBAIS ----------
    function closeGlobalModal() {
        const modal = document.getElementById('globalModal');
        modal.classList.add('invisible', 'opacity-0');
        modal.style.pointerEvents = 'none';
    }

    function showGlobalModal(html) {
        const modal = document.getElementById('globalModal');
        const content = document.getElementById('globalModalContent');
        content.innerHTML = html;
        modal.classList.remove('invisible', 'opacity-0');
        modal.style.pointerEvents = 'auto';
    }

    function showMessage(title, msg) {
        const html = `
            <button onclick="AppCore.closeGlobalModal()" class="absolute top-5 right-5 text-gray-400 hover:text-primary"><i class="ph ph-x text-2xl"></i></button>
            <h3 class="text-xl font-bold text-primary mb-2">${title}</h3>
            <p class="text-gray-600 mb-6">${msg}</p>
            <button onclick="AppCore.closeGlobalModal()" class="w-full bg-primary text-white py-3 rounded-xl font-semibold">Ok</button>
        `;
        showGlobalModal(html);
    }

    // ---------- PAINEL INSTITUCIONAL ----------
    const institucionalData = {
        sobre: {
            titulo: 'Sobre Nós',
            texto: `A Elétrica Moro é uma empresa que se consolidou como referência em assistência técnica na região. A anos atuando na cidade de Novo Hamburgo, atende toda a região do Vale do Sinos e Grande Porto Alegre.\n\nCom uma equipe qualificada de profissionais procura sempre trazer o que há de melhor para seus clientes. Recentemente ampliou suas dependências para poder ter mais espaço para melhor atender os seus clientes.`
        },
        entrega: {
            titulo: 'Política de Entrega',
            texto: `Após a confirmação de pagamento pelo sistema ou o envio do comprovante, daremos início ao processamento do seu pedido. Durante esse período, nossa equipe estará dedicada a garantir a qualidade e precisão de cada etapa. Assim que concluído, seu pedido será cuidadosamente embalado e despachado pela transportadora selecionada, garantindo uma entrega segura e eficiente.\n\nO código de rastreamento será enviado diretamente para o e-mail cadastrado, permitindo que você acompanhe o status da sua entrega em tempo real. Estamos comprometidos em fornecer uma experiência de compra tranquila e satisfatória, desde o momento do pedido até a chegada do produto em suas mãos.`
        },
        privacidade: {
            titulo: 'Política de Privacidade',
            texto: `A proteção da privacidade dos nossos clientes é nossa prioridade. Todas as informações que você nos fornece são utilizadas exclusivamente para aprimorar nossos serviços e personalizar seu atendimento. Garantimos que não vendemos, alugamos ou compartilhamos seus dados com terceiros.\n\nColeta de Informações: Os dados pessoais fornecidos são fundamentais para entendermos suas necessidades e oferecermos serviços, produtos e informações personalizados. Essas informações são armazenadas em nosso banco de dados para melhorar nosso relacionamento com os clientes e facilitar futuras compras e navegação no site.\n\nUso das Informações: Seus dados pessoais não são divulgados ou comercializados. São utilizados exclusivamente por nós para conferência de pedidos, facilitação do preenchimento de pedidos, análise de perfis e estatísticas, melhoria das operações do site e envio de conteúdo promocional e informativo, os quais você pode optar por cancelar a qualquer momento.\n\nRegistro e Recebimento de Material Promocional: O registro do seu e-mail nos permite enviar informações, promoções e lançamentos, mas apenas se autorizado por você. Você pode optar por não receber mais essas informações a qualquer momento. O registro não estabelece vínculo contratual, sendo apenas para acesso a serviços especiais e tratamento diferenciado.\n\nSegurança: Suas informações são armazenadas em servidores altamente seguros, com criptografia de 128 bits, garantindo sua privacidade e proteção. Não compartilhe sua senha com terceiros para garantir sua segurança.\n\nModificações: Reservamos o direito de alterar nossa Política de Privacidade, comprometendo-nos a divulgar quaisquer mudanças neste espaço.\n\nDúvidas e Sugestões: Em caso de dúvidas ou sugestões sobre nossa Política de Privacidade, entre em contato conosco. Estamos aqui para ajudar.`
        },
        termos: {
            titulo: 'Termos e Condições',
            texto: `Todos os produtos que comercializamos são acompanhados por nossa garantia de qualidade. Em caso de produtos defeituosos, garantimos a troca gratuita, desde que observadas as seguintes condições:\n\n• A troca só será efetuada mediante a apresentação da embalagem original e com os produtos mantendo suas características intactas, tal como quando foram adquiridos.\n• Produtos que apresentarem defeitos decorrentes de mau uso ou aplicação incorreta não serão elegíveis para troca.\n• Você tem até 7 (sete) dias após o recebimento para solicitar a troca, caso detecte algum problema.\n\nApós a confirmação do pagamento, seu pedido será processado e encaminhado para expedição, com previsão de envio pela transportadora em um prazo de 2 a 3 dias úteis.\n\nEstamos à disposição para esclarecer quaisquer dúvidas que possam surgir. Entre em contato conosco se precisar de assistência. Estamos aqui para ajudá-lo.`
        }
    };

    function openInstitucional(tipo) {
        const dados = institucionalData[tipo];
        if (!dados) return;
        document.getElementById('panel-title').textContent = dados.titulo;
        document.getElementById('panel-content').innerHTML = dados.texto.replace(/\n/g, '<br>');
        const overlay = document.getElementById('institucional-overlay');
        const panel = document.getElementById('institucional-panel');
        overlay.classList.remove('invisible', 'opacity-0');
        overlay.classList.add('opacity-100');
        panel.classList.remove('translate-y-full');
        panel.classList.add('translate-y-0');
        document.body.style.overflow = 'hidden';
    }

    function closeInstitucional() {
        const overlay = document.getElementById('institucional-overlay');
        const panel = document.getElementById('institucional-panel');
        overlay.classList.add('opacity-0', 'invisible');
        overlay.classList.remove('opacity-100');
        panel.classList.add('translate-y-full');
        panel.classList.remove('translate-y-0');
        document.body.style.overflow = '';
    }

    // ---------- MODAL MAPA ----------
    function openMapModal() {
        const modal = document.getElementById('map-modal');
        modal.classList.remove('opacity-0', 'invisible');
        modal.classList.add('active', 'opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function closeMapModal() {
        const modal = document.getElementById('map-modal');
        modal.classList.add('opacity-0', 'invisible');
        modal.classList.remove('active', 'opacity-100');
        document.body.style.overflow = '';
    }

    // ---------- EVENT DELEGATION PARA ADICIONAR AO CARRINHO ----------
    function setupGlobalListeners() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-to-cart-btn');
            if (btn) {
                try {
                    const productStr = btn.dataset.product.replace(/&apos;/g, "'");
                    const product = JSON.parse(productStr);
                    addToCart(product);
                } catch (err) {
                    console.warn('Erro ao adicionar produto:', err);
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const panel = document.getElementById('institucional-panel');
                if (panel && panel.classList.contains('translate-y-0')) {
                    closeInstitucional();
                }
                const mapModal = document.getElementById('map-modal');
                if (mapModal && mapModal.classList.contains('active')) {
                    closeMapModal();
                }
                const drawer = document.getElementById('cart-drawer');
                if (drawer && !drawer.classList.contains('translate-x-full')) {
                    closeCart();
                }
            }
        });

        // Fechar painel com gesto de arrastar (touch)
        const panel = document.getElementById('institucional-panel');
        if (panel) {
            let startY = 0;
            panel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
            panel.addEventListener('touchmove', (e) => {
                const delta = e.touches[0].clientY - startY;
                if (delta > 80) {
                    closeInstitucional();
                    startY = 0;
                }
            }, { passive: true });
        }
    }

    // ---------- AUTH (Supabase) ----------
    let _supabase = null;
    let _currentUser = null;

    async function getSupabase() {
        if (_supabase) return _supabase;
        try {
            // Garante que /js/supabase-config.js carregou (define window.SUPABASE_CONFIG)
            if (!window.SUPABASE_CONFIG) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '/js/supabase-config.js';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            const cfg = window.SUPABASE_CONFIG || {};
            _supabase = createClient(cfg.url, cfg.anonKey, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage },
            });
            _supabase.auth.onAuthStateChange((_event, session) => {
                _currentUser = session?.user || null;
                renderAccountWidget();
            });
        } catch (err) {
            console.warn('[auth] supabase indisponível:', err.message);
        }
        return _supabase;
    }

    function isAdminUser(user) {
        return !!user && user.user_metadata && user.user_metadata.is_admin === true;
    }

    async function refreshUser() {
        const sb = await getSupabase();
        if (!sb) return null;
        const { data } = await sb.auth.getUser();
        _currentUser = data.user || null;
        return _currentUser;
    }

    function renderAccountWidget() {
        const widget = document.getElementById('accountWidget');
        if (!widget) return;
        const user = _currentUser;
        if (!user) {
            widget.innerHTML = `
                <button id="openLoginBtn" type="button" style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:.625rem;background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.85);font-size:.85rem;font-weight:500;transition:background .2s;" onmouseenter="this.style.background='rgba(255,255,255,.12)'" onmouseleave="this.style.background='transparent'">
                    <i class="ph ph-user" style="font-size:1.3rem;"></i>
                    <span class="hide-mobile">Entrar</span>
                </button>
            `;
            document.getElementById('openLoginBtn').addEventListener('click', () => openAuthModal('login'));
            return;
        }
        const admin = isAdminUser(user);
        const initial = (user.email || '?')[0].toUpperCase();
        const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'Conta';
        // Dropdown usa cores fixas (não-temáticas) pra garantir contraste
        // independente da identidade visual configurada pela loja.
        const adminLink = admin
            ? `<li class="border-t border-slate-100 mt-1 pt-1"><a href="/admin.html" class="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition"><i class="ph-bold ph-shield-check text-base"></i> Painel administrativo</a></li>`
            : '';
        widget.innerHTML = `
            <button id="accountBtn" style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:.625rem;background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.85);font-size:.85rem;font-weight:500;transition:background .2s;" onmouseenter="this.style.background='rgba(255,255,255,.12)'" onmouseleave="this.style.background='transparent'">
                <span style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${initial}</span>
                <span class="hide-mobile" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</span>
                <i class="ph ph-caret-down" style="font-size:.65rem;"></i>
            </button>
            <div id="accountMenu" class="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl py-2 hidden border border-slate-200 z-50 overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p class="text-xs text-slate-500 font-medium">Logado como</p>
                    <p class="text-sm text-slate-800 truncate font-semibold">${user.email}</p>
                </div>
                <ul class="py-1">
                    <li><a href="/minha-conta.html?tab=pedidos" class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"><i class="ph ph-package text-base text-slate-400"></i> Meus pedidos</a></li>
                    <li><a href="/minha-conta.html?tab=interesses" class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"><i class="ph ph-heart text-base text-slate-400"></i> Meus interesses</a></li>
                    <li><a href="/minha-conta.html?tab=perfil" class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"><i class="ph ph-user text-base text-slate-400"></i> Meus dados</a></li>
                    ${adminLink}
                    <li class="border-t border-slate-100 mt-1 pt-1"><a href="#" id="logoutBtn" class="flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"><i class="ph ph-sign-out text-base"></i> Sair</a></li>
                </ul>
            </div>
        `;
        const btn = document.getElementById('accountBtn');
        const menu = document.getElementById('accountMenu');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
        });
        document.addEventListener('click', () => menu.classList.add('hidden'), { once: true });
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const sb = await getSupabase();
            if (sb) await sb.auth.signOut();
            _currentUser = null;
            renderAccountWidget();
            showMessage('Você saiu', 'Sessão encerrada.');
        });
    }

    // ---------- MODAL DE LOGIN/CADASTRO ----------
    function injectAuthModal() {
        if (document.getElementById('authModal')) return;
        const html = `
        <div id="authModal" class="fixed inset-0 z-[210] hidden items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="AppCore.closeAuthModal()"></div>
            <div class="relative bg-white rounded-3xl w-full max-w-md p-7 shadow-2xl">
                <button onclick="AppCore.closeAuthModal()" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600">
                    <i class="ph ph-x"></i>
                </button>
                <div class="text-center mb-5">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2" style="background: linear-gradient(135deg, var(--color-primary, #0a2540), var(--color-secondary, #1a365d)); color: white;">
                        <i class="ph-bold ph-user-circle text-2xl"></i>
                    </div>
                    <h3 id="authModalTitle" class="text-xl font-bold text-gray-800">Entre na sua conta</h3>
                    <p class="text-sm text-gray-500" id="authModalSubtitle">Acesse seus pedidos, favoritos e ofertas exclusivas</p>
                </div>
                <div class="flex bg-gray-100 rounded-xl p-1 mb-5">
                    <button id="authTabLogin" class="flex-1 py-2 px-4 rounded-lg font-medium text-sm bg-white text-primary shadow-sm">Entrar</button>
                    <button id="authTabRegister" class="flex-1 py-2 px-4 rounded-lg font-medium text-sm text-gray-600">Cadastrar</button>
                </div>

                <form id="authLoginForm" class="space-y-3">
                    <input type="email" id="authLoginEmail" required placeholder="Email" autocomplete="email" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <input type="password" id="authLoginPassword" required placeholder="Senha" autocomplete="current-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <button type="submit" class="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-secondary transition flex items-center justify-center gap-2">
                        <span id="authLoginBtnLabel">Entrar</span>
                    </button>
                    <button type="button" id="authForgotBtn" class="w-full text-sm text-gray-500 hover:text-gray-800 transition">Esqueci minha senha</button>
                    <p id="authLoginError" class="hidden text-sm text-rose-600 text-center bg-rose-50 rounded-lg py-2"></p>
                </form>

                <form id="authRegisterForm" class="space-y-3 hidden">
                    <input type="text" id="authRegName" required placeholder="Nome completo" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <input type="email" id="authRegEmail" required placeholder="Email" autocomplete="email" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <input type="password" id="authRegPassword" required minlength="6" placeholder="Senha (mín. 6 caracteres)" autocomplete="new-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <input type="tel" id="authRegPhone" placeholder="Telefone (opcional)" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <button type="submit" class="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-secondary transition">
                        <span id="authRegBtnLabel">Criar conta</span>
                    </button>
                    <p class="text-xs text-gray-400 text-center">Ao se cadastrar você concorda com nossos termos.</p>
                    <p id="authRegError" class="hidden text-sm text-rose-600 text-center bg-rose-50 rounded-lg py-2"></p>
                </form>

                <form id="authForgotForm" class="space-y-3 hidden">
                    <p class="text-sm text-gray-600 text-center">Vamos enviar um link para você redefinir a senha.</p>
                    <input type="email" id="authForgotEmail" required placeholder="Seu email cadastrado" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none">
                    <button type="submit" class="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-secondary transition">Enviar link</button>
                    <button type="button" id="authBackToLogin" class="w-full text-sm text-gray-500 hover:text-gray-800">← Voltar ao login</button>
                    <p id="authForgotMsg" class="hidden text-sm text-center rounded-lg py-2"></p>
                </form>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        // Tabs
        document.getElementById('authTabLogin').addEventListener('click', () => switchAuthTab('login'));
        document.getElementById('authTabRegister').addEventListener('click', () => switchAuthTab('register'));
        document.getElementById('authForgotBtn').addEventListener('click', () => switchAuthTab('forgot'));
        document.getElementById('authBackToLogin').addEventListener('click', () => switchAuthTab('login'));

        // Login submit
        document.getElementById('authLoginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const sb = await getSupabase();
            const errEl = document.getElementById('authLoginError');
            errEl.classList.add('hidden');
            const label = document.getElementById('authLoginBtnLabel');
            label.textContent = 'Entrando…';
            try {
                const { error } = await sb.auth.signInWithPassword({
                    email: document.getElementById('authLoginEmail').value.trim(),
                    password: document.getElementById('authLoginPassword').value,
                });
                if (error) throw error;
                closeAuthModal();
                showMessage('Bem-vindo!', 'Login realizado com sucesso.');
            } catch (err) {
                errEl.textContent = err.message || 'Erro ao entrar.';
                errEl.classList.remove('hidden');
            } finally {
                label.textContent = 'Entrar';
            }
        });

        // Register submit
        document.getElementById('authRegisterForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const sb = await getSupabase();
            const errEl = document.getElementById('authRegError');
            errEl.classList.add('hidden');
            const label = document.getElementById('authRegBtnLabel');
            label.textContent = 'Criando conta…';
            try {
                const name = document.getElementById('authRegName').value.trim();
                const phone = document.getElementById('authRegPhone').value.trim();
                const { data, error } = await sb.auth.signUp({
                    email: document.getElementById('authRegEmail').value.trim(),
                    password: document.getElementById('authRegPassword').value,
                    options: { data: { name, phone } },
                });
                if (error) throw error;
                if (data.session) {
                    closeAuthModal();
                    showMessage('Conta criada!', 'Bem-vindo. Você já está logado.');
                } else {
                    // Confirmação de email habilitada — mostra mensagem
                    errEl.className = 'text-sm text-emerald-700 text-center bg-emerald-50 rounded-lg py-2';
                    errEl.textContent = 'Confira seu email para confirmar a conta.';
                    errEl.classList.remove('hidden');
                }
            } catch (err) {
                errEl.textContent = err.message || 'Erro ao criar conta.';
                errEl.classList.remove('hidden');
            } finally {
                label.textContent = 'Criar conta';
            }
        });

        // Forgot submit
        document.getElementById('authForgotForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const sb = await getSupabase();
            const msgEl = document.getElementById('authForgotMsg');
            msgEl.classList.add('hidden');
            try {
                const { error } = await sb.auth.resetPasswordForEmail(
                    document.getElementById('authForgotEmail').value.trim(),
                    { redirectTo: `${window.location.origin}/set-password.html` }
                );
                if (error) throw error;
                msgEl.className = 'text-sm text-center rounded-lg py-2 bg-emerald-50 text-emerald-700';
                msgEl.textContent = 'Link enviado. Verifique seu email.';
                msgEl.classList.remove('hidden');
            } catch (err) {
                msgEl.className = 'text-sm text-center rounded-lg py-2 bg-rose-50 text-rose-700';
                msgEl.textContent = err.message || 'Erro ao enviar link.';
                msgEl.classList.remove('hidden');
            }
        });
    }

    function switchAuthTab(tab) {
        const loginForm = document.getElementById('authLoginForm');
        const regForm = document.getElementById('authRegisterForm');
        const forgotForm = document.getElementById('authForgotForm');
        const tabLogin = document.getElementById('authTabLogin');
        const tabReg = document.getElementById('authTabRegister');
        loginForm.classList.add('hidden'); regForm.classList.add('hidden'); forgotForm.classList.add('hidden');
        tabLogin.classList.remove('bg-white', 'text-primary', 'shadow-sm');
        tabLogin.classList.add('text-gray-600');
        tabReg.classList.remove('bg-white', 'text-primary', 'shadow-sm');
        tabReg.classList.add('text-gray-600');
        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            tabLogin.classList.add('bg-white', 'text-primary', 'shadow-sm');
            tabLogin.classList.remove('text-gray-600');
        } else if (tab === 'register') {
            regForm.classList.remove('hidden');
            tabReg.classList.add('bg-white', 'text-primary', 'shadow-sm');
            tabReg.classList.remove('text-gray-600');
        } else {
            forgotForm.classList.remove('hidden');
        }
    }

    function openAuthModal(tab = 'login') {
        injectAuthModal();
        const m = document.getElementById('authModal');
        m.classList.remove('hidden');
        m.classList.add('flex');
        switchAuthTab(tab);
        document.body.style.overflow = 'hidden';
    }

    function closeAuthModal() {
        const m = document.getElementById('authModal');
        if (!m) return;
        m.classList.add('hidden');
        m.classList.remove('flex');
        document.body.style.overflow = '';
    }

    // ---------- INICIALIZAÇÃO ----------
    async function init() {
        injectGlobalModals();
        renderHeader();
        await renderFooter();
        loadCart();
        updateCartUI();
        setupGlobalListeners();
        // Auth: detecta sessão atual e renderiza widget
        await refreshUser();
        renderAccountWidget();
    }

    // API pública
    const AppCore = {
        init,
        showMessage,
        openInstitucional,
        closeInstitucional,
        openMapModal,
        closeMapModal,
        toggleCart,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        closeGlobalModal,
        fetchCategories,
        fetchSuggestedProducts,
        trackCategoryVisit,
        getCategoryHistory,
        renderProductCard,
        openAuthModal,
        closeAuthModal,
        getSupabase,
        refreshUser,
        isAdminUser,
    };

    global.AppCore = AppCore;

    // Inicializar automaticamente quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);