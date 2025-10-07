// Firebase Configuration (shared with main app)
const firebaseConfig = {
    apiKey: "AIzaSyCtLOaSFdlMLj5azy5vsYUUpICIo664J0g",
    authDomain: "klassenarbeitsplaner-674b4.firebaseapp.com",
    projectId: "klassenarbeitsplaner-674b4",
    storageBucket: "klassenarbeitsplaner-674b4.firebasestorage.app",
    messagingSenderId: "130440095635",
    appId: "1:130440095635:web:e22374d62553523d97aa66"
};

class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.db = null;
        this.auth = null;
        this.exams = [];
        this.editingExam = null;

        console.log('🛡️ Admin Dashboard gestartet');
        this.init();
    }

    async init() {
        try {
            // Firebase initialisieren
            await this.initFirebase();
            
            // UI Event-Handler binden
            this.bindEvents();
            
            // Prüfe ob bereits angemeldet
            this.auth.onAuthStateChanged((user) => {
                if (user && user.email === 'admin@admin.admin') {
                    console.log('Admin bereits angemeldet:', user.email);
                    this.currentUser = user;
                    this.showDashboard();
                } else {
                    console.log('Kein Admin angemeldet');
                    this.showLogin();
                }
            });
            
        } catch (error) {
            console.error('Admin Dashboard Initialisierung fehlgeschlagen:', error);
            this.showNotification('Fehler beim Laden des Admin-Bereichs', 'error');
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

        // Optimierte Einstellungen für Admin-Bereich
        this.db.settings({
            experimentalForceLongPolling: true,
            ignoreUndefinedProperties: true
        });
    }

    showLogin() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').classList.add('hidden');
    }

    async showDashboard() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').classList.remove('hidden');
        
        // Lade Dashboard-Daten
        await this.loadDashboardData();
    }

    bindEvents() {
        // Login Form
        document.getElementById('adminLoginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Password Toggle
        document.getElementById('passwordToggle').addEventListener('click', () => {
            const passwordInput = document.getElementById('adminPassword');
            const toggleIcon = document.querySelector('#passwordToggle i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.className = 'fas fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                toggleIcon.className = 'fas fa-eye';
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Add Exam
        document.getElementById('addExamBtn').addEventListener('click', () => {
            this.openExamModal();
        });

        // Refresh Data
        document.getElementById('refreshDataBtn').addEventListener('click', () => {
            this.loadDashboardData();
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterExams(e.target.value);
        });

        // Filter
        document.getElementById('filterSelect').addEventListener('change', (e) => {
            this.applyFilter(e.target.value);
        });

        // Modal Events
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeExamModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeExamModal();
        });

        document.getElementById('adminExamForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExam();
        });

        // Click outside modal to close
        document.getElementById('adminExamModal').addEventListener('click', (e) => {
            if (e.target.id === 'adminExamModal') {
                this.closeExamModal();
            }
        });
    }

    async handleLogin() {
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;

        if (!password) {
            this.showNotification('Bitte Passwort eingeben', 'error');
            return;
        }

        try {
            console.log('Versuche Admin-Anmeldung...');
            
            // Versuche zuerst normale Anmeldung
            let userCredential;
            try {
                userCredential = await this.auth.signInWithEmailAndPassword(email, password);
                console.log('Admin-Anmeldung erfolgreich:', userCredential.user.uid);
            } catch (loginError) {
                console.log('Login-Fehler:', loginError.code);
                
                // Falls Account nicht existiert, erstelle ihn
                if (loginError.code === 'auth/user-not-found') {
                    console.log('Admin-Account nicht gefunden, erstelle neuen Account...');
                    try {
                        userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
                        console.log('Admin-Account erfolgreich erstellt:', userCredential.user.uid);
                        this.showNotification('Admin-Account erstellt und angemeldet!', 'success');
                    } catch (createError) {
                        console.error('Account-Erstellung fehlgeschlagen:', createError);
                        throw createError;
                    }
                } else {
                    throw loginError;
                }
            }
            
            const user = userCredential.user;
            
            if (user.email === 'admin@admin.admin') {
                this.currentUser = user;
                this.showNotification('Admin-Anmeldung erfolgreich!', 'success');
                this.showDashboard();
            } else {
                throw new Error('Nicht autorisiert für Admin-Bereich');
            }
            
        } catch (error) {
            console.error('Admin-Anmeldung fehlgeschlagen:', error);
            
            let errorMessage = 'Anmeldung fehlgeschlagen';
            if (error.code === 'auth/wrong-password') {
                errorMessage = 'Falsches Passwort';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'E-Mail bereits verwendet';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Passwort zu schwach (mindestens 6 Zeichen)';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Zu viele Anmeldeversuche. Bitte warten Sie.';
            } else if (error.code === 'auth/api-key-not-valid') {
                errorMessage = 'Firebase-Konfigurationsfehler. Bitte überprüfen Sie die API-Einstellungen.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    async handleLogout() {
        try {
            await this.auth.signOut();
            console.log('Admin abgemeldet');
            this.currentUser = null;
            this.showNotification('Erfolgreich abgemeldet', 'info');
            this.showLogin();
        } catch (error) {
            console.error('Logout-Fehler:', error);
            this.showNotification('Fehler beim Abmelden', 'error');
        }
    }

    async loadDashboardData() {
        try {
            console.log('Lade Dashboard-Daten...');
            
            // Lade alle Klassenarbeiten aus beiden Collections
            const globalExams = await this.loadExamsFromCollection('exams');
            const userExams = await this.loadExamsFromUserCollections();
            
            // Kombiniere und dedupliziere
            this.exams = this.combineAndDeduplicateExams([...globalExams, ...userExams]);
            
            console.log(`${this.exams.length} Klassenarbeiten geladen`);
            
            // Aktualisiere Statistiken
            this.updateStatistics();
            
            // Aktualisiere Exam-Liste
            this.renderExamList();
            
            this.showNotification('Daten erfolgreich geladen', 'success');
            
        } catch (error) {
            console.error('Fehler beim Laden der Dashboard-Daten:', error);
            this.showNotification('Fehler beim Laden der Daten', 'error');
        }
    }

    async loadExamsFromCollection(collectionName) {
        try {
            const snapshot = await this.db.collection(collectionName).get();
            const exams = [];
            
            snapshot.forEach(doc => {
                exams.push({
                    id: doc.id,
                    source: collectionName,
                    ...doc.data()
                });
            });
            
            return exams;
        } catch (error) {
            console.error(`Fehler beim Laden aus ${collectionName}:`, error);
            return [];
        }
    }

    async loadExamsFromUserCollections() {
        try {
            const usersSnapshot = await this.db.collection('users').get();
            const allUserExams = [];
            
            for (const userDoc of usersSnapshot.docs) {
                try {
                    const userExamsSnapshot = await this.db.collection('users').doc(userDoc.id).collection('exams').get();
                    
                    userExamsSnapshot.forEach(examDoc => {
                        allUserExams.push({
                            id: examDoc.id,
                            source: `users/${userDoc.id}/exams`,
                            ownerId: userDoc.id,
                            ...examDoc.data()
                        });
                    });
                } catch (userError) {
                    console.log(`Fehler beim Laden für User ${userDoc.id}:`, userError.message);
                }
            }
            
            return allUserExams;
        } catch (error) {
            console.error('Fehler beim Laden der User-Collections:', error);
            return [];
        }
    }

    combineAndDeduplicateExams(exams) {
        const uniqueExams = [];
        const seenIds = new Set();
        
        exams.forEach(exam => {
            if (!seenIds.has(exam.id)) {
                seenIds.add(exam.id);
                uniqueExams.push(exam);
            }
        });
        
        // Sortiere nach Datum
        return uniqueExams.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    updateStatistics() {
        const now = new Date();
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(now.getDate() + 7);
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);

        // Gesamt Klassenarbeiten
        document.getElementById('totalExams').textContent = this.exams.length;

        // Aktive Benutzer (eindeutige ownerId)
        const uniqueOwners = new Set(this.exams.map(exam => exam.ownerId).filter(id => id));
        document.getElementById('totalUsers').textContent = uniqueOwners.size;

        // Diese Woche erstellte
        const recentExams = this.exams.filter(exam => {
            const createdDate = new Date(exam.createdAt);
            return createdDate >= oneWeekAgo && createdDate <= now;
        });
        document.getElementById('recentExams').textContent = recentExams.length;

        // Nächste 7 Tage
        const urgentExams = this.exams.filter(exam => {
            const examDate = new Date(exam.date);
            return examDate >= now && examDate <= oneWeekFromNow;
        });
        document.getElementById('urgentExams').textContent = urgentExams.length;
    }

    renderExamList() {
        const examList = document.getElementById('adminExamList');
        const examCount = document.getElementById('examCount');
        
        examCount.textContent = `${this.exams.length} Einträge`;
        
        if (this.exams.length === 0) {
            examList.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #666;">
                    <i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>Keine Klassenarbeiten gefunden</h3>
                    <p>Erstellen Sie die erste Klassenarbeit.</p>
                </div>
            `;
            return;
        }

        examList.innerHTML = this.exams.map(exam => this.createExamItemHTML(exam)).join('');
        
        // Event-Handler für Aktionen
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

        const timeDisplay = exam.time ? `${exam.time}` : '';
        const teacherDisplay = exam.teacher ? `👨‍🏫 ${exam.teacher}` : '';
        const sourceDisplay = exam.source === 'exams' ? '🌐 Global' : '👤 User';
        const ownerDisplay = exam.ownerId ? `🆔 ${exam.ownerId.substring(0, 8)}...` : '';

        return `
            <div class="admin-exam-item">
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}</div>
                    <div class="exam-date">${formattedDate} ${timeDisplay}</div>
                </div>
                <div class="exam-topic">${exam.topic}</div>
                <div class="exam-details">
                    <span>${sourceDisplay}</span>
                    <span>${teacherDisplay}</span>
                    <span>${ownerDisplay}</span>
                </div>
                <div class="exam-actions">
                    <button class="btn btn-sm btn-edit" data-exam-id="${exam.id}">
                        <i class="fas fa-edit"></i> Bearbeiten
                    </button>
                    <button class="btn btn-sm btn-delete" data-exam-id="${exam.id}">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            </div>
        `;
    }

    openExamModal(exam = null) {
        const modal = document.getElementById('adminExamModal');
        const form = document.getElementById('adminExamForm');
        const title = document.getElementById('modalTitle');

        this.editingExam = exam;

        if (exam) {
            title.textContent = 'Klassenarbeit bearbeiten';
            this.fillForm(exam);
        } else {
            title.textContent = 'Neue Klassenarbeit';
            form.reset();
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeExamModal() {
        const modal = document.getElementById('adminExamModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.editingExam = null;
    }

    fillForm(exam) {
        document.getElementById('subject').value = exam.subject || '';
        document.getElementById('topic').value = exam.topic || '';
        document.getElementById('date').value = exam.date || '';
        document.getElementById('time').value = exam.time || '';
        document.getElementById('teacher').value = exam.teacher || '';
        document.getElementById('notes').value = exam.notes || '';
    }

    async saveExam() {
        const formData = new FormData(document.getElementById('adminExamForm'));
        const examData = {
            subject: formData.get('subject').trim(),
            topic: formData.get('topic').trim(),
            date: formData.get('date'),
            time: formData.get('time'),
            teacher: formData.get('teacher').trim(),
            notes: formData.get('notes').trim(),
            updatedAt: new Date().toISOString()
        };

        // Validierung
        if (!examData.subject || !examData.topic || !examData.date) {
            this.showNotification('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
            return;
        }

        try {
            if (this.editingExam) {
                // Bearbeiten
                await this.updateExam(this.editingExam.id, examData);
                this.showNotification('Klassenarbeit erfolgreich aktualisiert!', 'success');
            } else {
                // Neu hinzufügen - immer in globale Collection
                examData.createdAt = new Date().toISOString();
                examData.ownerId = 'admin';
                examData.isAdmin = true;
                
                await this.db.collection('exams').add(examData);
                this.showNotification('Klassenarbeit erfolgreich erstellt!', 'success');
            }

            this.closeExamModal();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            this.showNotification(`Fehler beim Speichern: ${error.message}`, 'error');
        }
    }

    async updateExam(examId, examData) {
        const exam = this.exams.find(e => e.id === examId);
        if (!exam) throw new Error('Klassenarbeit nicht gefunden');

        // Bestimme Collection basierend auf Source
        let docRef;
        if (exam.source === 'exams') {
            docRef = this.db.collection('exams').doc(examId);
        } else {
            // User-Collection
            const userId = exam.ownerId;
            docRef = this.db.collection('users').doc(userId).collection('exams').doc(examId);
        }

        await docRef.update(examData);
    }

    editExam(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (exam) {
            this.openExamModal(exam);
        }
    }

    async deleteExam(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (!exam) return;

        if (!confirm(`Möchten Sie die Klassenarbeit "${exam.subject}: ${exam.topic}" wirklich löschen?`)) {
            return;
        }

        try {
            // Bestimme Collection basierend auf Source
            if (exam.source === 'exams') {
                await this.db.collection('exams').doc(examId).delete();
            } else {
                // User-Collection
                const userId = exam.ownerId;
                await this.db.collection('users').doc(userId).collection('exams').doc(examId).delete();
            }

            this.showNotification('Klassenarbeit erfolgreich gelöscht!', 'success');
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            this.showNotification(`Fehler beim Löschen: ${error.message}`, 'error');
        }
    }

    filterExams(searchTerm) {
        const filteredExams = this.exams.filter(exam => 
            exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            exam.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (exam.teacher && exam.teacher.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        this.renderFilteredExams(filteredExams);
    }

    applyFilter(filterType) {
        let filteredExams = [...this.exams];
        const now = new Date();

        switch (filterType) {
            case 'upcoming':
                filteredExams = this.exams.filter(exam => new Date(exam.date) >= now);
                break;
            case 'past':
                filteredExams = this.exams.filter(exam => new Date(exam.date) < now);
                break;
            case 'thisweek':
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(now.getDate() + 7);
                filteredExams = this.exams.filter(exam => {
                    const examDate = new Date(exam.date);
                    return examDate >= now && examDate <= oneWeekFromNow;
                });
                break;
        }

        this.renderFilteredExams(filteredExams);
    }

    renderFilteredExams(exams) {
        const examList = document.getElementById('adminExamList');
        const examCount = document.getElementById('examCount');
        
        examCount.textContent = `${exams.length} Einträge`;
        
        if (exams.length === 0) {
            examList.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #666;">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>Keine Ergebnisse gefunden</h3>
                    <p>Passen Sie Ihre Suchkriterien an.</p>
                </div>
            `;
            return;
        }

        examList.innerHTML = exams.map(exam => this.createExamItemHTML(exam)).join('');
        
        // Event-Handler neu binden
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

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        
        notification.className = `notification ${type}`;
        
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        else if (type === 'error') icon = 'fas fa-exclamation-circle';
        else if (type === 'warning') icon = 'fas fa-exclamation-triangle';
        
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove nach 5 Sekunden
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
}

// CSS für slide-out Animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Admin Dashboard initialisieren
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛡️ Starte Admin Dashboard...');
    window.adminDashboard = new AdminDashboard();
});