class GlossaryHighlighter {
    constructor() {
        this.terms = [];
        this.init();
    }
    
    async init() {
        await this.loadTerms();
        this.highlightTerms();
        this.createGlossaryPanel();
    }
    
    async loadTerms() {
        try {
            const response = await fetch('/api/glossary/terms/');
            const data = await response.json();
            this.terms = data.terms;
        } catch (error) {
            console.error('Error loading glossary terms:', error);
        }
    }
    
    highlightTerms() {
        const textElements = document.querySelectorAll('.slide-text-content, .card-description, .article-hero-content p');
        
        textElements.forEach(element => {
            let html = element.innerHTML;
            
            this.terms.forEach(term => {
                const regex = new RegExp(`\\b(${this.escapeRegex(term.term)})\\b`, 'gi');
                html = html.replace(regex, (match) => {
                    return `<span class="glossary-term" data-term-id="${term.id}" title="Clicca per saperne di più">${match}</span>`;
                });
            });
            
            element.innerHTML = html;
        });
        
        document.querySelectorAll('.glossary-term').forEach(term => {
            term.addEventListener('mouseenter', (e) => this.showTooltip(e));
            term.addEventListener('mouseleave', (e) => this.hideTooltip(e));
            term.addEventListener('click', (e) => this.showFullDefinition(e));
        });
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    showTooltip(event) {
        const termId = parseInt(event.target.dataset.termId);
        const term = this.terms.find(t => t.id === termId);
        
        if (!term) return;
        
        const existingTooltip = document.querySelector('.glossary-tooltip');
        if (existingTooltip) existingTooltip.remove();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'glossary-tooltip';
        tooltip.innerHTML = `
            <strong>${term.term}</strong>
            <p>${term.definition}</p>
            <small>Clicca per saperne di più</small>
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.top = (rect.bottom + window.scrollY + 10) + 'px';
        tooltip.style.left = (rect.left + window.scrollX) + 'px';
        
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = (window.innerWidth - tooltipRect.width - 20) + 'px';
        }
    }
    
    hideTooltip(event) {
        setTimeout(() => {
            const tooltip = document.querySelector('.glossary-tooltip');
            if (tooltip && !tooltip.matches(':hover')) {
                tooltip.remove();
            }
        }, 100);
    }
    
    showFullDefinition(event) {
        const termId = parseInt(event.target.dataset.termId);
        const term = this.terms.find(t => t.id === termId);
        
        if (!term) return;
        
        const existingModal = document.querySelector('.glossary-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'glossary-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">×</button>
                <h2>${term.term}</h2>
                ${term.image ? `<img src="${term.image}" alt="${term.term}">` : ''}
                <div class="term-definition">
                    <h3>Definizione</h3>
                    <p>${term.definition}</p>
                </div>
                ${term.extended_explanation ? `
                    <div class="term-explanation">
                        <h3>Approfondimento</h3>
                        <p>${term.extended_explanation}</p>
                    </div>
                ` : ''}
                ${term.video_url ? `
                    <div class="term-video">
                        <h3>Video</h3>
                        <iframe src="${term.video_url}" frameborder="0" allowfullscreen></iframe>
                    </div>
                ` : ''}
                ${term.related_articles && term.related_articles.length > 0 ? `
                    <div class="term-related">
                        <h3>Articoli Correlati</h3>
                        <ul>
                            ${term.related_articles.map(a => 
                                `<li><a href="/article/${a.id}/">${a.title}</a></li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            }
        });
    }
    
    createGlossaryPanel() {
        const panel = document.createElement('div');
        panel.className = 'glossary-panel';
        panel.innerHTML = `
            <button class="glossary-toggle">📖 Glossario</button>
            <div class="glossary-content">
                <h3>Termini del Glossario</h3>
                <input type="text" class="glossary-search" placeholder="Cerca un termine...">
                <div class="glossary-list">
                    ${this.terms.map(term => `
                        <div class="glossary-item" data-term-id="${term.id}">
                            <strong>${term.term}</strong>
                            <p>${term.definition.substring(0, 100)}...</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        panel.querySelector('.glossary-toggle').addEventListener('click', () => {
            panel.classList.toggle('active');
        });
        
        panel.querySelectorAll('.glossary-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const termId = parseInt(e.currentTarget.dataset.termId);
                const term = this.terms.find(t => t.id === termId);
                if (term) {
                    const fakeEvent = {
                        target: {
                            dataset: { termId: termId }
                        }
                    };
                    this.showFullDefinition(fakeEvent);
                }
            });
        });
        
        const searchInput = panel.querySelector('.glossary-search');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            panel.querySelectorAll('.glossary-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}

let glossaryHighlighter;
document.addEventListener('DOMContentLoaded', () => {
    glossaryHighlighter = new GlossaryHighlighter();
});
