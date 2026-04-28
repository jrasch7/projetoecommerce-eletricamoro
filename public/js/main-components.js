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

        const specs = [product.brand, product.model, product.voltage].filter(Boolean).join(' · ');
        const badges = [];
        
        // Best Seller badge based on actual order count
        const orderCount = product.orderCount || 0;
        if (orderCount > 0) {
            badges.push('<span class="absolute top-3 left-3 z-10 bg-green-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Mais Vendido</span>');
        } else if (product.is_featured) {
            badges.push('<span class="absolute top-3 left-3 z-10 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Destaque</span>');
        }
        
        if (desconto > 0) {
            const badgePosition = (orderCount > 0 || product.is_featured) ? 'left-20' : 'left-3';
            badges.push(`<span class="absolute top-3 ${badgePosition} z-10 bg-accent text-white text-[10px] font-bold px-2.5 py-1 rounded-full">-${desconto}%</span>`);
        }

        const productJson = JSON.stringify({ id: product.id, name: product.name, price, image: imageUrl }).replace(/'/g, "&apos;");

        return `<div class="bg-white rounded-2xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-gray-100 relative flex flex-col h-full">
            ${badges.join('')}
            <a href="/produto.html?id=${product.id}" class="block p-4 flex items-center justify-center bg-gray-50">
                <img src="${imageUrl}" alt="${product.name}" class="product-img w-full h-auto max-h-44 object-contain" loading="lazy" onerror="this.src='https://placehold.co/300x300/f3f4f6/9ca3af?text=Produto'">
            </a>
            <div class="p-4 flex flex-col flex-grow">
                <h3 class="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[2.5rem]"><a href="/produto.html?id=${product.id}" class="hover:text-primary transition">${product.name}</a></h3>
                ${specs ? `<p class="text-[10px] text-gray-400 mt-1 truncate">${specs}</p>` : ''}
                <div class="mt-2">
                    ${desconto > 0 ? `<span class="text-gray-400 text-xs line-through">R$ ${price.toFixed(2)}</span>` : ''}
                    <div class="text-xl font-bold text-primary">R$ ${precoFinal}</div>
                    <div class="text-[11px] text-gray-500 mt-1">ou ${parcelas}x de R$ ${valorParcela.toFixed(2)} <span class="font-semibold">sem juros</span></div>
                </div>
                <button class="add-to-cart-btn mt-4 w-full bg-primary/5 hover:bg-primary text-primary hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-all" data-product='${productJson}'>Adicionar</button>
            </div>
        </div>`;
    }

    // ---------- RENDERIZAÇÃO DO HEADER ----------
    function renderHeader() {
        const headerPlaceholder = document.getElementById('global-header');
        if (!headerPlaceholder) return;

        headerPlaceholder.innerHTML = `
            <!-- Top Bar -->
            <div class="bg-primary text-white top-bar-height flex items-center overflow-hidden relative border-b border-white/5">
                <div class="w-full flex items-center h-full top-bar-container">
                    <div class="animate-slide whitespace-nowrap">
                        <span class="px-12 text-[13px] font-medium">🚚 Entrega ágil para todo o Brasil</span>
                        <span class="px-12 text-[13px] font-medium">🔧 Assistência técnica especializada | Peças originais</span>
                        <span class="px-12 text-[13px] font-medium">💳 Parcele em até 3x sem juros em todo o site</span>
                        <span class="px-12 text-[13px] font-medium">🚚 Entrega ágil para todo o Brasil</span>
                        <span class="px-12 text-[13px] font-medium">🔧 Assistência técnica especializada | Peças originais</span>
                        <span class="px-12 text-[13px] font-medium">💳 Parcele em até 3x sem juros em todo o site</span>
                    </div>
                </div>
            </div>
            <!-- Header principal -->
            <header class="bg-primary shadow-xl sticky top-0 z-50 py-5">
                <div class="container mx-auto px-4 flex flex-wrap items-center justify-between gap-6">
                    <a href="/" class="flex items-center shrink-0">
                        <img src="img/logo-moro.webp" alt="Elétrica Moro" class="h-12 w-auto object-contain" onerror="this.src='https://placehold.co/200x48/0a2540/white?text=El%C3%A9trica+Moro'">
                    </a>
                    <form class="flex-grow max-w-2xl relative order-3 md:order-none w-full md:w-auto" onsubmit="event.preventDefault(); AppCore.showMessage('Busca','Funcionalidade em desenvolvimento.');">
                        <input type="search" placeholder="Buscar peças, eletrodomésticos ou serviços..." class="w-full py-3.5 px-6 rounded-full text-sm focus:ring-2 focus:ring-accent outline-none bg-white">
                        <button type="submit" class="absolute right-4 top-1/2 -translate-y-1/2 text-primary text-xl">
                            <i class="ph ph-magnifying-glass"></i>
                        </button>
                    </form>
                    <nav class="flex items-center gap-4">
                        <div id="accountWidget" class="relative">
                            <!-- Renderizado dinamicamente por updateAccountWidget() -->
                            <button class="flex items-center gap-2 text-white p-2 hover:bg-white/10 rounded-lg transition-all opacity-50">
                                <i class="ph ph-user text-2xl"></i>
                                <span class="hidden lg:inline text-sm font-medium">Carregando…</span>
                            </button>
                        </div>
                        <button onclick="AppCore.toggleCart()" class="flex items-center gap-2 text-white p-2 hover:bg-white/10 rounded-lg transition-all">
                            <div class="relative">
                                <i class="ph ph-shopping-cart text-2xl"></i>
                                <span id="cartCount" class="absolute -top-2 -right-2 bg-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden">0</span>
                            </div>
                            <span class="hidden lg:inline text-sm font-medium">Carrinho</span>
                        </button>
                    </nav>
                </div>
            </header>
            <!-- Mega Menu (dinâmico) -->
            <section class="bg-white border-b border-gray-200 relative">
                <div class="container mx-auto px-4">
                    <ul id="dynamicMenu" class="flex items-center gap-8 py-4 overflow-x-auto hide-scrollbar whitespace-nowrap text-sm font-medium text-gray-700">
                        <li><a href="/categoria.html" class="flex items-center gap-2 hover:text-primary transition-colors"><i class="ph ph-list"></i> Todas as Categorias</a></li>
                    </ul>
                </div>
            </section>
        `;

        // Preencher menu com categorias reais/mock
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
            li.className = 'group/mega static';
            li.innerHTML = `
                <a href="/categoria.html?categoryId=${cat.id}" class="flex items-center gap-1 hover:text-primary transition-colors pb-4 -mb-4">
                    ${cat.name} 
                    ${cat.subcategories && cat.subcategories.length ? '<i class="ph ph-caret-down text-[10px] rotate-icon"></i>' : ''}
                </a>
            `;
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
            <footer class="bg-primary text-white pt-16 pb-8">
                <div class="container mx-auto px-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                        <div class="space-y-6">
                            <img src="${logo}" alt="Logo" class="h-12 w-auto object-contain brightness-0 invert" onerror="this.src='https://placehold.co/200x48/0a2540/white?text=Logo'">
                            <p class="text-white/60 text-sm leading-relaxed">Especialistas em peças para eletrodomésticos e assistência técnica autorizada. Qualidade e confiança desde 1990.</p>
                            <div class="flex gap-4">
                                ${instagramUrl ? `<a href="${instagramUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-all"><i class="ph ph-instagram-logo text-xl"></i></a>` : ''}
                                ${facebookUrl ? `<a href="${facebookUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-all"><i class="ph ph-facebook-logo text-xl"></i></a>` : ''}
                                ${whatsappLink ? `<a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-all"><i class="ph ph-whatsapp-logo text-xl"></i></a>` : ''}
                            </div>
                        </div>
                        <div>
                            <h4 class="text-lg font-bold mb-6 relative inline-block">Institucional<span class="absolute -bottom-2 left-0 w-8 h-1 bg-accent"></span></h4>
                            <ul class="space-y-4 text-sm text-white/60">
                                <li><a href="javascript:void(0)" onclick="AppCore.openInstitucional('sobre')" class="hover:text-white hover:translate-x-1 flex items-center gap-2"><i class="ph ph-caret-right text-[10px]"></i> Sobre Nós</a></li>
                                <li><a href="javascript:void(0)" onclick="AppCore.openInstitucional('entrega')" class="hover:text-white hover:translate-x-1 flex items-center gap-2"><i class="ph ph-caret-right text-[10px]"></i> Política de Entrega</a></li>
                                <li><a href="javascript:void(0)" onclick="AppCore.openInstitucional('privacidade')" class="hover:text-white hover:translate-x-1 flex items-center gap-2"><i class="ph ph-caret-right text-[10px]"></i> Privacidade</a></li>
                                <li><a href="javascript:void(0)" onclick="AppCore.openInstitucional('termos')" class="hover:text-white hover:translate-x-1 flex items-center gap-2"><i class="ph ph-caret-right text-[10px]"></i> Termos e Condições</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="text-lg font-bold mb-6 relative inline-block">Atendimento<span class="absolute -bottom-2 left-0 w-8 h-1 bg-accent"></span></h4>
                            <ul class="space-y-4 text-sm text-white/60">
                                <li class="flex items-start gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all" onclick="AppCore.openMapModal()">
                                    <i class="ph ph-map-pin text-xl text-accent"></i>
                                    <span>Rua Santa Sofia 53 - Ideal<br>Novo Hamburgo - RS, 93336-200</span>
                                </li>
                                <li class="flex items-center gap-3"><i class="ph ph-phone text-xl text-accent"></i><span>(51) 3581-5940</span></li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="text-lg font-bold mb-6 relative inline-block">Segurança<span class="absolute -bottom-2 left-0 w-8 h-1 bg-accent"></span></h4>
                            <div class="flex flex-wrap gap-3 mb-6">
                                <div class="bg-white/5 p-2 rounded border border-white/10 flex items-center gap-2"><i class="ph ph-shield-check text-2xl text-green-400"></i><span class="text-[10px] leading-tight uppercase font-bold">Site<br>Seguro</span></div>
                                <div class="bg-white/5 p-2 rounded border border-white/10 flex items-center gap-2"><i class="ph ph-lock-key text-2xl text-blue-400"></i><span class="text-[10px] leading-tight uppercase font-bold">SSL<br>256-bit</span></div>
                            </div>
                            <h4 class="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Pagamento</h4>
                            <div class="flex flex-wrap gap-2 opacity-60"><i class="ph ph-credit-card text-2xl"></i><i class="ph ph-barcode text-2xl"></i><i class="ph ph-pix-logo text-2xl"></i></div>
                        </div>
                    </div>
                    <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-white/40 text-[11px]">
                        <p>${footerText}</p>
                        <a href="https://sulcore.com" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 hover:text-white/80 transition" title="Sistema desenvolvido por SulCore">
                            <span class="w-4 h-4 rounded flex items-center justify-center bg-white/10">
                                <i class="ph-bold ph-cube text-[8px]"></i>
                            </span>
                            <span style="font-family: 'Inter', monospace; letter-spacing: 0.18em; font-size: 0.6rem;">SULCORE</span>
                            <span class="text-white/30">· © ${year}</span>
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
            <div id="cart-overlay" class="fixed inset-0 z-[130] bg-black/50 opacity-0 invisible transition-all duration-300" onclick="AppCore.closeCart()"></div>
            <div id="cart-drawer" class="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-[140] transform translate-x-full transition-transform duration-400 flex flex-col">
                <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-primary flex items-center gap-2"><i class="ph ph-shopping-cart text-2xl"></i> Meu Carrinho</h3>
                    <button onclick="AppCore.closeCart()" class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><i class="ph ph-x text-xl"></i></button>
                </div>
                <div id="cart-items-list" class="flex-1 overflow-y-auto cart-items-container p-5 space-y-4"></div>
                <div class="border-t border-gray-100 p-5 space-y-4">
                    <div class="flex items-center justify-between"><span class="text-gray-600 font-medium">Subtotal</span><span id="cart-subtotal" class="text-2xl font-bold text-primary">R$ 0,00</span></div>
                    <button class="w-full bg-accent hover:bg-accent/90 text-white py-4 rounded-xl font-bold text-lg shadow-lg" onclick="AppCore.showMessage('Finalizar Pedido','Redirecionando para checkout...')">Finalizar Pedido</button>
                    <button onclick="AppCore.closeCart()" class="w-full text-gray-500 text-sm hover:text-gray-700">Continuar Comprando</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    }
    // Estilos específicos para garantir scroll no painel institucional
const style = document.createElement('style');
style.textContent = `
    .panel-content {
        max-height: calc(90vh - 100px);
        overflow-y: auto;
        padding-right: 4px;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 #f1f5f9;
    }
    .panel-content::-webkit-scrollbar {
        width: 4px;
    }
    .panel-content::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 4px;
    }
    .panel-content::-webkit-scrollbar-track {
        background: #f1f5f9;
    }
    /* Ajuste para desktop: centralização e limite de altura */
    @media (min-width: 768px) {
        #institucional-panel {
            max-width: 720px;
            left: 50%;
            transform: translateX(-50%) translateY(100%);
        }
        #institucional-panel.translate-y-0 {
            transform: translateX(-50%) translateY(0) !important;
        }
    }
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
        const itemsContainer = document.getElementById('cart-items-list');
        const subtotalEl = document.getElementById('cart-subtotal');
        if (!counter || !itemsContainer || !subtotalEl) return;

        const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
        counter.textContent = totalItems;
        counter.style.display = totalItems > 0 ? 'flex' : 'none';

        if (cartItems.length === 0) {
            itemsContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 py-12"><i class="ph ph-shopping-cart text-6xl mb-4 opacity-40"></i><p class="text-lg font-medium">Seu carrinho está vazio</p></div>`;
            subtotalEl.textContent = 'R$ 0,00';
            return;
        }

        let html = '';
        cartItems.forEach(item => {
            const img = item.image || 'https://placehold.co/100x100?text=Produto';
            const qty = item.quantity || 1;
            html += `<div class="flex gap-4 bg-gray-50 p-3 rounded-xl">
                <div class="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-1"><img src="${img}" alt="${item.name}" class="max-w-full max-h-full object-contain" onerror="this.src='https://placehold.co/100x100'"></div>
                <div class="flex-1"><h4 class="font-semibold text-gray-800 text-sm line-clamp-2">${item.name}</h4><div class="flex items-center justify-between mt-2"><span class="text-primary font-bold">R$ ${(item.price * qty).toFixed(2)}</span><button onclick="AppCore.removeFromCart('${item.id}')" class="text-gray-400 hover:text-accent"><i class="ph ph-trash text-lg"></i></button></div>${qty>1?`<p class="text-xs text-gray-500 mt-1">Qtd: ${qty}</p>`:''}</div>
            </div>`;
        });
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
        if (drawer.classList.contains('translate-x-full')) {
            openCart();
        } else {
            closeCart();
        }
    }

    function openCart() {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        drawer.classList.remove('translate-x-full');
        drawer.classList.add('translate-x-0');
        overlay.classList.remove('opacity-0', 'invisible');
        overlay.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        drawer.classList.add('translate-x-full');
        drawer.classList.remove('translate-x-0');
        overlay.classList.add('opacity-0', 'invisible');
        overlay.classList.remove('opacity-100');
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
                <button id="openLoginBtn" type="button" class="flex items-center gap-2 text-white p-2 hover:bg-white/10 rounded-lg transition-all">
                    <i class="ph ph-sign-in text-2xl"></i>
                    <span class="hidden lg:inline text-sm font-medium">Entrar</span>
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
            <button id="accountBtn" class="flex items-center gap-2 text-white p-2 hover:bg-white/10 rounded-lg transition-all">
                <span class="w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center">${initial}</span>
                <span class="hidden lg:inline text-sm font-medium truncate max-w-[140px]">${displayName}</span>
                <i class="ph ph-caret-down text-xs"></i>
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