class ReactionsSystem {
    constructor(articleId) {
        this.articleId = articleId;
        this.reactions = {
            heart: 0,
            star: 0,
            thinking: 0,
            clap: 0
        };
        this.init();
    }
    
    async init() {
        await this.loadReactions();
        this.createReactionsPanel();
        this.trackInteractions();
    }
    
    async loadReactions() {
        try {
            const response = await fetch(`/api/articles/${this.articleId}/reactions/get/`);
            const data = await response.json();
            this.reactions = data.reactions;
        } catch (error) {
            console.error('Error loading reactions:', error);
        }
    }
    
    createReactionsPanel() {
        const panel = document.createElement('div');
        panel.className = 'reactions-panel';
        panel.innerHTML = `
            <div class="reactions-container">
                <h4>Come ti fa sentire questo articolo?</h4>
                <div class="reactions-buttons">
                    <button class="reaction-btn" data-type="heart">
                        <span class="reaction-emoji">❤️</span>
                        <span class="reaction-count">${this.reactions.heart || 0}</span>
                    </button>
                    <button class="reaction-btn" data-type="star">
                        <span class="reaction-emoji">⭐</span>
                        <span class="reaction-count">${this.reactions.star || 0}</span>
                    </button>
                    <button class="reaction-btn" data-type="thinking">
                        <span class="reaction-emoji">🤔</span>
                        <span class="reaction-count">${this.reactions.thinking || 0}</span>
                    </button>
                    <button class="reaction-btn" data-type="clap">
                        <span class="reaction-emoji">👏</span>
                        <span class="reaction-count">${this.reactions.clap || 0}</span>
                    </button>
                </div>
            </div>
        `;
        
        const mainContent = document.querySelector('.article-hero');
        if (mainContent) {
            mainContent.after(panel);
        }
        
        panel.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.addReaction(type, btn);
            });
        });
    }
    
    async addReaction(type, button) {
        try {
            const response = await fetch(`/api/articles/${this.articleId}/reactions/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ type: type })
            });
            
            const data = await response.json();
            
            const countElement = button.querySelector('.reaction-count');
            countElement.textContent = data.count;
            
            if (data.action === 'added') {
                button.classList.add('active');
                this.animateReaction(button);
            } else {
                button.classList.remove('active');
            }
            
            this.reactions[type] = data.count;
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }
    
    animateReaction(button) {
        button.classList.add('pulse');
        setTimeout(() => {
            button.classList.remove('pulse');
        }, 600);
    }
    
    trackInteractions() {
        document.querySelectorAll('.card-link, .pdf-button').forEach(element => {
            element.addEventListener('click', (e) => {
                this.trackInteraction('click', e.target.className);
            });
        });
        
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.trackInteraction('scroll', `depth-${Math.round(window.scrollY)}`);
            }, 1000);
        });
    }
    
    async trackInteraction(type, element) {
        const studentName = localStorage.getItem('student_name') || '';
        
        try {
            await fetch('/api/interactions/track/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    article_id: this.articleId,
                    type: type,
                    element: element,
                    student_name: studentName
                })
            });
        } catch (error) {
            console.error('Error tracking interaction:', error);
        }
    }
}

let reactionsSystem;
document.addEventListener('DOMContentLoaded', () => {
    const articleElement = document.querySelector('[data-article-id]');
    if (articleElement) {
        const articleId = articleElement.dataset.articleId;
        reactionsSystem = new ReactionsSystem(articleId);
    }
});
