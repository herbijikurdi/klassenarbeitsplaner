// Firebase Konfiguration und Initialisierung
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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

// Firebase initialisieren
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

class KlassenarbeitsPlaner {
    constructor() {
        this.exams = [];
        this.currentDate = new Date();
        this.selectedDate = null;
        this.editingExam = null;
        this.userId = null;
        this.isOnline = navigator.onLine;
        this.unsubscribeExams = null;
        
        this.init();
    }

    async init() {
    this.showLoadingIndicator(true);
        
        try {
            // Authentifizierung
            await this.initAuth();
            
            // Events binden
            this.bindEvents();
            
            // UI rendern
            this.renderCalendar();
            
            // Online/Offline Status überwachen
            this.setupOnlineOfflineHandlers();
            
            // Verbindung zu Firestore wird nicht mehr angezeigt
            
        } catch (error) {
            console.error('Initialisierung fehlgeschlagen:', error);
            this.showNotification('Fehler beim Laden der App. Versuche es erneut...', 'error');
            // Verbindung zu Firestore wird nicht mehr angezeigt
            // Fallback auf LocalStorage
            this.loadFromLocalStorage();
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    async initAuth() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    this.userId = user.uid;
                    console.log('Benutzer angemeldet:', this.userId);
                    await this.setupFirestoreListener();
                    resolve();
                } else {
                    try {
                        // Anonyme Anmeldung
                        const userCredential = await signInAnonymously(auth);
                        this.userId = userCredential.user.uid;
                        console.log('Anonyme Anmeldung erfolgreich:', this.userId);
                        await this.setupFirestoreListener();
                        resolve();
                    } catch (error) {
                        console.error('Anmeldung fehlgeschlagen:', error);
                        reject(error);
                    }
                }
            });
        });
    }

    async setupFirestoreListener() {
        if (!this.userId) return;

        try {
            const examsRef = collection(db, 'users', this.userId, 'exams');
            const q = query(examsRef, orderBy('date', 'asc'));
            
            // Real-time Listener für Klassenarbeiten
            this.unsubscribeExams = onSnapshot(q, (snapshot) => {
                this.exams = [];
                snapshot.forEach((doc) => {
                    this.exams.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log('Klassenarbeiten aus Firestore geladen:', this.exams.length);
                this.renderCalendar();
                this.renderExamList();
                
                // Backup in LocalStorage
                this.saveToLocalStorage();
            }, (error) => {
                console.error('Firestore Listener Fehler:', error);
                this.showNotification('Verbindungsproblem. Arbeite offline.', 'warning');
                this.loadFromLocalStorage();
            });
            
        } catch (error) {
            console.error('Firestore Setup fehlgeschlagen:', error);
            this.loadFromLocalStorage();
        }
    }

    setupOnlineOfflineHandlers() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('Verbindung wiederhergestellt', 'success');
            // Versuche Offline-Daten zu synchronisieren
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            // Verbindung zu Firestore wird nicht mehr angezeigt
            this.showNotification('Offline-Modus aktiviert', 'warning');
        });
    }

    // updateConnectionStatus entfernt

    async syncOfflineData() {
        // Hier könnte man eine komplexere Sync-Logik implementieren
        // Für jetzt laden wir einfach neu
        if (this.userId) {
            await this.setupFirestoreListener();
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

        // Datum validieren
        const examDate = new Date(examData.date);
        if (isNaN(examDate.getTime())) {
            this.showNotification('Bitte geben Sie ein gültiges Datum ein.', 'error');
            return;
        }

        this.showLoadingIndicator(true);

        try {
            if (this.editingExam) {
                // Existierende Klassenarbeit aktualisieren
                await this.updateExamInFirestore(this.editingExam.id, examData);
                this.showNotification('Klassenarbeit aktualisiert!', 'success');
            } else {
                // Neue Klassenarbeit hinzufügen
                await this.addExamToFirestore(examData);
                this.showNotification('Klassenarbeit hinzugefügt!', 'success');
            }
            
            this.closeModal();
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            this.showNotification('Fehler beim Speichern. Versuche es offline...', 'error');
            
            // Offline Fallback
            this.saveExamLocally(examData);
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    async addExamToFirestore(examData) {
        if (!this.userId) throw new Error('Benutzer nicht angemeldet');
        
        const examsRef = collection(db, 'users', this.userId, 'exams');
        const docRef = await addDoc(examsRef, examData);
        console.log('Klassenarbeit hinzugefügt mit ID:', docRef.id);
        return docRef.id;
    }

    async updateExamInFirestore(examId, examData) {
        if (!this.userId) throw new Error('Benutzer nicht angemeldet');
        
        const examRef = doc(db, 'users', this.userId, 'exams', examId);
        await updateDoc(examRef, {
            ...examData,
            updatedAt: new Date().toISOString()
        });
        console.log('Klassenarbeit aktualisiert:', examId);
    }

    async deleteExamFromFirestore(examId) {
        if (!this.userId) throw new Error('Benutzer nicht angemeldet');
        
        const examRef = doc(db, 'users', this.userId, 'exams', examId);
        await deleteDoc(examRef);
        console.log('Klassenarbeit gelöscht:', examId);
    }

    saveExamLocally(examData) {
        // Fallback für Offline-Modus
        const localExam = {
            id: Date.now().toString(),
            ...examData,
            isOffline: true
        };
        
        if (this.editingExam) {
            const index = this.exams.findIndex(exam => exam.id === this.editingExam.id);
            if (index !== -1) {
                this.exams[index] = { ...localExam, id: this.editingExam.id };
            }
        } else {
            this.exams.push(localExam);
        }
        
        this.saveToLocalStorage();
        this.renderCalendar();
        this.renderExamList();
        this.closeModal();
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

        this.showLoadingIndicator(true);

        try {
            await this.deleteExamFromFirestore(examId);
            this.showNotification('Klassenarbeit gelöscht!', 'success');
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            this.showNotification('Fehler beim Löschen. Versuche es offline...', 'error');
            
            // Offline Fallback
            this.exams = this.exams.filter(e => e.id !== examId);
            this.saveToLocalStorage();
            this.renderCalendar();
            this.renderExamList();
        } finally {
            this.showLoadingIndicator(false);
        }
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

    showLoadingIndicator(show) {
        let loader = document.getElementById('loadingIndicator');
        
        if (show && !loader) {
            loader = document.createElement('div');
            loader.id = 'loadingIndicator';
            loader.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px 30px;
                border-radius: 10px;
                z-index: 10001;
                display: flex;
                align-items: center;
                gap: 15px;
                font-weight: 500;
            `;
            loader.innerHTML = `
                <div style="width: 20px; height: 20px; border: 2px solid #ffffff30; border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                Lade...
            `;
            document.body.appendChild(loader);
        } else if (!show && loader) {
            loader.remove();
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('klassenarbeiten_backup', JSON.stringify(this.exams));
        } catch (error) {
            console.error('LocalStorage Backup fehlgeschlagen:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('klassenarbeiten_backup');
            if (stored) {
                this.exams = JSON.parse(stored);
                this.renderCalendar();
                this.renderExamList();
                console.log('Daten aus LocalStorage Backup geladen');
            }
        } catch (error) {
            console.error('Fehler beim Laden des LocalStorage Backups:', error);
        }
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    destroy() {
        // Cleanup
        if (this.unsubscribeExams) {
            this.unsubscribeExams();
        }
    }
}

// CSS für Animationen und Loading hinzufügen
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
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// App initialisieren wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    window.klassenarbeitsPlaner = new KlassenarbeitsPlaner();
});

// Cleanup beim Verlassen der Seite
window.addEventListener('beforeunload', () => {
    if (window.klassenarbeitsPlaner) {
        window.klassenarbeitsPlaner.destroy();
    }
});