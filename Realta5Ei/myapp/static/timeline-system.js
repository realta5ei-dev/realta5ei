class HistoricalTimeline {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.events = [];
        this.currentIndex = 0;
        this.init();
    }
    
    async init() {
        await this.loadEvents();
        this.render();
    }
    
    async loadEvents() {
        try {
            const response = await fetch('/api/timeline/events/');
            const data = await response.json();
            this.events = data.events;
        } catch (error) {
            console.error('Error loading timeline events:', error);
        }
    }
    
    render() {
        if (this.events.length === 0) {
            this.container.innerHTML = '<p>Nessun evento disponibile</p>';
            return;
        }
        
        this.container.innerHTML = `
            <div class="timeline-container">
                <div class="timeline-header">
                    <h2>📅 Timeline Storica - Giornata della Memoria</h2>
                    <p>Esplora gli eventi chiave della Shoah</p>
                </div>
                
                <div class="timeline-line-wrapper">
                    <div class="timeline-line">
                        ${this.events.map((event, index) => `
                            <div class="timeline-point ${this.getImportanceClass(event.importance)} ${index === 0 ? 'active' : ''}"
                                 data-index="${index}"
                                 style="left: ${this.calculatePosition(index)}%">
                                <div class="point-marker"></div>
                                <div class="point-label">${new Date(event.date).getFullYear()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="timeline-content" id="timeline-content">
                    ${this.renderEvent(this.events[0])}
                </div>
                
                <div class="timeline-navigation">
                    <button class="btn-timeline-prev" ${this.currentIndex === 0 ? 'disabled' : ''}>
                        ← Precedente
                    </button>
                    <span class="timeline-counter">${this.currentIndex + 1} / ${this.events.length}</span>
                    <button class="btn-timeline-next" ${this.currentIndex === this.events.length - 1 ? 'disabled' : ''}>
                        Successivo →
                    </button>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.timeline-point').forEach(point => {
            point.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.showEvent(index);
            });
        });
        
        this.container.querySelector('.btn-timeline-prev').addEventListener('click', () => {
            this.prev();
        });
        
        this.container.querySelector('.btn-timeline-next').addEventListener('click', () => {
            this.next();
        });
    }
    
    calculatePosition(index) {
        if (this.events.length === 1) return 50;
        return (index / (this.events.length - 1)) * 90 + 5;
    }
    
    getImportanceClass(importance) {
        const classes = {
            1: 'importance-low',
            2: 'importance-medium',
            3: 'importance-high',
            4: 'importance-crucial'
        };
        return classes[importance] || '';
    }
    
    renderEvent(event) {
        return `
            <div class="event-card">
                ${event.image ? `
                    <div class="event-image">
                        <img src="${event.image}" alt="${event.title}">
                    </div>
                ` : ''}
                
                <div class="event-details">
                    <div class="event-date">${this.formatDate(event.date)}</div>
                    <h3>${event.title}</h3>
                    <p class="event-description">${event.full_description}</p>
                    
                    ${event.related_articles && event.related_articles.length > 0 ? `
                        <div class="event-related">
                            <h4>📚 Approfondisci nei progetti:</h4>
                            <ul>
                                ${event.related_articles.map(a => 
                                    `<li><a href="/article/${a.id}/">${a.title}</a></li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('it-IT', options);
    }
    
    showEvent(index) {
        this.currentIndex = index;
        const content = document.getElementById('timeline-content');
        content.innerHTML = this.renderEvent(this.events[index]);
        
        content.style.opacity = '0';
        content.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            content.style.transition = 'all 0.5s ease';
            content.style.opacity = '1';
            content.style.transform = 'translateY(0)';
        }, 10);
        
        document.querySelector('.timeline-counter').textContent = 
            `${this.currentIndex + 1} / ${this.events.length}`;
        
        document.querySelectorAll('.timeline-point').forEach((point, i) => {
            point.classList.toggle('active', i === index);
        });
        
        const prevBtn = this.container.querySelector('.btn-timeline-prev');
        const nextBtn = this.container.querySelector('.btn-timeline-next');
        
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === this.events.length - 1;
    }
    
    next() {
        if (this.currentIndex < this.events.length - 1) {
            this.showEvent(this.currentIndex + 1);
        }
    }
    
    prev() {
        if (this.currentIndex > 0) {
            this.showEvent(this.currentIndex - 1);
        }
    }
}

let timeline;
document.addEventListener('DOMContentLoaded', () => {
    const timelineContainer = document.getElementById('historical-timeline');
    if (timelineContainer) {
        timeline = new HistoricalTimeline('historical-timeline');
    }
});
