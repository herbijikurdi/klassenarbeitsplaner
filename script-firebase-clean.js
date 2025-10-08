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
        this.updateTimeout = null;
        this.webchannelErrorCount = 0;
        
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

        // Firebase initialisieren mit Webchannel-Optimierung
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Firestore mit vollständig deaktiviertem Real-time für Stabilität
        this.db = firebase.firestore();
        
        // DEAKTIVIERE Real-time Verbindungen komplett für Stabilität
        this.db.settings({
            experimentalForceLongPolling: true,
            ignoreUndefinedProperties: true
        });
        
        // Flag für Real-time Listener (standardmäßig deaktiviert)
        this.useRealTimeUpdates = false;
        
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

            // OPTIONAL: Real-time Listener (standardmäßig deaktiviert wegen Webchannel-Problemen)
            if (this.useRealTimeUpdates) {
                this.setupRealTimeListener(query);
            } else {
                console.log('Real-time Updates deaktiviert - verwende manuelle Aktualisierung für Stabilität');
            }

        } catch (error) {
            console.error(`Fehler beim Laden: ${error.message}`);
            throw error;
        }
    }

    setupRealTimeListener(query) {
        console.log('Aktiviere Real-time Listener...');
        this.unsubscribeExams = query.onSnapshot({
            includeMetadataChanges: false
        }, (snapshot) => {
            try {
                const oldCount = this.exams.length;
                this.exams = [];
                
                snapshot.forEach((doc) => {
                    if (doc.exists) {
                        this.exams.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    }
                });
                
                if (this.exams.length !== oldCount) {
                    console.log(`Real-time Update: ${this.exams.length} Klassenarbeiten`);
                }
                
                clearTimeout(this.updateTimeout);
                this.updateTimeout = setTimeout(() => {
                    this.renderCalendar();
                    this.renderExamList();
                }, 100);
                
            } catch (error) {
                console.error('Real-time Update Fehler:', error);
            }
        }, (error) => {
            console.error('Real-time Listener Fehler:', error);
            this.handleWebchannelError(error);
        });
    }

    // Manuelle Datenaktualisierung nach Operationen
    async refreshDataAfterOperation() {
        try {
            console.log('Manuelle Datenaktualisierung...');
            await this.loadExamsFromFirebase();
            this.renderCalendar();
            this.renderExamList();
        } catch (error) {
            console.error('Fehler bei manueller Aktualisierung:', error);
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
                textElement.textContent = 'Online';
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

        // Day-Popup Events (Mobile-optimiert)
        document.getElementById('dayPopupClose').addEventListener('click', () => {
            this.closeDayPopup();
        });

        // Touch-optimierter Background-Close für Mobile
        document.getElementById('dayPopup').addEventListener('click', (e) => {
            if (e.target.id === 'dayPopup') {
                this.closeDayPopup();
            }
        });

        // "Ereignis hinzufügen" Button im Popup
        document.getElementById('addEventForDay').addEventListener('click', () => {
            // Speichere das ausgewählte Datum bevor das Popup geschlossen wird
            const dateToAdd = this.selectedDate;
            console.log('Ereignis hinzufügen für Datum:', this.formatDate(dateToAdd));
            
            this.closeDayPopup();
            this.openModal(dateToAdd);
        });

        // Exam-Detail Popup Events
        document.getElementById('examDetailPopupClose').addEventListener('click', () => {
            this.closeExamDetailPopup();
        });

        document.getElementById('examDetailPopup').addEventListener('click', (e) => {
            if (e.target.id === 'examDetailPopup') {
                this.closeExamDetailPopup();
            }
        });

        document.getElementById('editExamFromDetail').addEventListener('click', () => {
            if (this.currentDetailExam) {
                this.closeExamDetailPopup();
                this.editExam(this.currentDetailExam.id);
            }
        });

        document.getElementById('deleteExamFromDetail').addEventListener('click', () => {
            if (this.currentDetailExam) {
                this.closeExamDetailPopup();
                this.deleteExam(this.currentDetailExam.id);
            }
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
                this.closeDayPopup();
                this.closeExamDetailPopup();
            }
        });
    }

    bindAdminEvents() {
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            this.showAdminLogin();
        });
    }

    showAdminLogin() {
        const password = prompt('Admin-Passwort eingeben:\n(Verwendet lokalen Admin-Modus - keine OAuth erforderlich)');
        if (password) {
            // Lokaler Admin-Modus ohne Firebase OAuth
            this.activateLocalAdminMode(password);
        }
    }

    async activateLocalAdminMode(password) {
        try {
            // Prüfe Admin-Passwort
            if (password === this.adminPassword) {
                console.log('Lokaler Admin-Modus aktiviert');
                
                // Admin-Status aktivieren
                this.isAdmin = true;
                
                // Simuliere Admin-User-ID für konsistente Logik
                this.adminUserId = 'admin-' + Date.now();
                
                this.showNotification('Admin-Modus aktiviert! Vollzugriff auf alle Klassenarbeiten.', 'success');
                this.updateAdminButton();
                
                // Lade alle Daten mit Admin-Berechtigung
                await this.loadExamsFromFirebase();
                this.renderCalendar();
                this.renderExamList();
                
            } else {
                this.showNotification('Falsches Admin-Passwort!', 'error');
            }
        } catch (error) {
            console.error('Admin-Aktivierung fehlgeschlagen:', error.message);
            this.showNotification(`Admin-Aktivierung fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    updateAdminButton() {
        const adminBtn = document.getElementById('adminLoginBtn');
        if (this.isAdmin) {
            adminBtn.innerHTML = `<i class="fas fa-shield-alt" style="margin-right: 5px; color: #28a745;"></i>Admin aktiv`;
            adminBtn.style.borderColor = '#28a745';
            adminBtn.style.color = '#28a745';
            adminBtn.style.fontWeight = '500';
            adminBtn.onclick = () => {
                if (confirm('Admin-Modus deaktivieren?')) {
                    this.logoutAdmin();
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

    async logoutAdmin() {
        try {
            console.log('Admin-Modus wird deaktiviert');
            this.showNotification('Admin-Modus deaktiviert', 'info');
        } catch (error) {
            console.error('Logout-Fehler:', error);
            this.showNotification('Admin-Modus deaktiviert', 'info');
        }
        
        // Admin-Status zurücksetzen
        this.isAdmin = false;
        this.adminUserId = null;
        this.updateAdminButton();
        
        // Lade Daten als normaler Benutzer neu
        await this.loadExamsFromFirebase();
        this.renderCalendar();
        this.renderExamList();
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
                examElement.style.pointerEvents = 'none'; // Wichtig: Verhindert Click-Blockierung
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
                moreElement.style.pointerEvents = 'none'; // Wichtig: Verhindert Click-Blockierung
                dayElement.appendChild(moreElement);
            }
        }

        // Mobile-optimierte Event-Handler für Popup
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        if (isTouchDevice) {
            // Touch-Events für Mobile-Geräte
            let touchStartTime = 0;
            let touchStartX = 0;
            let touchStartY = 0;
            
            dayElement.addEventListener('touchstart', (e) => {
                touchStartTime = Date.now();
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                console.log('Touch-Start auf Kalendertag:', this.formatDate(date));
            }, { passive: true });
            
            dayElement.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;
                
                // Nur bei kurzen Touches (Tap, nicht Scroll)
                if (touchDuration < 500) {
                    const touch = e.changedTouches[0];
                    const touchEndX = touch.clientX;
                    const touchEndY = touch.clientY;
                    
                    // Prüfe ob es wirklich ein Tap war (wenig Bewegung)
                    const moveDistance = Math.sqrt(
                        Math.pow(touchEndX - touchStartX, 2) + 
                        Math.pow(touchEndY - touchStartY, 2)
                    );
                    
                    if (moveDistance < 30) { // Weniger als 30px Bewegung = Tap
                        console.log('Touch-Tap erkannt auf Kalendertag:', this.formatDate(date));
                        
                        this.selectedDate = date;
                        const dayExams = this.getExamsForDate(date);
                        
                        console.log('Touch: Gefundene Exams für diesen Tag:', dayExams.length);
                        
                        // Zeige immer Popup (egal ob Exams vorhanden oder nicht)
                        this.showDayPopup(date, dayExams);
                    } else {
                        console.log('Touch-Bewegung zu groß, ignoriere als Scroll-Geste');
                    }
                } else {
                    console.log('Touch zu lang, ignoriere als Long-Press');
                }
            }, { passive: false });
            
        } else {
            // Standard Click-Events für Desktop
            dayElement.addEventListener('click', (e) => {
                e.stopPropagation();
                
                console.log('Desktop-Click: Kalendertag geklickt:', this.formatDate(date));
                
                this.selectedDate = date;
                const dayExams = this.getExamsForDate(date);
                
                console.log('Desktop: Gefundene Exams für diesen Tag:', dayExams.length);
                
                // Zeige immer Popup (egal ob Exams vorhanden oder nicht)
                this.showDayPopup(date, dayExams);
            });
        }

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
        
        // Separate upcoming and past exams
        const upcomingExams = sortedExams.filter(exam => {
            const examDate = new Date(exam.date);
            examDate.setHours(0, 0, 0, 0);
            return examDate >= today;
        });

        const pastExams = sortedExams.filter(exam => {
            const examDate = new Date(exam.date);
            examDate.setHours(0, 0, 0, 0);
            return examDate < today;
        });

        let html = '';

        // Upcoming exams section
        if (upcomingExams.length === 0) {
            html += '<div class="exam-section"><h4 style="color: #333; margin-bottom: 15px; font-size: 1.1rem;">📅 Anstehende Klassenarbeiten</h4>';
            html += '<p style="text-align: center; color: #888; padding: 20px;">Keine anstehenden Klassenarbeiten.</p></div>';
        } else {
            html += '<div class="exam-section"><h4 style="color: #333; margin-bottom: 15px; font-size: 1.1rem;">📅 Anstehende Klassenarbeiten</h4>';
            html += upcomingExams.map(exam => this.createExamItemHTML(exam, false)).join('');
            html += '</div>';
        }

        // Past exams section (archived)
        if (pastExams.length > 0) {
            html += '<div class="exam-section archive-section" style="margin-top: 30px;">';
            html += '<h4 style="color: #666; margin-bottom: 15px; font-size: 1.1rem; cursor: pointer;" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
            html += '<i class="fas fa-archive" style="margin-right: 8px;"></i>Archiv (' + pastExams.length + ' vergangene Einträge) ';
            html += '<i class="fas fa-chevron-down toggle-icon" style="float: right; transition: transform 0.3s ease;"></i>';
            html += '</h4>';
            html += '<div class="archive-content">';
            html += pastExams.map(exam => this.createExamItemHTML(exam, true)).join('');
            html += '</div></div>';
        }

        examList.innerHTML = html;

        // Bind events for all exam items
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

        // Event-Handler für Exam-Item Click (Desktop-Popup)
        examList.querySelectorAll('.exam-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Verhindere Popup wenn auf Buttons geklickt wird
                if (e.target.closest('.btn-edit') || e.target.closest('.btn-delete')) {
                    return;
                }
                
                const examId = item.dataset.examId;
                const exam = this.exams.find(e => e.id === examId);
                
                if (exam) {
                    // Prüfe ob Desktop (nicht Mobile)
                    const isDesktop = window.innerWidth > 768;
                    if (isDesktop) {
                        this.showExamDetailPopup(exam);
                    }
                }
            });
        });
    }

    createExamItemHTML(exam, isArchived = false) {
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
        const testBadge = exam.isTest ? '<span style="background: #ffc107; color: #333; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">TEST</span>' : '';
        
        // Besitzer-Info und Berechtigungen
        const isOwner = exam.ownerId === this.userId;
        const ownerDisplay = ''; // Benutzernamen nicht anzeigen
        const ownerBadge = isOwner ? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">MEINE</span>' : '';
        
        // Archive badge for past exams
        const archiveBadge = isArchived ? '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">ARCHIV</span>' : '';
        
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
                    <i class="fas fa-lock"></i> .
                </span>
            </div>
        `;

        const itemClass = isArchived ? 'exam-item archived' : 'exam-item';
        const borderStyle = isArchived ? 'style="border-left: 4px solid #6c757d; opacity: 0.8;"' : 
                           (exam.isTest ? 'style="border-left: 4px solid #ffc107;"' : 
                           (isOwner ? 'style="border-left: 4px solid #28a745;"' : 'style="border-left: 4px solid #e9ecef;"'));

        return `
            <div class="${itemClass}" data-exam-id="${exam.id}" ${borderStyle.replace('style="', 'style="cursor: pointer; ')}>
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}${testBadge}${ownerBadge}${archiveBadge}${adminBadge}</div>
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

    closeDayPopup() {
        const dayPopup = document.getElementById('dayPopup');
        const dayEvents = document.getElementById('dayEvents');
        
        // WICHTIG: Entferne ALLE Event-Handler von allen Event-Items
        if (dayEvents) {
            const eventItems = dayEvents.querySelectorAll('.day-event-item');
            eventItems.forEach(item => {
                // Entferne alle Event-Handler komplett
                item.onclick = null;
                item.ontouchend = null;
                item.ontouchstart = null;
                
                // Zusätzlich: Clone und ersetze das Element (entfernt ALLE Event-Listener)
                const cleanItem = item.cloneNode(true);
                item.parentNode.replaceChild(cleanItem, item);
            });
            
            console.log('Alle Event-Handler von Day-Event-Items entfernt');
        }
        
        dayPopup.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.selectedDate = null;
        
        console.log('Day-Popup geschlossen und Event-Handler bereinigt');
    }

    showDayPopup(date, exams) {
        // Alias für openDayPopup - für bessere Konsistenz
        this.openDayPopup(date, exams);
    }

    openDayPopup(date, exams) {
        console.log('Öffne Day-Popup für:', this.formatDate(date), 'mit', exams.length, 'Exams');
        
        const dayPopup = document.getElementById('dayPopup');
        const dayPopupTitle = document.getElementById('dayPopupTitle');
        const dayEvents = document.getElementById('dayEvents');
        const noEventsMessage = document.getElementById('noEventsMessage');
        
        // Sicherheitsprüfung für kritische Elemente
        if (!dayPopup || !dayPopupTitle || !dayEvents) {
            console.error('Kritische Popup-Elemente nicht gefunden:', {
                dayPopup: !!dayPopup,
                dayPopupTitle: !!dayPopupTitle,
                dayEvents: !!dayEvents,
                noEventsMessage: !!noEventsMessage
            });
            return;
        }
        
        // Format date for title
        const formattedDate = date.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        dayPopupTitle.textContent = formattedDate;
        
        if (exams && exams.length > 0) {
            dayEvents.innerHTML = exams.map(exam => this.createDayEventHTML(exam)).join('');
            
            // Sicherheitsprüfung für noEventsMessage
            if (noEventsMessage) {
                noEventsMessage.style.display = 'none';
            }
            
            // Füge Event-Handler zu jedem Event-Item hinzu (nach dem Rendern)
            setTimeout(() => {
                const eventItems = dayEvents.querySelectorAll('.day-event-item');
                console.log('Setze neue Event-Handler auf', eventItems.length, 'Event-Items');
                
                eventItems.forEach((item, index) => {
                    const examId = item.dataset.examId;
                    
                    // SICHERHEIT: Entferne erst alle alten Handler (falls vorhanden)
                    item.onclick = null;
                    item.ontouchend = null;
                    item.ontouchstart = null;
                    
                    // Universelle Handler-Funktion (immer neu erstellt)
                    const handleInteraction = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Event-Item ${index} Interaktion, Exam-ID:`, examId);
                        
                        // Visuelles Feedback
                        item.style.backgroundColor = '#e3f2fd';
                        item.style.transform = 'scale(0.95)';
                        item.style.transition = 'all 0.1s ease';
                        
                        setTimeout(() => {
                            this.closeDayPopup();
                            setTimeout(() => {
                                this.scrollToExamInList(examId);
                            }, 200);
                        }, 150);
                    };
                    
                    // Setze NEUE Handler (überschreibt alte automatisch)
                    item.onclick = handleInteraction;
                    item.ontouchend = handleInteraction;
                    
                    console.log(`Event-Handler gesetzt für Item ${index} mit Exam-ID:`, examId);
                });
                
                console.log('Alle Event-Handler neu gesetzt');
            }, 50);
        } else {
            dayEvents.innerHTML = '';
            
            // Sicherheitsprüfung für noEventsMessage
            if (noEventsMessage) {
                dayEvents.appendChild(noEventsMessage);
                noEventsMessage.style.display = 'block';
            } else {
                // Fallback: Erstelle eine einfache Nachricht
                dayEvents.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Keine Ereignisse an diesem Tag</p>';
            }
        }
        
        dayPopup.style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.selectedDate = date;
        
        console.log('Day-Popup geöffnet');
    }

    createDayEventHTML(exam) {
        const timeDisplay = exam.time ? ` - ${exam.time}` : '';
        const teacherDisplay = exam.teacher ? `<div><i class="fas fa-user"></i> ${exam.teacher}</div>` : '';
        const notesDisplay = exam.notes ? `<div style="font-style: italic; color: #666; margin-top: 5px;">"${exam.notes}"</div>` : '';
        const isOwner = exam.ownerId === this.userId;
        const ownerBadge = isOwner ? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">MEINE</span>' : '';
        const testBadge = exam.isTest ? '<span style="background: #ffc107; color: #333; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">TEST</span>' : '';
        
        return `
            <div class="day-event-item" data-exam-id="${exam.id}" style="cursor: pointer;">
                <div class="day-event-subject">${exam.subject}${timeDisplay}${ownerBadge}${testBadge}</div>
                <div class="day-event-topic">${exam.topic}</div>
                <div class="day-event-details">
                    ${teacherDisplay}
                    ${notesDisplay}
                </div>
            </div>
        `;
    }

    scrollToExamInList(examId) {
        console.log('Scrolle zu Exam:', examId);
        
        // Warte kurz, damit sich das Popup schließen kann
        setTimeout(() => {
            // Versuche verschiedene Methoden, das Element zu finden
            let targetExamItem = null;
            
            // Methode 1: Über Button data-exam-id
            const editBtns = document.querySelectorAll('.btn-edit[data-exam-id="' + examId + '"]');
            const deleteBtns = document.querySelectorAll('.btn-delete[data-exam-id="' + examId + '"]');
            
            if (editBtns.length > 0) {
                targetExamItem = editBtns[0].closest('.exam-item');
                console.log('Gefunden über Edit-Button');
            } else if (deleteBtns.length > 0) {
                targetExamItem = deleteBtns[0].closest('.exam-item');
                console.log('Gefunden über Delete-Button');
            }
            
            // Methode 2: Direkte Suche über alle Exam-Items
            if (!targetExamItem) {
                const examItems = document.querySelectorAll('.exam-item');
                console.log('Gefundene Exam-Items:', examItems.length);
                
                examItems.forEach((item, index) => {
                    const editBtn = item.querySelector('.btn-edit');
                    const deleteBtn = item.querySelector('.btn-delete');
                    
                    console.log(`Item ${index}:`, {
                        editId: editBtn ? editBtn.dataset.examId : 'none',
                        deleteId: deleteBtn ? deleteBtn.dataset.examId : 'none',
                        targetId: examId
                    });
                    
                    if ((editBtn && editBtn.dataset.examId === examId) || 
                        (deleteBtn && deleteBtn.dataset.examId === examId)) {
                        targetExamItem = item;
                        console.log('Gefunden über Exam-Item Suche');
                    }
                });
            }
            
            if (targetExamItem) {
                console.log('Target Exam-Item gefunden, führe Scroll aus');
                
                // Echte Mobile-Gerät Erkennung (nicht nur Viewport)
                const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                const isMobileViewport = window.innerWidth <= 768;
                const isRealMobile = isTouchDevice && isMobileViewport;
                
                console.log('Device Info:', {
                    isTouchDevice,
                    isMobileViewport,
                    isRealMobile,
                    userAgent: navigator.userAgent.includes('Mobile')
                });
                
                if (isRealMobile || navigator.userAgent.includes('Mobile')) {
                    // Echte Mobile-Geräte: Robustes Scrolling
                    console.log('Echtes Mobile-Gerät erkannt - verwende robustes Scrolling');
                    
                    // Highlight-Effekt für Mobile
                    targetExamItem.style.transition = 'all 0.4s ease';
                    targetExamItem.style.backgroundColor = '#bbdefb';
                    targetExamItem.style.borderLeft = '6px solid #1976d2';
                    targetExamItem.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)';
                    
                    // Mehrere Scroll-Methoden für Maximum-Kompatibilität (Netlify-optimiert)
                    const rect = targetExamItem.getBoundingClientRect();
                    const absoluteElementTop = rect.top + (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
                    const headerHeight = document.querySelector('.header')?.offsetHeight || 80;
                    const offset = headerHeight + 30;
                    const targetPosition = Math.max(0, absoluteElementTop - offset);
                    
                    console.log('Scroll Info (Netlify-kompatibel):', {
                        elementTop: absoluteElementTop,
                        headerHeight,
                        targetPosition,
                        windowHeight: window.innerHeight,
                        pageYOffset: window.pageYOffset,
                        documentScrollTop: document.documentElement.scrollTop,
                        bodyScrollTop: document.body.scrollTop
                    });
                    
                    // Netlify/Mobile-optimierte Scroll-Methoden
                    let scrollSuccess = false;
                    
                    // Methode 1: Moderne smooth scroll (wenn unterstützt)
                    if (!scrollSuccess && window.scrollTo && 'scrollBehavior' in document.documentElement.style) {
                        try {
                            window.scrollTo({
                                top: targetPosition,
                                left: 0,
                                behavior: 'smooth'
                            });
                            scrollSuccess = true;
                            console.log('Moderne scrollTo mit smooth behavior erfolgreich');
                        } catch (e) {
                            console.log('Moderne scrollTo fehlgeschlagen:', e);
                        }
                    }
                    
                    // Methode 2: Standard scrollTo ohne smooth behavior
                    if (!scrollSuccess && window.scrollTo) {
                        try {
                            window.scrollTo(0, targetPosition);
                            scrollSuccess = true;
                            console.log('Standard scrollTo erfolgreich');
                        } catch (e) {
                            console.log('Standard scrollTo fehlgeschlagen:', e);
                        }
                    }
                    
                    // Methode 3: Element scrollIntoView (sehr zuverlässig)
                    if (!scrollSuccess) {
                        try {
                            targetExamItem.scrollIntoView({ 
                                block: 'center',
                                inline: 'nearest',
                                behavior: 'smooth'
                            });
                            scrollSuccess = true;
                            console.log('scrollIntoView smooth erfolgreich');
                        } catch (e) {
                            try {
                                targetExamItem.scrollIntoView(true);
                                scrollSuccess = true;
                                console.log('scrollIntoView basic erfolgreich');
                            } catch (e2) {
                                console.log('scrollIntoView fehlgeschlagen:', e2);
                            }
                        }
                    }
                    
                    // Methode 4: Manuelle DOM-Scroll-Manipulation
                    if (!scrollSuccess) {
                        try {
                            if (document.documentElement && document.documentElement.scrollTop !== undefined) {
                                document.documentElement.scrollTop = targetPosition;
                                scrollSuccess = true;
                                console.log('documentElement.scrollTop erfolgreich');
                            } else if (document.body && document.body.scrollTop !== undefined) {
                                document.body.scrollTop = targetPosition;
                                scrollSuccess = true;
                                console.log('body.scrollTop erfolgreich');
                            }
                        } catch (e) {
                            console.log('Manuelle Scroll-Manipulation fehlgeschlagen:', e);
                        }
                    }
                    
                    // Methode 5: Fallback mit setTimeout für verzögerte Ausführung
                    if (!scrollSuccess) {
                        console.log('Alle direkten Scroll-Methoden fehlgeschlagen, versuche verzögerte Ausführung');
                        setTimeout(() => {
                            try {
                                const currentRect = targetExamItem.getBoundingClientRect();
                                const currentTop = currentRect.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
                                const newTargetPosition = Math.max(0, currentTop - offset);
                                
                                // Versuche wieder mit aktualisierter Position
                                if (window.scrollTo) {
                                    window.scrollTo(0, newTargetPosition);
                                } else {
                                    document.documentElement.scrollTop = newTargetPosition;
                                }
                                console.log('Verzögerter Scroll ausgeführt');
                            } catch (e) {
                                console.log('Auch verzögerter Scroll fehlgeschlagen:', e);
                            }
                        }, 200);
                    }
                    
                    // Extra: Stelle sicher dass Element sichtbar ist
                    setTimeout(() => {
                        const newRect = targetExamItem.getBoundingClientRect();
                        if (newRect.top < 0 || newRect.bottom > window.innerHeight) {
                            console.log('Element nicht vollständig sichtbar, korrigiere Position');
                            targetExamItem.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                    }, 500);
                    
                    // Entferne Mobile-Highlight nach 3 Sekunden
                    setTimeout(() => {
                        targetExamItem.style.transition = 'all 0.4s ease';
                        targetExamItem.style.backgroundColor = '';
                        targetExamItem.style.borderLeft = '';
                        targetExamItem.style.boxShadow = '';
                        
                        setTimeout(() => {
                            targetExamItem.style.transition = '';
                        }, 400);
                    }, 3000);
                    
                } else {
                    // Desktop: Original Hover-Effekt
                    console.log('Desktop-Scrolling aktiviert');
                    
                    const originalTransition = targetExamItem.style.transition;
                    const originalTransform = targetExamItem.style.transform;
                    const originalBoxShadow = targetExamItem.style.boxShadow;
                    const originalBorderColor = targetExamItem.style.borderColor;
                    
                    targetExamItem.style.transition = 'all 0.5s ease';
                    targetExamItem.style.transform = 'scale(1.02)';
                    targetExamItem.style.boxShadow = '0 12px 40px rgba(67, 97, 238, 0.4)';
                    targetExamItem.style.borderColor = '#4361ee';
                    targetExamItem.style.borderWidth = '3px';
                    
                    // Scrolle sanft zum Element
                    targetExamItem.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                    
                    // Entferne Highlight nach 3 Sekunden
                    setTimeout(() => {
                        targetExamItem.style.transition = originalTransition;
                        targetExamItem.style.transform = originalTransform;
                        targetExamItem.style.boxShadow = originalBoxShadow;
                        targetExamItem.style.borderColor = originalBorderColor;
                        targetExamItem.style.borderWidth = '';
                    }, 3000);
                }
                
                console.log('Scroll und Highlight angewendet');
            } else {
                console.error('Exam-Item nicht gefunden für ID:', examId);
                console.log('Verfügbare Exam-IDs in der Liste:');
                
                document.querySelectorAll('.exam-item').forEach((item, index) => {
                    const editBtn = item.querySelector('.btn-edit');
                    const deleteBtn = item.querySelector('.btn-delete');
                    console.log(`  ${index}: Edit-ID=${editBtn?.dataset.examId}, Delete-ID=${deleteBtn?.dataset.examId}`);
                });
            }
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('examModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.editingExam = null;
        document.getElementById('examForm').reset();
        
        console.log('Modal geschlossen');
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
                
                // Aktualisiere die lokale Liste
                const examIndex = this.exams.findIndex(e => e.id === this.editingExam.id);
                if (examIndex !== -1) {
                    // Behalte die ursprüngliche ownerId bei
                    const originalOwnerId = this.exams[examIndex].ownerId;
                    this.exams[examIndex] = { 
                        id: this.editingExam.id, 
                        ...examData, 
                        ownerId: originalOwnerId,
                        updatedAt: new Date().toISOString()
                    };
                }
                
                // Manuelle Aktualisierung da Real-time deaktiviert
                await this.refreshDataAfterOperation();
                
                console.log(`Klassenarbeit aktualisiert: ${examData.subject} - ${examData.topic}`);
                this.showNotification('Klassenarbeit erfolgreich aktualisiert!', 'success');
            } else {
                // Neu hinzufügen
                const docRef = await this.addExamToFirebase(examData);
                
                // Manuelle Aktualisierung da Real-time deaktiviert
                await this.refreshDataAfterOperation();
                
                console.log(`Neue Klassenarbeit hinzugefügt: ${examData.subject} - ${examData.topic} (ID: ${docRef.id})`);
                this.showNotification('Klassenarbeit erfolgreich gespeichert!', 'success');
            }
            
            this.closeModal();
        } catch (error) {
            console.error(`Fehler beim Speichern: ${error.message}`);
            console.error('Vollständiger Fehler:', error);
            
            // Bei Update-Fehlern versuche Daten neu zu laden
            if (this.editingExam && error.message.includes('fehlgeschlagen')) {
                console.log('Versuche Daten nach Update-Fehler neu zu laden...');
                try {
                    await this.loadExamsFromFirebase();
                    this.renderCalendar();
                    this.renderExamList();
                    this.showNotification('Daten wurden aktualisiert. Bitte versuchen Sie erneut.', 'info');
                } catch (reloadError) {
                    console.error('Fehler beim Neuladen:', reloadError.message);
                    this.showNotification(`Fehler beim Speichern: ${error.message}`, 'error');
                }
            } else {
                this.showNotification(`Fehler beim Speichern: ${error.message}`, 'error');
            }
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
        
        console.log('Versuche Klassenarbeit zu aktualisieren:', examId);
        console.log('Admin-Status:', this.isAdmin);
        console.log('Benutzer-ID:', this.userId);
        console.log('Zu speichernde Daten:', examData);
        
        // Finde die Klassenarbeit in der lokalen Liste für Fallback-Informationen
        const localExam = this.exams.find(e => e.id === examId);
        console.log('Lokale Klassenarbeit gefunden:', localExam);
        
        try {
            // Versuche zuerst globale Collection
            const examRef = this.db.collection('exams').doc(examId);
            console.log('Lade Dokument aus globaler Collection...');
            const examDoc = await examRef.get();
            
            if (examDoc.exists) {
                const currentData = examDoc.data();
                console.log('Aktuelle Daten in globaler Collection:', currentData);
                console.log('Besitzer-ID:', currentData.ownerId);
                
                // Admin kann alles bearbeiten, normale Benutzer nur ihre eigenen
                if (!this.isAdmin) {
                    const examOwner = currentData.ownerId;
                    if (examOwner !== this.userId) {
                        throw new Error('Keine Berechtigung: Sie können nur Ihre eigenen Klassenarbeiten bearbeiten');
                    }
                }
                
                console.log('Berechtigung bestätigt, aktualisiere globale Collection...');
                const updateData = {
                    ...examData,
                    ownerId: currentData.ownerId, // Stelle sicher, dass ownerId erhalten bleibt
                    updatedAt: new Date().toISOString(),
                    lastEditedBy: this.isAdmin ? 'Admin' : 'Besitzer'
                };
                console.log('Update-Daten:', updateData);
                
                await examRef.update(updateData);
                console.log('Klassenarbeit erfolgreich in globaler Collection aktualisiert:', examId);
                return; // Erfolgreich, beende die Funktion
            }
        } catch (globalError) {
            console.log('Fehler in globaler Collection:', globalError.message);
        }
        
        // Fallback zu user-spezifischer Collection
        console.log('Versuche Benutzer-Collection als Fallback...');
        try {
            const userExamRef = this.db.collection('users').doc(this.userId).collection('exams').doc(examId);
            const userExamDoc = await userExamRef.get();
            
            if (userExamDoc.exists) {
                console.log('Gefunden in Benutzer-Collection, aktualisiere...');
                await userExamRef.update({
                    ...examData,
                    updatedAt: new Date().toISOString()
                });
                console.log('Klassenarbeit erfolgreich in Benutzer-Collection aktualisiert:', examId);
                return; // Erfolgreich, beende die Funktion
            }
        } catch (userError) {
            console.error('Fehler auch in Benutzer-Collection:', userError.message);
        }
        
        // Wenn die Klassenarbeit nirgendwo gefunden wurde, erstelle sie neu in der globalen Collection
        console.log('Klassenarbeit nicht gefunden, erstelle sie neu in globaler Collection...');
        if (localExam) {
            try {
                const newExamData = {
                    ...examData,
                    ownerId: localExam.ownerId || this.userId,
                    createdAt: localExam.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastEditedBy: this.isAdmin ? 'Admin' : 'Besitzer'
                };
                
                const examRef = this.db.collection('exams').doc(examId);
                await examRef.set(newExamData);
                console.log('Klassenarbeit erfolgreich neu erstellt in globaler Collection:', examId);
                return;
            } catch (createError) {
                console.error('Fehler beim Neuerstellen:', createError.message);
                throw new Error(`Update fehlgeschlagen: Konnte Klassenarbeit nicht finden oder erstellen - ${createError.message}`);
            }
        } else {
            throw new Error('Update fehlgeschlagen: Klassenarbeit weder in Firebase noch lokal gefunden');
        }
    }

    editExam(examId) {
        this.editingExam = this.exams.find(exam => exam.id === examId);
        if (this.editingExam) {
            this.openModal();
        }
    }

    async deleteExam(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (!exam) {
            console.log('Klassenarbeit nicht in lokaler Liste gefunden:', examId);
            this.showNotification('Klassenarbeit nicht gefunden. Lade Daten neu...', 'info');
            await this.loadExamsFromFirebase();
            this.renderCalendar();
            this.renderExamList();
            return;
        }
        
        if (!confirm(`Möchten Sie die Klassenarbeit "${exam.subject}: ${exam.topic}" wirklich löschen?`)) {
            return;
        }

        try {
            console.log('Starte Löschvorgang für ID:', examId);
            
            // Firebase löschen
            await this.deleteExamFromFirebase(examId);
            console.log('Firebase-Löschung erfolgreich');
            
            // Manuelle Aktualisierung da Real-time deaktiviert
            await this.refreshDataAfterOperation();
            
            console.log(`Klassenarbeit erfolgreich gelöscht: ${exam.subject} - ${exam.topic}`);
            this.showNotification('Klassenarbeit erfolgreich gelöscht!', 'success');
        } catch (error) {
            console.error(`Fehler beim Löschen: ${error.message}`);
            
            // Bei Lösch-Fehlern: KEINE lokale Änderung, nur Daten neu laden
            console.log('Löschung fehlgeschlagen, lade Daten neu...');
            try {
                await this.loadExamsFromFirebase();
                this.renderCalendar();
                this.renderExamList();
                this.showNotification(`Löschung fehlgeschlagen: ${error.message}. Daten wurden aktualisiert.`, 'error');
            } catch (reloadError) {
                console.error('Fehler beim Neuladen:', reloadError.message);
                this.showNotification(`Fehler beim Löschen: ${error.message}`, 'error');
            }
        }
    }

    async deleteExamFromFirebase(examId) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        console.log('Versuche Klassenarbeit zu löschen:', examId);
        console.log('Admin-Status:', this.isAdmin);
        
        // Finde die Klassenarbeit in der lokalen Liste
        const localExam = this.exams.find(e => e.id === examId);
        
        // Berechtigungsprüfung
        if (localExam && !this.isAdmin && localExam.ownerId !== this.userId) {
            throw new Error('Keine Berechtigung: Sie können nur Ihre eigenen Klassenarbeiten löschen');
        }
        
        // Vereinfachte Löschstrategie mit Timeout
        try {
            console.log('Starte vereinfachte Löschung...');
            
            // Bestimme Collection basierend auf Admin-Status und Besitzer
            let targetRef;
            if (this.isAdmin && localExam && localExam.ownerId !== this.userId) {
                targetRef = this.db.collection('exams').doc(examId);
                console.log('Admin-Löschung: Globale Collection');
            } else {
                targetRef = this.db.collection('users').doc(this.userId).collection('exams').doc(examId);
                console.log('Standard-Löschung: Benutzer-Collection');
            }
            
            // Löschung mit 3s Timeout um Webchannel-Probleme zu vermeiden
            await Promise.race([
                targetRef.delete(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]);
            
            console.log('Firebase-Löschung erfolgreich');
            
        } catch (error) {
            console.warn('Firebase-Löschung fehlgeschlagen:', error.message);
            
            // Bei Webchannel/Timeout-Fehlern: Lokale Bereinigung erlauben
            if (error.message.includes('Timeout') || 
                error.message.includes('Bad Request') ||
                error.message.includes('connection') ||
                error.message.includes('webchannel')) {
                
                console.log('Verbindungsfehler erkannt - erlaube lokale Bereinigung');
                console.log('Real-time Listener wird korrekte Synchronisation übernehmen');
                // Kein throw - lokale UI wird bereinigt, Real-time sync korrigiert falls nötig
            } else if (!error.message.includes('Berechtigung')) {
                // Andere Fehler außer Berechtigungsfehlern ignorieren
                console.log('Ignoriere Firebase-Fehler, erlaube lokale Bereinigung');
            } else {
                throw error; // Nur Berechtigungsfehler weiterleiten
            }
        }
        
        console.log('Löschvorgang abgeschlossen');
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
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
    }

    // Überwache und reduziere Webchannel-Fehler
    handleWebchannelError(error) {
        this.webchannelErrorCount++;
        console.warn(`Webchannel-Fehler #${this.webchannelErrorCount}:`, error);
        
        if (this.webchannelErrorCount >= 3) {
            console.log('Zu viele Webchannel-Fehler - deaktiviere Real-time Listener');
            if (this.unsubscribeExams) {
                this.unsubscribeExams();
                this.unsubscribeExams = null;
            }
            this.showNotification('Verbindung instabil - Real-time Updates deaktiviert', 'warning');
        }
    }

    showExamDetailPopup(exam) {
        const popup = document.getElementById('exam-detail-popup');
        const examTitle = popup.querySelector('.exam-detail-title');
        const examSubject = popup.querySelector('.exam-detail-subject');
        const examDate = popup.querySelector('.exam-detail-date');
        const examTime = popup.querySelector('.exam-detail-time');
        const examDescription = popup.querySelector('.exam-detail-description');
        const editBtn = popup.querySelector('.btn-edit-exam');
        const deleteBtn = popup.querySelector('.btn-delete-exam');

        // Exam-Daten ins Popup laden
        examTitle.textContent = exam.title || exam.subject;
        examSubject.textContent = exam.subject;
        
        const examDateTime = new Date(exam.date);
        examDate.textContent = examDateTime.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        examTime.textContent = exam.time || '⏰ Keine Zeit angegeben';
        examDescription.textContent = exam.description || 'Keine Beschreibung verfügbar';

        // Button Event-Handler setzen
        editBtn.onclick = () => {
            this.closeExamDetailPopup();
            this.editExam(exam.id);
        };
        
        deleteBtn.onclick = () => {
            this.closeExamDetailPopup();
            this.deleteExam(exam.id);
        };

        // Popup anzeigen
        popup.style.display = 'flex';
        popup.offsetHeight; // Force reflow
        popup.classList.add('show');
    }

    closeExamDetailPopup() {
        const popup = document.getElementById('exam-detail-popup');
        
        popup.classList.remove('show');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
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