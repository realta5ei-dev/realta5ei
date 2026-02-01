class AnnotationSystem {
    constructor(slideElement) {
        this.slide = slideElement;
        this.selectedText = null;
        this.studentName = localStorage.getItem('student_name') || '';
        this.classGroup = localStorage.getItem('class_group') || '';
        this.init();
    }

    init() {
        this.slide.addEventListener('mouseup', (e) => {
            const selection = window.getSelection();
            const text = selection.toString().trim();

            if (text.length > 0) {
                this.showAnnotationDialog(text, e.clientX, e.clientY);
            }
        });

        this.loadAnnotations();
    }

    showAnnotationDialog(text, x, y) {
        const existingDialog = document.querySelector('.annotation-dialog');
        if (existingDialog) existingDialog.remove();

        const dialog = document.createElement('div');
        dialog.className = 'annotation-dialog';
        dialog.style.left = x + 'px';
        dialog.style.top = y + 'px';

        dialog.innerHTML = `
            <div class="annotation-form">
                <h4>📝 Aggiungi Nota</h4>
                <p class="selected-text">"${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"</p>
                <textarea placeholder="Scrivi la tua riflessione..." id="annotation-note"></textarea>
                <div class="color-picker">
                    <span class="color-option active" data-color="#FFD700" style="background: #FFD700;"></span>
                    <span class="color-option" data-color="#90EE90" style="background: #90EE90;"></span>
                    <span class="color-option" data-color="#87CEEB" style="background: #87CEEB;"></span>
                    <span class="color-option" data-color="#FFB6C1" style="background: #FFB6C1;"></span>
                </div>
                <label>
                    <input type="checkbox" id="annotation-public">
                    Condividi con la classe
                </label>
                <div class="dialog-actions">
                    <button class="btn-cancel">Annulla</button>
                    <button class="btn-save">Salva</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const colorOptions = dialog.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                colorOptions.forEach(o => o.classList.remove('active'));
                option.classList.add('active');
            });
        });

        dialog.querySelector('.btn-save').addEventListener('click', () => {
            this.saveAnnotation(text, x, y);
            dialog.remove();
        });

        dialog.querySelector('.btn-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!dialog.contains(e.target)) {
                    dialog.remove();
                }
            }, { once: true });
        }, 100);
    }

    async saveAnnotation(text, x, y) {
        const note = document.getElementById('annotation-note').value;
        const activeColor = document.querySelector('.color-option.active');
        const color = activeColor ? activeColor.dataset.color : '#FFD700';
        const isPublic = document.getElementById('annotation-public').checked;

        if (!note.trim()) {
            alert('Inserisci una nota!');
            return;
        }

        if (!this.studentName) {
            const name = prompt('Inserisci il tuo nome:');
            if (name) {
                this.studentName = name;
                localStorage.setItem('student_name', name);
            } else {
                return;
            }
        }

        if (!this.classGroup) {
            const group = prompt('Inserisci la tua classe (es. 5A):');
            if (group) {
                this.classGroup = group;
                localStorage.setItem('class_group', group);
            } else {
                return;
            }
        }

        try {
            const response = await fetch('/api/annotations/add/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    slide_id: this.slide.dataset.slideId,
                    text: text,
                    note: note,
                    x: x,
                    y: y,
                    color: color,
                    is_public: isPublic,
                    student_name: this.studentName,
                    class_group: this.classGroup
                })
            });

            const annotation = await response.json();
            this.renderAnnotation(annotation);
        } catch (error) {
            console.error('Error saving annotation:', error);
            alert('Errore nel salvataggio dell\'annotazione');
        }
    }

    async loadAnnotations() {
        if (!this.slide.dataset.slideId) return;

        try {
            const response = await fetch(`/api/annotations/slide/${this.slide.dataset.slideId}/?class_group=${this.classGroup}`);
            const data = await response.json();

            data.annotations.forEach(annotation => {
                this.renderAnnotation(annotation);
            });
        } catch (error) {
            console.error('Error loading annotations:', error);
        }
    }

    renderAnnotation(annotation) {
        const marker = document.createElement('div');
        marker.className = 'annotation-marker';
        marker.style.left = annotation.x + 'px';
        marker.style.top = annotation.y + 'px';
        marker.style.backgroundColor = annotation.color;
        marker.dataset.annotationId = annotation.id;

        marker.innerHTML = `
            <div class="annotation-tooltip">
                <div class="tooltip-header">
                    <strong>${annotation.student_name}</strong>
                    <small>${new Date(annotation.created_at).toLocaleDateString()}</small>
                </div>
                <p>${annotation.note}</p>
                <div class="annotation-actions">
                    <button class="btn-like" onclick="annotationSystem.likeAnnotation(${annotation.id}, this)">
                        ❤️ ${annotation.likes_count || 0}
                    </button>
                    <button class="btn-reply" onclick="annotationSystem.showReplyForm(${annotation.id})">
                        💬 ${annotation.replies_count || 0}
                    </button>
                </div>
            </div>
        `;

        this.slide.appendChild(marker);
    }

    async likeAnnotation(annotationId, button) {
        try {
            const response = await fetch(`/api/annotations/${annotationId}/like/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            const data = await response.json();
            button.textContent = `❤️ ${data.likes_count}`;
        } catch (error) {
            console.error('Error liking annotation:', error);
        }
    }

    showReplyForm(annotationId) {
        const replyText = prompt('Scrivi la tua risposta:');
        if (replyText && replyText.trim()) {
            this.addReply(annotationId, replyText);
        }
    }

    async addReply(annotationId, content) {
        if (!this.studentName) {
            const name = prompt('Inserisci il tuo nome:');
            if (name) {
                this.studentName = name;
                localStorage.setItem('student_name', name);
            } else {
                return;
            }
        }

        try {
            const response = await fetch(`/api/annotations/${annotationId}/reply/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    author_name: this.studentName,
                    content: content
                })
            });

            const data = await response.json();
            alert('Risposta aggiunta con successo!');
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    }
}

let annotationSystem;
document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide-card');
    slides.forEach((slide, index) => {
        if (!slide.dataset.slideId) {
            slide.dataset.slideId = slide.querySelector('.slide-number-badge')?.textContent || index;
        }
        new AnnotationSystem(slide);
    });
});