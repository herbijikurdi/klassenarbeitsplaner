// Firebase Klassenarbeitsplaner - Saubere Version ohne Test-Interface
// Alle Daten werden in Firebase gespeichert

const firebaseConfig = {
  apiKey: "AIzaSyCtLOaSFdlMLj5azy5vsYUUpICIo664J0g",
  authDomain: "klassenarbeitsplaner-674b4.firebaseapp.com",
  projectId: "klassenarbeitsplaner-674b4",
  storageBucket: "klassenarbeitsplaner-674b4.firebasestorage.app",
  messagingSenderId: "130440095635",
  appId: "1:130440095635:web:e22374d62553523d97aa66"
};

class KlassenarbeitsPlaner {
    constructor() {
        this.exams = [];
        this.currentDate = new Date();
        this.selectedDate = null;
        this.editingExam = null;
        this.userId = null;
        this.db = null;
        this.auth = null;
        this.unsubscribeExams = null;
        this.isAdmin = false;
        this.adminPassword = 'borabora'; // Admin-Passwort
        
        console.log('🚀 Firebase Klassenarbeitsplaner gestartet');
        this.init();
    }

    async init() {
        this.updateConnectionStatus('connecting');
        
        try {
            // Firebase initialisieren
            await this.initFirebase();
            
            // Authentifizierung
            await this.authenticateUser();
            
            // Events binden
            this.bindEvents();
            this.bindAdminEvents();
            
            // Daten laden
            await this.loadExamsFromFirebase();
            
            // UI rendern
            this.renderCalendar();
            this.renderExamList();
            
            this.updateConnectionStatus('online');
            this.showNotification('Firebase-Verbindung aktiv!', 'success');
            
        } catch (error) {
            console.error('Firebase Initialisierung fehlgeschlagen:', error);
            this.updateConnectionStatus('error');
            this.showNotification('Firebase-Verbindung fehlgeschlagen!', 'error');
        }
    }

    async initFirebase() {
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
        console.log('Firebase SDK initialisiert');
    }

    async authenticateUser() {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.auth.onAuthStateChanged(async (user) => {
                try {
                    if (user) {
                        this.userId = user.uid;
                        console.log(`Benutzer angemeldet: ${this.userId.substring(0, 8)}...`);
                        unsubscribe();
                        resolve();
                    } else {
                        console.log('Starte anonyme Anmeldung...');
                        const userCredential = await this.auth.signInAnonymously();
                        this.userId = userCredential.user.uid;
                        console.log(`Anonyme Anmeldung erfolgreich: ${this.userId.substring(0, 8)}...`);
                        unsubscribe();
                        resolve();
                    }
                } catch (error) {
                    console.error(`Authentifizierung fehlgeschlagen: ${error.message}`);
                    unsubscribe();
                    reject(error);
                }
            });

            setTimeout(() => {
                unsubscribe();
                reject(new Error('Authentifizierung timeout'));
            }, 10000);
        });
    }

    async loadExamsFromFirebase() {
        if (!this.userId || !this.db) return;

        try {
            // Versuche zuerst globale Collection, dann fallback zu user-spezifisch
            let examsRef, query;
            
            try {
                // Versuche globale Collection
                examsRef = this.db.collection('exams');
                query = examsRef.orderBy('date', 'asc');
                
                // Test-Abfrage um Berechtigungen zu prüfen
                const testSnapshot = await query.limit(1).get();
                console.log('Globale Collection verfügbar');
                
            } catch (globalError) {
                console.log('Globale Collection nicht verfügbar, verwende Benutzer-Collection');
                // Fallback zu user-spezifischer Collection
                examsRef = this.db.collection('users').doc(this.userId).collection('exams');
                query = examsRef.orderBy('date', 'asc');
            }

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

            // Real-time Listener
            this.unsubscribeExams = query.onSnapshot((snapshot) => {
                const oldCount = this.exams.length;
                this.exams = [];
                snapshot.forEach((doc) => {
                    this.exams.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                if (this.exams.length !== oldCount) {
                    console.log(`Real-time Update: ${this.exams.length} Klassenarbeiten`);
                }
                
                this.renderCalendar();
                this.renderExamList();
            });

        } catch (error) {
            console.error(`Fehler beim Laden: ${error.message}`);
            throw error;
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
                textElement.textContent = 'Firebase Online';
                break;
            case 'error':
                statusElement.classList.add('error');
                textElement.textContent = 'Firebase Fehler';
                break;
            case 'connecting':
                statusElement.classList.add('connecting');
                textElement.textContent = 'Verbinde zu Firebase...';
                break;
            default:
                statusElement.classList.add('offline');
                textElement.textContent = 'Offline';
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

    bindAdminEvents() {
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            this.showAdminLogin();
        });
    }

    showAdminLogin() {
        const password = prompt('Admin-Passwort eingeben:');
        if (password === this.adminPassword) {
            this.isAdmin = true;
            this.showNotification('Admin-Modus aktiviert! Sie können jetzt alle Klassenarbeiten bearbeiten.', 'success');
            this.updateAdminButton();
            this.renderExamList(); // Liste neu rendern mit Admin-Rechten
        } else if (password !== null) {
            this.showNotification('Falsches Passwort!', 'error');
        }
    }

    updateAdminButton() {
        const adminBtn = document.getElementById('adminLoginBtn');
        if (this.isAdmin) {
            adminBtn.innerHTML = '<i class="fas fa-shield-alt" style="margin-right: 5px; color: #28a745;"></i>Admin aktiv';
            adminBtn.style.borderColor = '#28a745';
            adminBtn.style.color = '#28a745';
            adminBtn.style.fontWeight = '500';
            adminBtn.onclick = () => {
                if (confirm('Admin-Modus deaktivieren?')) {
                    this.isAdmin = false;
                    this.updateAdminButton();
                    this.renderExamList();
                    this.showNotification('Admin-Modus deaktiviert', 'info');
                }
            };
        } else {
            adminBtn.innerHTML = '<i class="fas fa-cog" style="margin-right: 5px;"></i>Admin';
            adminBtn.style.borderColor = '#ddd';
            adminBtn.style.color = '#999';
            adminBtn.style.fontWeight = 'normal';
            adminBtn.onclick = () => this.showAdminLogin();
        }
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
                if (exam.isTest) {
                    examElement.style.background = '#ffc107';
                    examElement.style.color = '#333';
                }
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
        const firebaseIcon = '<i class="fas fa-cloud" style="color: #4285f4; margin-left: 8px;" title="In Firebase gespeichert"></i>';
        const testBadge = exam.isTest ? '<span style="background: #ffc107; color: #333; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">TEST</span>' : '';
        
        // Besitzer-Info und Berechtigungen
        const isOwner = exam.ownerId === this.userId;
        const ownerDisplay = ''; // Benutzernamen nicht anzeigen
        const ownerBadge = isOwner ? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">MEINE</span>' : '';
        
        // Admin-Badge
        const adminBadge = this.isAdmin ? '<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">ADMIN</span>' : '';
        
        // Aktions-Buttons: für eigene Einträge oder als Admin
        const canEdit = isOwner || this.isAdmin;
        const actionsHTML = canEdit ? `
            <div class="exam-actions">
                <button class="btn-edit" data-exam-id="${exam.id}">
                    <i class="fas fa-edit"></i> Bearbeiten
                </button>
                <button class="btn-delete" data-exam-id="${exam.id}">
                    <i class="fas fa-trash"></i> Löschen
                </button>
                ${this.isAdmin && !isOwner ? '<span style="color: #dc3545; font-size: 0.8rem; margin-left: 10px;"><i class="fas fa-shield-alt"></i> Admin-Zugriff</span>' : ''}
            </div>
        ` : `
            <div class="exam-actions">
                <span style="color: #999; font-style: italic; font-size: 0.9rem;">
                    <i class="fas fa-lock"></i> Nur Besitzer kann bearbeiten
                </span>
            </div>
        `;

        return `
            <div class="exam-item" ${exam.isTest ? 'style="border-left: 4px solid #ffc107;"' : (isOwner ? 'style="border-left: 4px solid #28a745;"' : 'style="border-left: 4px solid #e9ecef;"')}>
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}${firebaseIcon}${testBadge}${ownerBadge}${adminBadge}</div>
                    <div class="exam-date">${formattedDate}${timeDisplay}</div>
                </div>
                <div class="exam-topic">${exam.topic}</div>
                <div class="exam-details">
                    ${teacherDisplay}
                    ${ownerDisplay}
                </div>
                ${notesDisplay}
                ${actionsHTML}
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
        if (!examData.subject || !examData.date) {
            this.showNotification('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
            return;
        }

        const examDate = new Date(examData.date);
        if (isNaN(examDate.getTime())) {
            this.showNotification('Bitte geben Sie ein gültiges Datum ein.', 'error');
            return;
        }

        try {
            if (this.editingExam) {
                // Bearbeiten
                await this.updateExamInFirebase(this.editingExam.id, examData);
                console.log(`Klassenarbeit aktualisiert: ${examData.subject} - ${examData.topic}`);
                this.showNotification('Klassenarbeit in Firebase aktualisiert!', 'success');
            } else {
                // Neu hinzufügen
                const docRef = await this.addExamToFirebase(examData);
                console.log(`Neue Klassenarbeit hinzugefügt: ${examData.subject} - ${examData.topic} (ID: ${docRef.id})`);
                this.showNotification('Klassenarbeit in Firebase gespeichert!', 'success');
            }
            
            this.closeModal();
        } catch (error) {
            console.error(`Fehler beim Speichern: ${error.message}`);
            this.showNotification('Fehler beim Speichern in Firebase!', 'error');
        }
    }

    async addExamToFirebase(examData) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        try {
            // Versuche zuerst globale Collection
            const examWithOwner = {
                ...examData,
                ownerId: this.userId
                // ownerName entfernt - Benutzernamen werden nicht mehr gespeichert
            };
            
            const examsRef = this.db.collection('exams');
            const docRef = await examsRef.add(examWithOwner);
            console.log('Klassenarbeit zu globaler Firebase Collection hinzugefügt:', docRef.id);
            return docRef;
            
        } catch (globalError) {
            console.log('Globale Collection nicht verfügbar, verwende Benutzer-Collection');
            
            // Fallback zu user-spezifischer Collection
            const examsRef = this.db.collection('users').doc(this.userId).collection('exams');
            const docRef = await examsRef.add(examData);
            console.log('Klassenarbeit zu Benutzer-Collection hinzugefügt:', docRef.id);
            return docRef;
        }
    }

    async updateExamInFirebase(examId, examData) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        // Admin kann alles bearbeiten, normale Benutzer nur ihre eigenen
        if (!this.isAdmin) {
            // Prüfe ob Benutzer der Besitzer ist
            const examRef = this.db.collection('exams').doc(examId);
            const examDoc = await examRef.get();
            
            if (!examDoc.exists) {
                throw new Error('Klassenarbeit nicht gefunden');
            }
            
            const examOwner = examDoc.data().ownerId;
            if (examOwner !== this.userId) {
                throw new Error('Keine Berechtigung: Sie können nur Ihre eigenen Klassenarbeiten bearbeiten');
            }
        }
        
        const examRef = this.db.collection('exams').doc(examId);
        await examRef.update({
            ...examData,
            updatedAt: new Date().toISOString(),
            lastEditedBy: this.isAdmin ? 'Admin' : 'Besitzer'
        });
        console.log('Klassenarbeit in Firebase aktualisiert:', examId);
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
            await this.deleteExamFromFirebase(examId);
            console.log(`Klassenarbeit gelöscht: ${exam.subject} - ${exam.topic}`);
            this.showNotification('Klassenarbeit aus Firebase gelöscht!', 'success');
        } catch (error) {
            console.error(`Fehler beim Löschen: ${error.message}`);
            this.showNotification('Fehler beim Löschen!', 'error');
        }
    }

    async deleteExamFromFirebase(examId) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        // Admin kann alles löschen, normale Benutzer nur ihre eigenen
        if (!this.isAdmin) {
            // Prüfe ob Benutzer der Besitzer ist
            const examRef = this.db.collection('exams').doc(examId);
            const examDoc = await examRef.get();
            
            if (!examDoc.exists) {
                throw new Error('Klassenarbeit nicht gefunden');
            }
            
            const examOwner = examDoc.data().ownerId;
            if (examOwner !== this.userId) {
                throw new Error('Keine Berechtigung: Sie können nur Ihre eigenen Klassenarbeiten löschen');
            }
        }
        
        const examRef = this.db.collection('exams').doc(examId);
        await examRef.delete();
        console.log('Klassenarbeit aus Firebase gelöscht:', examId);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#4361ee'};
            color: white;
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
    console.log('🚀 Starte Firebase Klassenarbeitsplaner...');
    window.klassenarbeitsPlaner = new KlassenarbeitsPlaner();
});

window.addEventListener('beforeunload', () => {
    if (window.klassenarbeitsPlaner) {
        window.klassenarbeitsPlaner.destroy();
    }
});