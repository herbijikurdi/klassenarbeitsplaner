class KlassenarbeitsPlaner {
    constructor() {
        this.exams = this.loadExams();
        this.currentDate = new Date();
        this.selectedDate = null;
        this.editingExam = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderCalendar();
        this.renderExamList();
    }

    bindEvents() {
        // Kalender Navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Modal Events
        document.getElementById('addExamBtn').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Form Submit
        document.getElementById('examForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExam();
        });

        // Modal außerhalb klicken
        document.getElementById('examModal').addEventListener('click', (e) => {
            if (e.target.id === 'examModal') {
                this.closeModal();
            }
        });

        // ESC-Taste für Modal schließen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Monat anzeigen
        const monthNames = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

        // Ersten Tag des Monats und Anzahl der Tage
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        // Ersten Wochentag (Montag = 0)
        let startDay = firstDay.getDay() - 1;
        if (startDay === -1) startDay = 6;

        const calendarBody = document.getElementById('calendarBody');
        calendarBody.innerHTML = '';

        // Vorherige Monatstage
        const prevMonth = new Date(year, month - 1, 0);
        const daysInPrevMonth = prevMonth.getDate();
        
        for (let i = startDay - 1; i >= 0; i--) {
            const dayElement = this.createDayElement(
                daysInPrevMonth - i, 
                new Date(year, month - 1, daysInPrevMonth - i),
                true
            );
            calendarBody.appendChild(dayElement);
        }

        // Aktuelle Monatstage
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayElement = this.createDayElement(day, date, false);
            calendarBody.appendChild(dayElement);
        }

        // Nächste Monatstage
        const totalCells = calendarBody.children.length;
        const remainingCells = 42 - totalCells; // 6 Wochen * 7 Tage
        
        for (let day = 1; day <= remainingCells; day++) {
            const dayElement = this.createDayElement(
                day, 
                new Date(year, month + 1, day),
                true
            );
            calendarBody.appendChild(dayElement);
        }
    }

    createDayElement(dayNumber, date, isOtherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }

        // Heute markieren
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }

        // Tag-Nummer
        const dayNumberElement = document.createElement('div');
        dayNumberElement.className = 'calendar-day-number';
        dayNumberElement.textContent = dayNumber;
        dayElement.appendChild(dayNumberElement);

        // Klassenarbeiten für diesen Tag
        const dayExams = this.getExamsForDate(date);
        if (dayExams.length > 0) {
            dayElement.classList.add('has-exam');
            dayExams.slice(0, 2).forEach(exam => {
                const examElement = document.createElement('div');
                examElement.className = 'exam-indicator';
                examElement.textContent = exam.subject;
                examElement.title = `${exam.subject}: ${exam.topic}`;
                dayElement.appendChild(examElement);
            });

            if (dayExams.length > 2) {
                const moreElement = document.createElement('div');
                moreElement.className = 'exam-indicator';
                moreElement.textContent = `+${dayExams.length - 2} weitere`;
                moreElement.style.background = '#666';
                dayElement.appendChild(moreElement);
            }
        }

        // Click Event für Tag
        dayElement.addEventListener('click', () => {
            this.selectedDate = date;
            this.openModal(date);
        });

        return dayElement;
    }

    getExamsForDate(date) {
        const dateString = this.formatDate(date);
        return this.exams.filter(exam => exam.date === dateString);
    }

    renderExamList() {
        const examList = document.getElementById('examList');
        
        if (this.exams.length === 0) {
            examList.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Noch keine Klassenarbeiten geplant.</p>';
            return;
        }

        // Sortiere nach Datum
        const sortedExams = [...this.exams].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Nur zukünftige und heutige Klassenarbeiten anzeigen
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingExams = sortedExams.filter(exam => {
            const examDate = new Date(exam.date);
            examDate.setHours(0, 0, 0, 0);
            return examDate >= today;
        });

        if (upcomingExams.length === 0) {
            examList.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Keine anstehenden Klassenarbeiten.</p>';
            return;
        }

        examList.innerHTML = upcomingExams.map(exam => this.createExamItemHTML(exam)).join('');

        // Event Listeners für Buttons
        examList.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const examId = btn.dataset.examId;
                this.editExam(examId);
            });
        });

        examList.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const examId = btn.dataset.examId;
                this.deleteExam(examId);
            });
        });
    }

    createExamItemHTML(exam) {
        const examDate = new Date(exam.date);
        const formattedDate = examDate.toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const timeDisplay = exam.time ? ` um ${exam.time}` : '';
        const teacherDisplay = exam.teacher ? `<span><i class="fas fa-user"></i> ${exam.teacher}</span>` : '';
        const notesDisplay = exam.notes ? `<div style="margin-top: 8px; font-style: italic; color: #666;">"${exam.notes}"</div>` : '';

        return `
            <div class="exam-item">
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}</div>
                    <div class="exam-date">${formattedDate}${timeDisplay}</div>
                </div>
                <div class="exam-topic">${exam.topic}</div>
                <div class="exam-details">
                    ${teacherDisplay}
                </div>
                ${notesDisplay}
                <div class="exam-actions">
                    <button class="btn-edit" data-exam-id="${exam.id}">
                        <i class="fas fa-edit"></i> Bearbeiten
                    </button>
                    <button class="btn-delete" data-exam-id="${exam.id}">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            </div>
        `;
    }

    openModal(date = null) {
        const modal = document.getElementById('examModal');
        const form = document.getElementById('examForm');
        const modalTitle = document.getElementById('modalTitle');

        if (this.editingExam) {
            modalTitle.textContent = 'Klassenarbeit bearbeiten';
            this.fillForm(this.editingExam);
        } else {
            modalTitle.textContent = 'Neue Klassenarbeit';
            form.reset();
            if (date) {
                document.getElementById('date').value = this.formatDate(date);
            }
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Focus auf erstes Eingabefeld
        setTimeout(() => {
            document.getElementById('subject').focus();
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('examModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.editingExam = null;
        document.getElementById('examForm').reset();
    }

    fillForm(exam) {
        document.getElementById('subject').value = exam.subject;
        document.getElementById('topic').value = exam.topic;
        document.getElementById('date').value = exam.date;
        document.getElementById('time').value = exam.time || '';
        document.getElementById('teacher').value = exam.teacher || '';
        document.getElementById('notes').value = exam.notes || '';
    }

    saveExam() {
        const formData = new FormData(document.getElementById('examForm'));
        const examData = {
            id: this.editingExam ? this.editingExam.id : Date.now().toString(),
            subject: formData.get('subject').trim(),
            topic: formData.get('topic').trim(),
            date: formData.get('date'),
            time: formData.get('time'),
            teacher: formData.get('teacher').trim(),
            notes: formData.get('notes').trim()
        };

        // Validierung
        if (!examData.subject || !examData.topic || !examData.date) {
            alert('Bitte füllen Sie alle Pflichtfelder aus.');
            return;
        }

        // Datum validieren
        const examDate = new Date(examData.date);
        if (isNaN(examDate.getTime())) {
            alert('Bitte geben Sie ein gültiges Datum ein.');
            return;
        }

        if (this.editingExam) {
            // Existierende Klassenarbeit aktualisieren
            const index = this.exams.findIndex(exam => exam.id === this.editingExam.id);
            if (index !== -1) {
                this.exams[index] = examData;
            }
        } else {
            // Neue Klassenarbeit hinzufügen
            this.exams.push(examData);
        }

        this.saveExams();
        this.renderCalendar();
        this.renderExamList();
        this.closeModal();

        // Erfolgs-Feedback
        this.showNotification(
            this.editingExam ? 'Klassenarbeit aktualisiert!' : 'Klassenarbeit hinzugefügt!',
            'success'
        );
    }

    editExam(examId) {
        this.editingExam = this.exams.find(exam => exam.id === examId);
        if (this.editingExam) {
            this.openModal();
        }
    }

    deleteExam(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (exam && confirm(`Möchten Sie die Klassenarbeit "${exam.subject}: ${exam.topic}" wirklich löschen?`)) {
            this.exams = this.exams.filter(e => e.id !== examId);
            this.saveExams();
            this.renderCalendar();
            this.renderExamList();
            this.showNotification('Klassenarbeit gelöscht!', 'success');
        }
    }

    showNotification(message, type = 'info') {
        // Einfache Notification (kann später erweitert werden)
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#4361ee'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    loadExams() {
        try {
            const stored = localStorage.getItem('klassenarbeiten');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Fehler beim Laden der Klassenarbeiten:', error);
            return [];
        }
    }

    saveExams() {
        try {
            localStorage.setItem('klassenarbeiten', JSON.stringify(this.exams));
        } catch (error) {
            console.error('Fehler beim Speichern der Klassenarbeiten:', error);
            alert('Fehler beim Speichern. Bitte versuchen Sie es erneut.');
        }
    }
}

// CSS für Animationen hinzufügen
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// App initialisieren wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    new KlassenarbeitsPlaner();
});