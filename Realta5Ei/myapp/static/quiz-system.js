class InteractiveQuiz {
    constructor(quizId, containerId) {
        this.quizId = quizId;
        this.container = document.getElementById(containerId);
        this.currentQuestion = 0;
        this.responses = [];
        this.startTime = null;
        this.timerInterval = null;
        this.quizData = null;
        this.studentName = localStorage.getItem('student_name') || '';
        this.classGroup = localStorage.getItem('class_group') || '';
        
        this.init();
    }
    
    async init() {
        await this.loadQuiz();
        this.renderStartScreen();
    }
    
    async loadQuiz() {
        const response = await fetch(`/api/quiz/${this.quizId}/`);
        this.quizData = await response.json();
    }
    
    renderStartScreen() {
        this.container.innerHTML = `
            <div class="quiz-start-screen">
                <div class="quiz-header">
                    <div class="quiz-icon">📝</div>
                    <h2>${this.quizData.title}</h2>
                    <p class="quiz-description">${this.quizData.description}</p>
                </div>
                
                <div class="quiz-info">
                    <div class="info-card">
                        <span class="info-icon">📊</span>
                        <div>
                            <strong>Difficoltà</strong>
                            <p>${this.quizData.difficulty}</p>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <span class="info-icon">❓</span>
                        <div>
                            <strong>Domande</strong>
                            <p>${this.quizData.questions.length}</p>
                        </div>
                    </div>
                    
                    ${this.quizData.time_limit ? `
                        <div class="info-card">
                            <span class="info-icon">⏱️</span>
                            <div>
                                <strong>Tempo Limite</strong>
                                <p>${Math.floor(this.quizData.time_limit / 60)} minuti</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="info-card">
                        <span class="info-icon">🎯</span>
                        <div>
                            <strong>Punteggio Minimo</strong>
                            <p>${this.quizData.passing_score}%</p>
                        </div>
                    </div>
                </div>
                
                <div class="student-info-form">
                    <input type="text" id="student-name" placeholder="Il tuo nome" value="${this.studentName}" required>
                    <input type="text" id="class-group" placeholder="Classe (es. 5A)" value="${this.classGroup}" required>
                </div>
                
                <button class="btn-start-quiz">
                    <span>Inizia il Quiz</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </button>
            </div>
        `;
        
        this.container.querySelector('.btn-start-quiz').addEventListener('click', () => {
            this.startQuiz();
        });
    }
    
    startQuiz() {
        this.studentName = document.getElementById('student-name').value.trim();
        this.classGroup = document.getElementById('class-group').value.trim();
        
        if (!this.studentName || !this.classGroup) {
            alert('Per favore inserisci il tuo nome e la classe');
            return;
        }
        
        localStorage.setItem('student_name', this.studentName);
        localStorage.setItem('class_group', this.classGroup);
        
        this.startTime = Date.now();
        
        if (this.quizData.time_limit) {
            this.startTimer();
        }
        
        this.showQuestion(0);
    }
    
    startTimer() {
        let timeLeft = this.quizData.time_limit;
        
        this.timerInterval = setInterval(() => {
            timeLeft--;
            
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            const timerElement = document.querySelector('.quiz-timer');
            if (timerElement) {
                timerElement.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                if (timeLeft <= 60) {
                    timerElement.classList.add('warning');
                }
                if (timeLeft <= 30) {
                    timerElement.classList.add('critical');
                }
            }
            
            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.submitQuiz();
            }
        }, 1000);
    }
    
    showQuestion(index) {
        this.currentQuestion = index;
        const question = this.quizData.questions[index];
        
        this.container.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-progress-bar">
                    <div class="progress-fill" style="width: ${((index + 1) / this.quizData.questions.length) * 100}%"></div>
                </div>
                
                <div class="quiz-header-bar">
                    <span class="question-counter">Domanda ${index + 1} di ${this.quizData.questions.length}</span>
                    ${this.quizData.time_limit ? '<span class="quiz-timer"></span>' : ''}
                </div>
                
                <div class="question-card">
                    <div class="question-header">
                        <span class="question-points">⭐ ${question.points} punt${question.points > 1 ? 'i' : 'o'}</span>
                        <span class="question-type">${this.getQuestionTypeLabel(question.type)}</span>
                    </div>
                    
                    <h3 class="question-text">${question.text}</h3>
                    
                    <div class="answers-container" id="answers-${question.id}">
                        ${this.renderAnswers(question)}
                    </div>
                </div>
                
                <div class="quiz-navigation">
                    ${index > 0 ? `
                        <button class="btn-prev">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="19" y1="12" x2="5" y2="12"/>
                                <polyline points="12 19 5 12 12 5"/>
                            </svg>
                            Precedente
                        </button>
                    ` : '<div></div>'}
                    
                    ${index < this.quizData.questions.length - 1 ? `
                        <button class="btn-next">
                            Successiva
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"/>
                                <polyline points="12 5 19 12 12 19"/>
                            </svg>
                        </button>
                    ` : `
                        <button class="btn-submit">
                            Consegna Quiz 🎯
                        </button>
                    `}
                </div>
            </div>
        `;
        
        if (index > 0) {
            this.container.querySelector('.btn-prev').addEventListener('click', () => {
                this.showQuestion(index - 1);
            });
        }
        
        if (index < this.quizData.questions.length - 1) {
            this.container.querySelector('.btn-next').addEventListener('click', () => {
                this.nextQuestion();
            });
        } else {
            this.container.querySelector('.btn-submit').addEventListener('click', () => {
                this.submitQuiz();
            });
        }
        
        const savedResponse = this.responses.find(r => r.question_id === question.id);
        if (savedResponse) {
            if (question.type === 'open_ended') {
                const textarea = document.getElementById(`open-${question.id}`);
                if (textarea) textarea.value = savedResponse.answer_text || '';
            } else {
                const radio = document.querySelector(`input[value="${savedResponse.answer_id}"]`);
                if (radio) radio.checked = true;
            }
        }
    }
    
    renderAnswers(question) {
        if (question.type === 'multiple_choice' || question.type === 'true_false') {
            return question.answers.map((answer, index) => `
                <label class="answer-option">
                    <input type="radio" name="question-${question.id}" value="${answer.id}">
                    <div class="answer-content">
                        <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
                        <span class="answer-text">${answer.text}</span>
                    </div>
                    <div class="answer-checkmark">✓</div>
                </label>
            `).join('');
        }
        
        if (question.type === 'open_ended') {
            return `
                <textarea class="open-answer" id="open-${question.id}" 
                          placeholder="Scrivi qui la tua risposta..."></textarea>
            `;
        }
        
        return '';
    }
    
    getQuestionTypeLabel(type) {
        const labels = {
            'multiple_choice': '📋 Scelta Multipla',
            'true_false': '✓✗ Vero o Falso',
            'open_ended': '✍️ Risposta Aperta',
            'matching': '🔗 Abbinamento'
        };
        return labels[type] || type;
    }
    
    nextQuestion() {
        const currentQ = this.quizData.questions[this.currentQuestion];
        
        if (currentQ.type === 'open_ended') {
            const textarea = document.getElementById(`open-${currentQ.id}`);
            if (textarea && textarea.value.trim()) {
                this.saveOpenResponse(currentQ.id, textarea.value);
            }
        } else {
            const selected = document.querySelector(`input[name="question-${currentQ.id}"]:checked`);
            if (selected) {
                this.saveResponse(currentQ.id, parseInt(selected.value));
            }
        }
        
        this.showQuestion(this.currentQuestion + 1);
    }
    
    saveResponse(questionId, answerId) {
        const existingIndex = this.responses.findIndex(r => r.question_id === questionId);
        
        if (existingIndex >= 0) {
            this.responses[existingIndex].answer_id = answerId;
        } else {
            this.responses.push({
                question_id: questionId,
                answer_id: answerId
            });
        }
    }
    
    saveOpenResponse(questionId, text) {
        const existingIndex = this.responses.findIndex(r => r.question_id === questionId);
        
        if (existingIndex >= 0) {
            this.responses[existingIndex].answer_text = text;
        } else {
            this.responses.push({
                question_id: questionId,
                answer_text: text
            });
        }
    }
    
    async submitQuiz() {
        const currentQ = this.quizData.questions[this.currentQuestion];
        
        if (currentQ.type === 'open_ended') {
            const textarea = document.getElementById(`open-${currentQ.id}`);
            if (textarea && textarea.value.trim()) {
                this.saveOpenResponse(currentQ.id, textarea.value);
            }
        } else {
            const selected = document.querySelector(`input[name="question-${currentQ.id}"]:checked`);
            if (selected) {
                this.saveResponse(currentQ.id, parseInt(selected.value));
            }
        }
        
        if (this.responses.length < this.quizData.questions.length) {
            if (!confirm(`Hai risposto solo a ${this.responses.length} domande su ${this.quizData.questions.length}. Vuoi consegnare comunque?`)) {
                return;
            }
        }
        
        clearInterval(this.timerInterval);
        
        const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
        
        try {
            const response = await fetch(`/api/quiz/${this.quizId}/submit/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    student_name: this.studentName,
                    class_group: this.classGroup,
                    responses: this.responses,
                    time_taken: timeTaken
                })
            });
            
            const results = await response.json();
            this.showResults(results);
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert('Errore nell\'invio del quiz. Riprova.');
        }
    }
    
    showResults(results) {
        const passed = results.passed;
        
        this.container.innerHTML = `
            <div class="quiz-results">
                <div class="results-header ${passed ? 'passed' : 'failed'}">
                    <div class="results-icon">${passed ? '🎉' : '📚'}</div>
                    <h2>${passed ? 'Complimenti!' : 'Continua a studiare!'}</h2>
                    <p>${passed ? 'Hai superato il quiz!' : 'Non hai raggiunto il punteggio minimo.'}</p>
                </div>
                
                <div class="score-display">
                    <div class="score-circle">
                        <svg viewBox="0 0 200 200">
                            <circle cx="100" cy="100" r="90" fill="none" stroke="#e0e0e0" stroke-width="20"/>
                            <circle cx="100" cy="100" r="90" fill="none" stroke="${passed ? '#4CAF50' : '#FF9800'}" 
                                    stroke-width="20" stroke-dasharray="565.48" 
                                    stroke-dashoffset="${565.48 * (1 - results.percentage / 100)}"
                                    transform="rotate(-90 100 100)"/>
                        </svg>
                        <div class="score-text">
                            <span class="score-percentage">${Math.round(results.percentage)}%</span>
                            <span class="score-fraction">${results.score}/${results.max_score}</span>
                        </div>
                    </div>
                </div>
                
                <div class="results-details">
                    <h3>📊 Riepilogo Risposte</h3>
                    ${results.results.map((result, index) => `
                        <div class="result-item ${result.is_correct ? 'correct' : 'incorrect'}">
                            <div class="result-header">
                                <span class="result-icon">${result.is_correct ? '✅' : '❌'}</span>
                                <span class="result-question">Domanda ${index + 1}</span>
                                <span class="result-points">${result.points_earned} punti</span>
                            </div>
                            ${!result.is_correct && result.explanation ? `
                                <div class="result-explanation">
                                    <strong>💡 Spiegazione:</strong>
                                    <p>${result.explanation}</p>
                                    ${result.correct_answer ? `
                                        <p><strong>Risposta corretta:</strong> ${result.correct_answer}</p>
                                    ` : ''}
                                </div>
                            ` : ''}
                            ${result.feedback ? `
                                <div class="result-feedback">
                                    <p>${result.feedback}</p>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="results-actions">
                    <button class="btn-retry">
                        🔄 Riprova il Quiz
                    </button>
                    <button class="btn-back">
                        ← Torna all'Articolo
                    </button>
                </div>
            </div>
        `;
        
        this.container.querySelector('.btn-retry').addEventListener('click', () => {
            location.reload();
        });
        
        this.container.querySelector('.btn-back').addEventListener('click', () => {
            window.history.back();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const quizContainer = document.getElementById('quiz-container');
    if (quizContainer && quizContainer.dataset.quizId) {
        const quizId = parseInt(quizContainer.dataset.quizId);
        window.quiz = new InteractiveQuiz(quizId, 'quiz-container');
    }
});
