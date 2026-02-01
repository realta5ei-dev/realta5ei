class CollaborativeNotes {
    constructor(articleId) {
        this.articleId = articleId;
        this.classGroup = localStorage.getItem('class_group') || '';
        this.studentName = localStorage.getItem('student_name') || '';
        this.content = '';
        this.version = 0;
        this.saveTimeout = null;
        this.init();
    }
    
    async init() {
        await this.loadNote();
        this.createNoteEditor();
    }
    
    async loadNote() {
        if (!this.classGroup) return;
        
        try {
            const response = await fetch(`/api/notes/collaborative/get/?article_id=${this.articleId}&class_group=${this.classGroup}`);
            const data = await response.json();
            
            this.content = data.content;
            this.version = data.version;
        } catch (error) {
            console.error('Error loading note:', error);
        }
    }
    
    createNoteEditor() {
        const editor = document.createElement('div');
        editor.className = 'collaborative-notes-editor';
        editor.innerHTML = `
            <div class="notes-header">
                <h3>📝 Note Collaborative della Classe</h3>
                <div class="notes-info">
                    <span class="notes-version">Versione ${this.version}</span>
                    <button class="notes-toggle">Espandi</button>
                </div>
            </div>
            <div class="notes-content" style="display: none;">
                <div class="notes-toolbar">
                    <button class="toolbar-btn" data-action="bold">
                        <strong>B</strong>
                    </button>
                    <button class="toolbar-btn" data-action="italic">
                        <em>I</em>
                    </button>
                    <button class="toolbar-btn" data-action="list">
                        ≡
                    </button>
                </div>
                <textarea class="notes-textarea" placeholder="Scrivi qui le note collaborative della classe...">${this.content}</textarea>
                <div class="notes-footer">
                    <span class="save-status">Salvato automaticamente</span>
                    <button class="btn-save-notes">Salva Ora</button>
                </div>
            </div>
        `;
        
        const container = document.querySelector('.presentations-container');
        if (container) {
            container.before(editor);
        }
        
        const toggleBtn = editor.querySelector('.notes-toggle');
        const notesContent = editor.querySelector('.notes-content');
        
        toggleBtn.addEventListener('click', () => {
            const isVisible = notesContent.style.display !== 'none';
            notesContent.style.display = isVisible ? 'none' : 'block';
            toggleBtn.textContent = isVisible ? 'Espandi' : 'Comprimi';
        });
        
        const textarea = editor.querySelector('.notes-textarea');
        textarea.addEventListener('input', (e) => {
            this.content = e.target.value;
            this.autoSave();
        });
        
        const saveBtn = editor.querySelector('.btn-save-notes');
        saveBtn.addEventListener('click', () => {
            this.saveNote();
        });
        
        editor.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.applyFormatting(action, textarea);
            });
        });
    }
    
    applyFormatting(action, textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        let formattedText = '';
        
        switch(action) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'list':
                formattedText = `\n- ${selectedText}`;
                break;
        }
        
        textarea.value = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
        this.content = textarea.value;
        this.autoSave();
    }
    
    autoSave() {
        clearTimeout(this.saveTimeout);
        
        const statusElement = document.querySelector('.save-status');
        if (statusElement) {
            statusElement.textContent = 'Modifiche non salvate...';
            statusElement.classList.add('unsaved');
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveNote();
        }, 3000);
    }
    
    async saveNote() {
        if (!this.studentName || !this.classGroup) {
            alert('Per salvare le note, inserisci il tuo nome e classe');
            return;
        }
        
        try {
            const response = await fetch('/api/notes/collaborative/update/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    article_id: this.articleId,
                    class_group: this.classGroup,
                    content: this.content,
                    contributor: this.studentName
                })
            });
            
            const data = await response.json();
            this.version = data.version;
            
            const statusElement = document.querySelector('.save-status');
            const versionElement = document.querySelector('.notes-version');
            
            if (statusElement) {
                statusElement.textContent = 'Salvato automaticamente';
                statusElement.classList.remove('unsaved');
            }
            
            if (versionElement) {
                versionElement.textContent = `Versione ${this.version}`;
            }
        } catch (error) {
            console.error('Error saving note:', error);
            
            const statusElement = document.querySelector('.save-status');
            if (statusElement) {
                statusElement.textContent = 'Errore nel salvataggio';
                statusElement.classList.add('error');
            }
        }
    }
}

let collaborativeNotes;
document.addEventListener('DOMContentLoaded', () => {
    const articleElement = document.querySelector('[data-article-id]');
    if (articleElement) {
        const articleId = articleElement.dataset.articleId;
        collaborativeNotes = new CollaborativeNotes(articleId);
    }
});
