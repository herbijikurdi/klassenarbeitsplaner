// Hybride Version: Firebase + LocalStorage Fallback
// Versucht Firebase zu nutzen, fällt aber elegant auf LocalStorage zurück

// Firebase Konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyCtLOaSFdlMLj5azy5vsYUUpICIo664J0g",
  authDomain: "klassenarbeitsplaner-674b4.firebaseapp.com",
  projectId: "klassenarbeitsplaner-674b4",
  storageBucket: "klassenarbeitsplaner-674b4.firebasestorage.app",
  messagingSenderId: "130440095635",
  appId: "1:130440095635:web:e22374d62553523d97aa66",
  measurementId: "G-06J3TXPE17"
};

class KlassenarbeitsPlaner {
    constructor() {
        this.exams = [];
        this.currentDate = new Date();
        this.selectedDate = null;
        this.editingExam = null;
        this.userId = null;
        this.isFirebaseAvailable = false;
        this.db = null;
        this.auth = null;
        this.unsubscribeExams = null;
        
        console.log('Hybride Klassenarbeitsplaner gestartet');
        this.init();
    }

    async init() {
        this.updateConnectionStatus('connecting');
        
        // Versuche Firebase zu initialisieren
        try {
            await this.initFirebase();
        } catch (error) {
            console.log('Firebase nicht verfügbar, nutze LocalStorage:', error);
            this.isFirebaseAvailable = false;
        }
        
        // Lade Daten
        if (this.isFirebaseAvailable) {
            await this.loadFromFirebase();
        } else {
            this.loadFromLocalStorage();
        }
        
        // UI initialisieren
        this.bindEvents();
        this.renderCalendar();
        this.renderExamList();
        
        // Status-Feedback
        if (this.isFirebaseAvailable) {
            this.updateConnectionStatus('online');
            this.showNotification('Cloud-Synchronisation aktiv!', 'success');
        } else {
            this.updateConnectionStatus('offline');
            this.showNotification('App läuft im lokalen Modus', 'info');
        }
    }

    async initFirebase() {
        // Prüfe ob Firebase verfügbar ist
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK nicht geladen');
        }

        // Firebase initialisieren
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.db = firebase.firestore();
        this.auth = firebase.auth();

        // Teste Firestore-Verbindung
        await this.db.enableNetwork();

        // Authentifizierung
        await this.authenticateUser();

        this.isFirebaseAvailable = true;
        console.log('Firebase erfolgreich initialisiert');
    }

    async authenticateUser() {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.auth.onAuthStateChanged(async (user) => {
                try {
                    if (user) {
                        this.userId = user.uid;
                        console.log('Benutzer angemeldet:', this.userId);
                        unsubscribe();
                        resolve();
                    } else {
                        console.log('Starte anonyme Anmeldung...');
                        const userCredential = await this.auth.signInAnonymously();
                        this.userId = userCredential.user.uid;
                        console.log('Anonyme Anmeldung erfolgreich:', this.userId);
                        unsubscribe();
                        resolve();
                    }
                } catch (error) {
                    unsubscribe();
                    reject(error);
                }
            });

            // Timeout nach 5 Sekunden
            setTimeout(() => {
                unsubscribe();
                reject(new Error('Authentifizierung timeout'));
            }, 5000);
        });
    }

    async loadFromFirebase() {
        if (!this.userId || !this.db) return;

        try {
            const examsRef = this.db.collection('users').doc(this.userId).collection('exams');
            const query = examsRef.orderBy('date', 'asc');

            // Einmalige Ladung
            const snapshot = await query.get();
            this.exams = [];
            snapshot.forEach((doc) => {
                this.exams.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`${this.exams.length} Klassenarbeiten aus Firebase geladen`);

            // Real-time Listener für Änderungen
            this.unsubscribeExams = query.onSnapshot((snapshot) => {
                this.exams = [];
                snapshot.forEach((doc) => {
                    this.exams.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                this.renderCalendar();
                this.renderExamList();
                this.saveToLocalStorage(); // Backup
            });

        } catch (error) {
            console.error('Fehler beim Laden aus Firebase:', error);
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('klassenarbeiten');
            this.exams = stored ? JSON.parse(stored) : [];
            console.log(`${this.exams.length} Klassenarbeiten aus LocalStorage geladen`);
        } catch (error) {
            console.error('Fehler beim Laden aus LocalStorage:', error);
            this.exams = [];
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('klassenarbeiten', JSON.stringify(this.exams));
        } catch (error) {
            console.error('Fehler beim Speichern in LocalStorage:', error);
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        const textElement = document.getElementById('statusText');
        
        if (!statusElement || !textElement) return;
        
        statusElement.classList.remove('online', 'offline', 'error', 'connecting');
        
        switch (status) {
            case 'online':
                statusElement.classList.add('online');
                textElement.textContent = 'Online (Cloud)';
                break;
            case 'offline':
                statusElement.classList.add('offline');
                textElement.textContent = 'Lokal';
                break;
            case 'connecting':
                statusElement.classList.add('connecting');
                textElement.textContent = 'Verbinde...';
                break;
            default:
                statusElement.classList.add('offline');
                textElement.textContent = 'Bereit';
        }
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
        
        const monthNames = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
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
        const remainingCells = 42 - totalCells;
        
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

        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }

        const dayNumberElement = document.createElement('div');
        dayNumberElement.className = 'calendar-day-number';
        dayNumberElement.textContent = dayNumber;
        dayElement.appendChild(dayNumberElement);

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

        const sortedExams = [...this.exams].sort((a, b) => new Date(a.date) - new Date(b.date));
        
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
        const cloudIcon = this.isFirebaseAvailable ? '<i class="fas fa-cloud" style="color: #28a745; margin-left: 8px;" title="In Cloud gespeichert"></i>' : '';

        return `
            <div class="exam-item">
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}${cloudIcon}</div>
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

    async saveExam() {
        const formData = new FormData(document.getElementById('examForm'));
        const examData = {
            subject: formData.get('subject').trim(),
            topic: formData.get('topic').trim(),
            date: formData.get('date'),
            time: formData.get('time'),
            teacher: formData.get('teacher').trim(),
            notes: formData.get('notes').trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Validierung
        if (!examData.subject || !examData.topic || !examData.date) {
            this.showNotification('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
            return;
        }

        const examDate = new Date(examData.date);
        if (isNaN(examDate.getTime())) {
            this.showNotification('Bitte geben Sie ein gültiges Datum ein.', 'error');
            return;
        }

        try {
            if (this.isFirebaseAvailable) {
                // Firebase speichern
                if (this.editingExam) {
                    await this.updateExamInFirebase(this.editingExam.id, examData);
                    this.showNotification('Klassenarbeit in Cloud aktualisiert!', 'success');
                } else {
                    await this.addExamToFirebase(examData);
                    this.showNotification('Klassenarbeit in Cloud gespeichert!', 'success');
                }
            } else {
                // LocalStorage fallback
                this.saveExamLocally(examData);
                this.showNotification(
                    this.editingExam ? 'Klassenarbeit aktualisiert!' : 'Klassenarbeit gespeichert!',
                    'success'
                );
            }
            
            this.closeModal();
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            this.showNotification('Fehler beim Speichern. Versuche lokalen Modus...', 'error');
            this.saveExamLocally(examData);
            this.closeModal();
        }
    }

    async addExamToFirebase(examData) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        const examsRef = this.db.collection('users').doc(this.userId).collection('exams');
        const docRef = await examsRef.add(examData);
        console.log('Klassenarbeit zu Firebase hinzugefügt:', docRef.id);
        return docRef.id;
    }

    async updateExamInFirebase(examId, examData) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        const examRef = this.db.collection('users').doc(this.userId).collection('exams').doc(examId);
        await examRef.update({
            ...examData,
            updatedAt: new Date().toISOString()
        });
        console.log('Klassenarbeit in Firebase aktualisiert:', examId);
    }

    saveExamLocally(examData) {
        const localExam = {
            id: this.editingExam ? this.editingExam.id : Date.now().toString(),
            ...examData
        };
        
        if (this.editingExam) {
            const index = this.exams.findIndex(exam => exam.id === this.editingExam.id);
            if (index !== -1) {
                this.exams[index] = localExam;
            }
        } else {
            this.exams.push(localExam);
        }
        
        this.saveToLocalStorage();
        this.renderCalendar();
        this.renderExamList();
    }

    editExam(examId) {
        this.editingExam = this.exams.find(exam => exam.id === examId);
        if (this.editingExam) {
            this.openModal();
        }
    }

    async deleteExam(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (!exam) return;
        
        if (!confirm(`Möchten Sie die Klassenarbeit "${exam.subject}: ${exam.topic}" wirklich löschen?`)) {
            return;
        }

        try {
            if (this.isFirebaseAvailable) {
                await this.deleteExamFromFirebase(examId);
                this.showNotification('Klassenarbeit aus Cloud gelöscht!', 'success');
            } else {
                this.deleteExamLocally(examId);
                this.showNotification('Klassenarbeit gelöscht!', 'success');
            }
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            this.showNotification('Fehler beim Löschen. Versuche lokalen Modus...', 'error');
            this.deleteExamLocally(examId);
        }
    }

    async deleteExamFromFirebase(examId) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        const examRef = this.db.collection('users').doc(this.userId).collection('exams').doc(examId);
        await examRef.delete();
        console.log('Klassenarbeit aus Firebase gelöscht:', examId);
    }

    deleteExamLocally(examId) {
        this.exams = this.exams.filter(e => e.id !== examId);
        this.saveToLocalStorage();
        this.renderCalendar();
        this.renderExamList();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#4361ee'};
            color: ${type === 'warning' ? '#333' : 'white'};
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
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
        }, 4000);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    destroy() {
        if (this.unsubscribeExams) {
            this.unsubscribeExams();
        }
    }
}

// CSS für Animationen
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// App initialisieren
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starte hybride Klassenarbeitsplaner...');
    window.klassenarbeitsPlaner = new KlassenarbeitsPlaner();
});

window.addEventListener('beforeunload', () => {
    if (window.klassenarbeitsPlaner) {
        window.klassenarbeitsPlaner.destroy();
    }
});