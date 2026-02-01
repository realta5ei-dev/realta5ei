class ProgressTracker {
    constructor() {
        this.studentName = localStorage.getItem('student_name') || '';
        this.classGroup = localStorage.getItem('class_group') || '';
        this.articleId = this.getArticleId();
        this.startTime = Date.now();
        this.completionPercentage = 0;
        this.updateInterval = null;
        
        if (this.articleId) {
            this.init();
        }
    }
    
    getArticleId() {
        const path = window.location.pathname;
        const match = path.match(/\/article\/([^\/]+)\//);
        return match ? match[1] : null;
    }
    
    init() {
        this.trackScrollProgress();
        this.startTimeTracking();
        this.loadProgress();
        this.createProgressIndicator();
    }
    
    trackScrollProgress() {
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.updateScrollProgress();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
    
    updateScrollProgress() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        
        const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100;
        this.completionPercentage = Math.min(100, Math.max(0, scrollPercentage));
        
        this.updateProgressIndicator();
    }
    
    startTimeTracking() {
        this.updateInterval = setInterval(() => {
            this.saveProgress();
        }, 30000);
        
        window.addEventListener('beforeunload', () => {
            this.saveProgress();
        });
    }
    
    async saveProgress() {
        if (!this.studentName || !this.classGroup || !this.articleId) return;
        
        const timeSpent = Math.floor((Date.now() - this.startTime) / 1000);
        
        try {
            const response = await fetch('/api/progress/update/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    student_name: this.studentName,
                    class_group: this.classGroup,
                    article_id: this.articleId,
                    completion_percentage: this.completionPercentage,
                    time_increment: timeSpent
                })
            });
            
            const data = await response.json();
            this.startTime = Date.now();
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }
    
    async loadProgress() {
        if (!this.studentName || !this.classGroup) return;
        
        try {
            const response = await fetch(`/api/progress/get/?student_name=${this.studentName}&class_group=${this.classGroup}`);
            const data = await response.json();
            
            const currentProgress = data.progress.find(p => p.article_id === this.articleId);
            if (currentProgress) {
                console.log(`Progress loaded: ${currentProgress.completion}%`);
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    }
    
    createProgressIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'progress-indicator';
        indicator.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">0% completato</div>
        `;
        
        document.body.appendChild(indicator);
    }
    
    updateProgressIndicator() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill) {
            progressFill.style.width = this.completionPercentage + '%';
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(this.completionPercentage)}% completato`;
        }
    }
}

let progressTracker;
document.addEventListener('DOMContentLoaded', () => {
    progressTracker = new ProgressTracker();
});
