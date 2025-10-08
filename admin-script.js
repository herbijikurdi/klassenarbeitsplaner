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
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    // Prüfe, ob die E-Mail in der Admin-Liste steht
                    const docRef = this.db.collection('admin').doc('admins');
                    const snapshot = await docRef.get();
                    const emails = snapshot.exists ? snapshot.data().emails || [] : [];
                    if (emails.includes(user.email)) {
                        console.log('Admin angemeldet:', user.email);
                        this.currentUser = user;
                        this.showDashboard();
                    } else {
                        console.log('Nicht autorisiert für Admin-Bereich');
                        this.showNotification('Nicht autorisiert für Admin-Bereich', 'error');
                        this.showLogin();
                    }
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
        }, {merge: true});
    }

    showLogin() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').classList.add('hidden');
    }

    async showDashboard() {
        // Evil Mode für Hauptadmin aktivieren
        if (this.currentUser?.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2') {
            document.body.classList.add('evil-mode');
            document.body.classList.remove('school-mode');
            // Fade-out Animation für Login-Screen
            document.getElementById('loginScreen').classList.add('fade-out');
            // Warte kurz für die Animation
            await new Promise(resolve => setTimeout(resolve, 800));
        } else {
            // School Mode für normale Admins
            document.body.classList.add('school-mode');
            document.body.classList.remove('evil-mode');
        }
        
        console.log('Dashboard anzeigen für User:', this.currentUser?.email, 'UID:', this.currentUser?.uid);
        
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').classList.remove('hidden');
        
        // Zeige eingeloggten User an
        this.updateUserInfo();
        
        await this.loadDashboardData();
        
        // UI-Anpassungen basierend auf Admin-Typ
        const isMainAdmin = this.currentUser?.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2';
        
        // Statistiken nur für Hauptadmin anzeigen
        const statsContainer = document.querySelector('.stats-container');
        if (statsContainer) {
            statsContainer.style.display = isMainAdmin ? 'grid' : 'none';
        }
        
        // "Neue Klassenarbeit hinzufügen" Button für alle Admins anzeigen
        const addExamBtn = document.getElementById('addExamBtn');
        if (addExamBtn) {
            addExamBtn.style.display = 'inline-flex';
        }
        
        // Admin-Management-Menü nur für Hauptadmin (anhand UID)
        if (isMainAdmin) {
            document.getElementById('adminManagementPanel').classList.remove('hidden');
            await this.loadAdminUsers();
        } else {
            document.getElementById('adminManagementPanel').classList.add('hidden');
            // Firestore-Panel auch für normale Admins ausblenden
            const bottomPanel = document.querySelector('.admin-bottom-panel');
            if (bottomPanel) {
                bottomPanel.style.display = 'none';
            }
        }
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
        // Admin-Benutzer hinzufügen (nur Hauptadmin)
        const addAdminForm = document.getElementById('addAdminForm');
        if (addAdminForm) {
            addAdminForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (this.currentUser?.uid !== 'P9jxWaBbC9ckFwJiVEx61G4THwV2') return;
                const email = document.getElementById('newAdminEmail').value.trim().toLowerCase();
                const password = document.getElementById('newAdminPassword').value;
                if (!email || !password) return this.showNotification('Bitte E-Mail und Passwort eingeben', 'error');
                await this.createAdminUser(email, password);
            });
        }
    }

    async handleLogin() {
        let email = document.getElementById('adminEmail').value.trim();
        if (!email) {
            email = 'admin@admin.admin';
        }
        const password = document.getElementById('adminPassword').value;

        if (!password) {
            this.showNotification('Bitte Passwort eingeben', 'error');
            return;
        }

        try {
            console.log('Versuche Admin-Anmeldung...');
            
            let userCredential;
            try {
                userCredential = await this.auth.signInWithEmailAndPassword(email, password);
                console.log('Admin-Anmeldung erfolgreich:', userCredential.user.uid);
            } catch (loginError) {
                console.log('Login-Fehler:', loginError.code);
                
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
            
            // Prüfe, ob die E-Mail in der Admin-Liste steht oder Hauptadmin ist
            const docRef = this.db.collection('admin').doc('admins');
            const snapshot = await docRef.get();
            const emails = snapshot.exists ? snapshot.data().emails || [] : [];
            if (emails.includes(user.email) || user.email === 'admin@admin.admin') {
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
            document.body.classList.remove('evil-mode'); // Evil Mode deaktivieren
            document.body.classList.remove('school-mode'); // School Mode deaktivieren
            
            // User-Info zurücksetzen
            const userInfoElement = document.getElementById('adminUserInfo');
            if (userInfoElement) {
                userInfoElement.innerHTML = 'Nicht eingeloggt';
            }
            
            this.showNotification('Erfolgreich abgemeldet', 'info');
            this.showLogin();
        } catch (error) {
            console.error('Logout-Fehler:', error);
            this.showNotification('Fehler beim Abmelden', 'error');
        }
    }

    updateUserInfo() {
        const userInfoElement = document.getElementById('adminUserInfo');
        if (this.currentUser && userInfoElement) {
            const email = this.currentUser.email || 'Unbekannt';
            const isMainAdmin = this.currentUser.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2';
            const adminType = isMainAdmin ? 'Hauptadmin' : 'Admin';
            
            userInfoElement.innerHTML = `
                <i class="fas fa-user-shield"></i>
                <span class="user-email">${email}</span>
                <span class="user-role">(${adminType})</span>
            `;
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
            
            // Debug: Zeige alle geladenen Exams
            console.log('Geladene Exams:', this.exams.map(e => ({id: e.id, ownerId: e.ownerId, subject: e.subject})));
            
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
        
        // Filter für normale Admins: nur eigene Klassenarbeiten
        const isMainAdmin = this.currentUser?.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2';
        let displayableExams = this.exams;
        
        // Normale Admins sehen alle Klassenarbeiten, können aber nur ihre eigenen bearbeiten
        console.log(`${isMainAdmin ? 'Hauptadmin' : 'Normale Admin'} (${this.currentUser?.uid}): ${displayableExams.length} Exams angezeigt`);
        
        examCount.textContent = `${displayableExams.length} Einträge`;
        
        if (displayableExams.length === 0) {
            const message = isMainAdmin ? 
                'Erstellen Sie die erste Klassenarbeit.' : 
                'Sie haben noch keine Klassenarbeiten erstellt.';
            examList.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #666;">
                    <i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>Keine Klassenarbeiten gefunden</h3>
                    <p>${message}</p>
                </div>
            `;
            return;
        }

        examList.innerHTML = displayableExams.map(exam => this.createExamItemHTML(exam)).join('');
        
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
        const ownerDisplay = exam.ownerId ? `🆔 ${exam.ownerId.substring(0, 8)}...` : '';

        // Berechtigungen prüfen - alle Admins können alles bearbeiten und löschen
        const isMainAdmin = this.currentUser?.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2';
        const isOwner = exam.ownerId === this.currentUser?.uid;
        const canEdit = true; // Alle Admins können bearbeiten
        const canDelete = true; // Alle Admins können löschen

        // Buttons nur anzeigen wenn berechtigt
        let actionsHTML = '';
        if (canEdit || canDelete) {
            actionsHTML = '<div class="exam-actions">';
            if (canEdit) {
                actionsHTML += `<button class="btn btn-sm btn-edit" data-exam-id="${exam.id}">
                    <i class="fas fa-edit"></i> Bearbeiten
                </button>`;
            }
            if (canDelete) {
                actionsHTML += `<button class="btn btn-sm btn-delete" data-exam-id="${exam.id}">
                    <i class="fas fa-trash"></i> Löschen
                </button>`;
            }
            actionsHTML += '</div>';
        } else {
            actionsHTML = '<div class="exam-actions"><span style="color: #999; font-style: italic; font-size: 0.9rem;"><i class="fas fa-lock"></i> Nur Besitzer kann bearbeiten</span></div>';
        }

        return `
            <div class="admin-exam-item">
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}</div>
                    <div class="exam-date">${formattedDate} ${timeDisplay}</div>
                </div>
                <div class="exam-topic">${exam.topic}</div>
                <div class="exam-details">
                    <span>${teacherDisplay}</span>
                    <span>${ownerDisplay}</span>
                </div>
                ${actionsHTML}
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
        if (!examData.subject || !examData.date) {
            this.showNotification('Bitte füllen Sie Fach und Datum aus.', 'error');
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
                examData.ownerId = this.currentUser.uid;
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
        let filteredExams = this.exams.filter(exam => 
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
        
        // Filter für normale Admins: nur eigene Klassenarbeiten
        const isMainAdmin = this.currentUser?.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2';
        let displayableExams = exams;
        
        // Normale Admins sehen alle Klassenarbeiten, können aber nur ihre eigenen bearbeiten
        
        examCount.textContent = `${displayableExams.length} Einträge`;
        
        if (displayableExams.length === 0) {
            examList.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #666;">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>Keine Ergebnisse gefunden</h3>
                    <p>Passen Sie Ihre Suchkriterien an.</p>
                </div>
            `;
            return;
        }

        examList.innerHTML = displayableExams.map(exam => this.createExamItemHTML(exam)).join('');
        
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

    async loadAdminUsers() {
        const adminList = document.getElementById('adminList');
        if (!adminList) return;

        adminList.innerHTML = '<li><i class="fas fa-spinner fa-spin"></i> Lade Admin-Benutzer...</li>';

        try {
            const snapshot = await this.db.collection('admin').doc('admins').get();
            const emails = snapshot.exists ? snapshot.data().emails || [] : [];

            if (emails.length === 0) {
                adminList.innerHTML = '<li><i class="fas fa-info-circle"></i> Keine Admin-Benutzer gefunden</li>';
                return;
            }

            // Sortiere E-Mails alphabetisch, aber stelle sicher dass admin@admin.admin zuerst kommt
            emails.sort((a, b) => {
                if (a === 'admin@admin.admin') return -1;
                if (b === 'admin@admin.admin') return 1;
                return a.localeCompare(b);
            });

            adminList.innerHTML = emails.map(email => {
                const isMainAdmin = email === 'admin@admin.admin';
                const canManage = this.currentUser?.uid === 'P9jxWaBbC9ckFwJiVEx61G4THwV2' && !isMainAdmin;

                return `<li>
                    <div class="admin-info">
                        <i class="fas fa-user-shield"></i>
                        <span class="admin-email">${email}</span>
                        ${isMainAdmin ? '<span class="admin-badge-small">Hauptadmin</span>' : ''}
                    </div>
                    ${canManage ? `<button class="admin-manage-btn" data-email="${email}" title="Admin verwalten">
                        <i class="fas fa-cog"></i>
                    </button>` : ''}
                </li>`;
            }).join('');

            // Event-Handler für Verwaltungs-Buttons
            adminList.querySelectorAll('.admin-manage-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const email = btn.dataset.email;
                    this.manageAdminUser(email);
                });
            });

        } catch (error) {
            console.error('Fehler beim Laden der Admin-Benutzer:', error);
            adminList.innerHTML = '<li><i class="fas fa-exclamation-triangle"></i> Fehler beim Laden der Admin-Benutzer</li>';
        }
    }

    async createAdminUser(email, password) {
        try {
            console.log('Erstelle Admin-Benutzer:', email);
            
            // Firebase Auth: Benutzer anlegen
            await this.auth.createUserWithEmailAndPassword(email, password);
            console.log('Firebase Auth-Benutzer erstellt');
            
            // In Admin-Collection eintragen
            const docRef = this.db.collection('admin').doc('admins');
            const snapshot = await docRef.get();
            let emails = snapshot.exists ? snapshot.data().emails || [] : [];
            console.log('Aktuelle Admin-Liste:', emails);
            
            // Stelle sicher, dass der Hauptadmin immer in der Liste ist
            if (!emails.includes('admin@admin.admin')) {
                emails.push('admin@admin.admin');
            }
            
            // Neue E-Mail hinzufügen, falls nicht vorhanden
            if (!emails.includes(email)) {
                emails.push(email);
                console.log('Neue E-Mail zur Liste hinzugefügt:', email);
            } else {
                console.log('E-Mail bereits in Liste:', email);
            }
            
            // Dokument aktualisieren
            await docRef.set({ emails });
            console.log('Admin-Liste aktualisiert:', emails);
            
            this.showNotification('Admin-Benutzer erstellt!', 'success');
            await this.loadAdminUsers();
            
        } catch (err) {
            console.error('Fehler beim Erstellen des Admin-Benutzers:', err);
            let fehler = 'Fehler beim Erstellen!';
            if (err.code === 'auth/email-already-in-use') {
                fehler = 'Diese E-Mail-Adresse wird bereits verwendet.';
            } else if (err.code === 'auth/weak-password') {
                fehler = 'Das Passwort ist zu schwach (mindestens 6 Zeichen).';
            } else if (err.code === 'auth/invalid-email') {
                fehler = 'Ungültige E-Mail-Adresse.';
            } else if (err.code === 'auth/operation-not-allowed') {
                fehler = 'Registrierung ist nicht erlaubt. Bitte prüfen Sie die Firebase-Einstellungen.';
            } else if (err.code === 'permission-denied') {
                fehler = 'Keine Berechtigung, Admin-Benutzer zu erstellen.';
            } else if (err.message) {
                fehler = err.message;
            }
            this.showNotification(fehler, 'error');
            
            // Versuche, den erstellten Auth-Benutzer zu löschen, falls Firestore fehlgeschlagen ist
            try {
                // Hier könnten wir den Benutzer löschen, aber das ist kompliziert
                // Da wir die UID nicht haben, lassen wir es
            } catch (deleteErr) {
                console.error('Fehler beim Aufräumen:', deleteErr);
            }
        }
    }

    async manageAdminUser(email) {
        // Einfaches Verwaltungs-Menü mit Bestätigung
        const action = confirm(`Admin "${email}" verwalten:\n\nDrücken Sie OK um den Admin zu entfernen, oder Abbrechen um abzubrechen.`);
        
        if (action) {
            if (confirm(`Sind Sie sicher, dass Sie den Admin "${email}" entfernen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                await this.removeAdminUser(email);
            }
        }
    }

    async removeAdminUser(email) {
        try {
            // Aus Admin-Collection entfernen
            const docRef = this.db.collection('admin').doc('admins');
            const snapshot = await docRef.get();
            let emails = snapshot.exists ? snapshot.data().emails || [] : [];
            emails = emails.filter(e => e !== email);
            await docRef.set({ emails }, { merge: true });
            this.showNotification('Admin entfernt!', 'success');
            await this.loadAdminUsers();
        } catch (err) {
            this.showNotification('Fehler beim Entfernen!', 'error');
        }
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
        
        // Auto-remove nach 2 Sekunden
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 2000);
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
    window.adminDashboard = new AdminDashboard();

    // Toggle Firestore-Panel
    const toggleBtn = document.getElementById('toggleFirestorePanel');
    const panel = document.getElementById('firestorePanel');
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            toggleBtn.classList.toggle('open');
        });
    }

    // Firestore-Status und Logs laden
    async function updateFirestorePanel() {
        // Firestore Status
        const statusDiv = document.getElementById('firestoreStatus');
        try {
            const db = firebase.firestore();
            await db.collection('exams').limit(1).get();
            statusDiv.textContent = 'Status: Firestore erreichbar';
        } catch (err) {
            statusDiv.textContent = 'Status: Firestore NICHT erreichbar';
        }
        // Logs
        const logsDiv = document.getElementById('firestoreLogs');
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('logs').orderBy('timestamp', 'desc').limit(20).get();
            logsDiv.innerHTML = Array.from(snapshot.docs).map(doc => {
                const log = doc.data();
                return `<div><span style='color:#888;'>${new Date(log.timestamp).toLocaleString()}</span> <span style='color:#764ba2;'>${log.action}</span> <span style='color:#667eea;'>(${log.by})</span></div>`;
            }).join('');
        } catch (err) {
            logsDiv.textContent = 'Fehler beim Laden der Logs';
        }
    }
    // Firestore-Test-Buttons
    function bindFirestoreTestButtons() {
        const statusDiv = document.getElementById('firestoreStatus');
        if (document.getElementById('firestoreReadTest')) {
            document.getElementById('firestoreReadTest').onclick = async () => {
                try {
                    const db = firebase.firestore();
                    await db.collection('exams').limit(1).get();
                    statusDiv.textContent = 'Lesen-Test erfolgreich!';
                } catch (err) {
                    statusDiv.textContent = 'Lesen-Test fehlgeschlagen!';
                }
            };
        }
        if (document.getElementById('firestoreWriteTest')) {
            document.getElementById('firestoreWriteTest').onclick = async () => {
                try {
                    const db = firebase.firestore();
                    await db.collection('logs').add({
                        action: 'Test-Schreiben',
                        by: 'Admin-Test',
                        timestamp: new Date().toISOString()
                    });
                    statusDiv.textContent = 'Schreiben-Test erfolgreich!';
                } catch (err) {
                    statusDiv.textContent = 'Schreiben-Test fehlgeschlagen!';
                }
            };
        }
        if (document.getElementById('firestoreDeleteTest')) {
            document.getElementById('firestoreDeleteTest').onclick = async () => {
                try {
                    const db = firebase.firestore();
                    // Lösche das zuletzt erstellte Log (Test)
                    const snapshot = await db.collection('logs').orderBy('timestamp', 'desc').limit(1).get();
                    if (!snapshot.empty) {
                        await db.collection('logs').doc(snapshot.docs[0].id).delete();
                        statusDiv.textContent = 'Löschen-Test erfolgreich!';
                    } else {
                        statusDiv.textContent = 'Kein Log zum Löschen gefunden!';
                    }
                } catch (err) {
                    statusDiv.textContent = 'Löschen-Test fehlgeschlagen!';
                }
            };
        }
        if (document.getElementById('firestoreRuleTest')) {
            document.getElementById('firestoreRuleTest').onclick = async () => {
                try {
                    const db = firebase.firestore();
                    // Versuche auf Admin-Collection zuzugreifen
                    await db.collection('admin').doc('admins').get();
                    statusDiv.textContent = 'Regel-Test erfolgreich!';
                } catch (err) {
                    statusDiv.textContent = 'Regel-Test fehlgeschlagen!';
                }
            };
        }
    }
    // Panel initial updaten und Buttons binden
    if (document.getElementById('firestorePanel')) {
        updateFirestorePanel();
        bindFirestoreTestButtons();
    }
});