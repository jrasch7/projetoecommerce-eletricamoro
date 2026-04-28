(function() {
    'use strict';

    // Google Fonts mapping
    const googleFonts = {
        'Inter': 'Inter:wght@300;400;500;600;700;800',
        'Montserrat': 'Montserrat:wght@300;400;500;600;700;800',
        'Roboto': 'Roboto:wght@300;400;500;700;900',
        'Open Sans': 'Open+Sans:wght@300;400;500;600;700;800',
        'Poppins': 'Poppins:wght@300;400;500;600;700;800'
    };

    // Default theme values
    const defaultConfig = {
        primaryColor: '#0a2540',
        secondaryColor: '#1a365d',
        accentColor: '#e74c3c',
        logo: '',
        fontFamily: 'Inter',
        bannerText: '',
        bannerEnabled: false
    };

    // Load Google Fonts dynamically
    function loadGoogleFont(fontName) {
        const fontUrl = googleFonts[fontName];
        if (!fontUrl) return;

        // Check if font link already exists
        const existingLink = document.querySelector(`link[href*="fonts.googleapis.com"][data-font="${fontName}"]`);
        if (existingLink) return;

        // Create and inject Google Fonts link
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap`;
        link.setAttribute('data-font', fontName);
        document.head.appendChild(link);
    }

    // Apply theme as CSS variables (synchronous, for immediate application)
    function applyTheme(config) {
        const root = document.documentElement;
        const fontFamily = config.fontFamily || defaultConfig.fontFamily;
        
        // Load Google Font
        loadGoogleFont(fontFamily);
        
        // Set CSS variables immediately
        root.style.setProperty('--color-primary', config.primaryColor || defaultConfig.primaryColor);
        root.style.setProperty('--color-secondary', config.secondaryColor || defaultConfig.secondaryColor);
        root.style.setProperty('--color-accent', config.accentColor || defaultConfig.accentColor);
        root.style.setProperty('--font-family', `${fontFamily}, sans-serif`);
        
        // Update Tailwind config dynamically
        if (window.tailwind) {
            window.tailwind.config.theme.extend.colors.primary = config.primaryColor || defaultConfig.primaryColor;
            window.tailwind.config.theme.extend.colors.secondary = config.secondaryColor || defaultConfig.secondaryColor;
            window.tailwind.config.theme.extend.colors.accent = config.accentColor || defaultConfig.accentColor;
            window.tailwind.config.theme.extend.fontFamily.sans = [fontFamily, 'sans-serif'];
        }
        
        // Inject favicon
        if (config.favicon) {
            let faviconLink = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
            if (!faviconLink) {
                faviconLink = document.createElement('link');
                faviconLink.rel = 'icon';
                document.head.appendChild(faviconLink);
            }
            faviconLink.href = config.favicon;
        }
        
        // Update page title
        if (config.metaTitle) {
            document.title = config.metaTitle;
        } else if (config.storeName) {
            document.title = config.storeName;
        }
        
        // Update meta description
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.name = 'description';
            document.head.appendChild(metaDescription);
        }
        metaDescription.content = config.metaDescription || '';
        
        // Update meta keywords
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.name = 'keywords';
            document.head.appendChild(metaKeywords);
        }
        metaKeywords.content = config.metaKeywords || '';
        
        // Update Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.content = config.metaTitle || config.storeName || '';
        } else if (config.metaTitle || config.storeName) {
            const meta = document.createElement('meta');
            meta.property = 'og:title';
            meta.content = config.metaTitle || config.storeName || '';
            document.head.appendChild(meta);
        }
        
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            ogDescription.content = config.metaDescription || '';
        } else if (config.metaDescription) {
            const meta = document.createElement('meta');
            meta.property = 'og:description';
            meta.content = config.metaDescription || '';
            document.head.appendChild(meta);
        }
        
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
            ogImage.content = config.logo || '';
        } else if (config.logo) {
            const meta = document.createElement('meta');
            meta.property = 'og:image';
            meta.content = config.logo || '';
            document.head.appendChild(meta);
        }
        
        // Store config globally for other scripts
        window.storeConfig = config;
        
        // Dispatch event for other scripts to react
        window.dispatchEvent(new CustomEvent('themeLoaded', { detail: config }));
    }

    // Estratégia anti-flash:
    // 1. Lê config injetado pelo SSR (<script id="ssr-config">) — sincrono, zero flash
    // 2. Fallback: cache localStorage da última config — também sincrono
    // 3. Background: revalida via /api/config e atualiza se mudou
    function readSsrConfig() {
        const tag = document.getElementById('ssr-config');
        if (!tag) return null;
        try {
            const parsed = JSON.parse(tag.textContent || '{}');
            return Object.keys(parsed).length ? parsed : null;
        } catch (e) { return null; }
    }
    function readCacheConfig() {
        try { return JSON.parse(localStorage.getItem('eletrica_moro_theme') || 'null'); }
        catch (e) { return null; }
    }
    function saveCacheConfig(cfg) {
        try { localStorage.setItem('eletrica_moro_theme', JSON.stringify(cfg)); }
        catch (e) {}
    }

    // Aplica IMEDIATAMENTE a melhor fonte disponível (SSR > cache > defaults)
    const initial = readSsrConfig() || readCacheConfig() || defaultConfig;
    applyTheme(initial);

    // Em background, revalida com a API e atualiza se houver divergência
    async function revalidate() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) return;
            const data = await response.json();
            const config = data.config || defaultConfig;
            saveCacheConfig(config);
            // Só re-aplica se mudou (evita re-flash desnecessário)
            if (JSON.stringify(config) !== JSON.stringify(initial)) {
                applyTheme(config);
            }
        } catch (error) {
            // silencioso — cache/SSR já cobriu
        }
    }
    // Pequeno delay pra não competir com renderização inicial
    if (document.readyState === 'complete') revalidate();
    else window.addEventListener('load', revalidate, { once: true });
})();
