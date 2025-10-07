// Firebase Klassenarbeitsplaner - Funktionierende Version
// Alle Daten werden in Firebase gespeichert mit Test-Funktionen

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
        this.testOutput = null;
        
        console.log('🚀 Firebase Klassenarbeitsplaner gestartet');
        this.init();
    }

    async init() {
        this.updateConnectionStatus('connecting');
        this.testOutput = document.getElementById('testOutput');
        
        try {
            // Firebase initialisieren
            await this.initFirebase();
            
            // Authentifizierung
            await this.authenticateUser();
            
            // Events binden
            this.bindEvents();
            this.bindTestEvents();
            
            // Daten laden
            await this.loadExamsFromFirebase();
            
            // UI rendern
            this.renderCalendar();
            this.renderExamList();
            
            this.updateConnectionStatus('online');
            this.logTest('✅ Firebase erfolgreich verbunden!', 'success');
            this.showNotification('Firebase-Verbindung aktiv!', 'success');
            
        } catch (error) {
            console.error('Firebase Initialisierung fehlgeschlagen:', error);
            this.updateConnectionStatus('error');
            this.logTest(`❌ Firebase-Fehler: ${error.message}`, 'error');
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
        this.logTest('🔥 Firebase SDK initialisiert', 'info');
    }

    async authenticateUser() {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.auth.onAuthStateChanged(async (user) => {
                try {
                    if (user) {
                        this.userId = user.uid;
                        this.logTest(`👤 Benutzer angemeldet: ${this.userId.substring(0, 8)}...`, 'success');
                        unsubscribe();
                        resolve();
                    } else {
                        this.logTest('🔐 Starte anonyme Anmeldung...', 'info');
                        const userCredential = await this.auth.signInAnonymously();
                        this.userId = userCredential.user.uid;
                        this.logTest(`✅ Anonyme Anmeldung erfolgreich: ${this.userId.substring(0, 8)}...`, 'success');
                        unsubscribe();
                        resolve();
                    }
                } catch (error) {
                    this.logTest(`❌ Authentifizierung fehlgeschlagen: ${error.message}`, 'error');
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
                this.logTest('✅ Globale Collection verfügbar', 'success');
                
            } catch (globalError) {
                this.logTest('⚠️ Globale Collection nicht verfügbar, verwende Benutzer-Collection', 'warning');
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

            this.logTest(`📥 ${this.exams.length} Klassenarbeiten aus Firebase geladen`, 'info');

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
                    this.logTest(`🔄 Real-time Update: ${this.exams.length} Klassenarbeiten`, 'info');
                }
                
                this.renderCalendar();
                this.renderExamList();
            });

        } catch (error) {
            this.logTest(`❌ Fehler beim Laden: ${error.message}`, 'error');
            throw error;
        }
    }

    bindTestEvents() {
        // Test-Buttons
        document.getElementById('testConnection').addEventListener('click', () => {
            this.testFirebaseConnection();
        });

        document.getElementById('testWrite').addEventListener('click', () => {
            this.testWriteToFirebase();
        });

        document.getElementById('showFirebaseData').addEventListener('click', () => {
            this.showFirebaseData();
        });

        document.getElementById('clearTestData').addEventListener('click', () => {
            this.clearTestData();
        });
    }

    async testFirebaseConnection() {
        this.logTest('🧪 Teste Firebase-Verbindung...', 'info');
        
        try {
            // Teste Authentifizierung
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error('Nicht authentifiziert');
            }
            this.logTest(`✅ Authentifizierung OK: ${user.uid.substring(0, 8)}...`, 'success');

            // Teste Firestore-Zugriff
            const testDoc = await this.db.collection('test').doc('connection').get();
            this.logTest('✅ Firestore-Zugriff OK', 'success');

            // Teste Schreibberechtigung
            await this.db.collection('test').doc('write-test').set({
                timestamp: new Date().toISOString(),
                test: true,
                ownerId: this.userId
            });
            this.logTest('✅ Schreibberechtigung OK', 'success');

            // Lösche Test-Dokument
            await this.db.collection('test').doc('write-test').delete();
            this.logTest('✅ Löschberechtigung OK', 'success');

            this.logTest('🎉 Alle Firebase-Tests erfolgreich!', 'success');

        } catch (error) {
            this.logTest(`❌ Verbindungstest fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    async testWriteToFirebase() {
        this.logTest('🧪 Erstelle Test-Klassenarbeit...', 'info');
        
        try {
            const testExam = {
                subject: '🧪 TEST',
                topic: 'Firebase Verbindungstest',
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // In einer Woche
                time: '10:00',
                teacher: 'System',
                notes: 'Dies ist ein automatischer Test-Eintrag',
                createdAt: new Date().toISOString(),
                isTest: true
            };

            const testExamWithOwner = {
                ...testExam,
                ownerId: this.userId,
                ownerName: `Benutzer ${this.userId.substring(0, 8)}...`
            };
            
            const docRef = await this.db.collection('exams').add(testExamWithOwner);
            this.logTest(`✅ Test-Klassenarbeit erstellt! ID: ${docRef.id}`, 'success');
            this.logTest(`📝 Daten: ${JSON.stringify(testExam, null, 2)}`, 'info');

        } catch (error) {
            this.logTest(`❌ Test-Schreibvorgang fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    async showFirebaseData() {
        this.logTest('📊 Lade alle Firebase-Daten...', 'info');
        
        try {
            const snapshot = await this.db.collection('exams').get();
            
            if (snapshot.empty) {
                this.logTest('📭 Keine Daten in Firebase gefunden', 'info');
                return;
            }

            this.logTest(`📊 ${snapshot.size} Dokumente in Firebase:`, 'info');
            snapshot.forEach((doc) => {
                const data = doc.data();
                this.logTest(`📄 ID: ${doc.id}`, 'info');
                this.logTest(`   Fach: ${data.subject} | Thema: ${data.topic}`, 'info');
                this.logTest(`   Datum: ${data.date} | Zeit: ${data.time || 'nicht gesetzt'}`, 'info');
                this.logTest(`   Erstellt: ${data.createdAt || 'unbekannt'}`, 'info');
                this.logTest('   ---', 'info');
            });

        } catch (error) {
            this.logTest(`❌ Fehler beim Laden der Daten: ${error.message}`, 'error');
        }
    }

    async clearTestData() {
        this.logTest('🗑️ Lösche alle Test-Einträge...', 'info');
        
        try {
            const snapshot = await this.db.collection('exams')
                .where('isTest', '==', true)
                .where('ownerId', '==', this.userId).get();
            
            if (snapshot.empty) {
                this.logTest('📭 Keine Test-Einträge gefunden', 'info');
                return;
            }

            const batch = this.db.batch();
            let count = 0;
            
            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
                count++;
            });

            await batch.commit();
            this.logTest(`✅ ${count} Test-Einträge gelöscht`, 'success');

        } catch (error) {
            this.logTest(`❌ Fehler beim Löschen: ${error.message}`, 'error');
        }
    }

    logTest(message, type = 'info') {
        if (!this.testOutput) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('p');
        logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="${type}">${message}</span>`;
        
        this.testOutput.appendChild(logEntry);
        this.testOutput.scrollTop = this.testOutput.scrollHeight;
        
        // Auch in Console loggen
        console.log(`[${timestamp}] ${message}`);
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
        const ownerDisplay = exam.ownerName ? `<span style="color: #666; font-size: 0.8rem;"><i class="fas fa-user-circle"></i> von ${exam.ownerName}</span>` : '';
        const ownerBadge = isOwner ? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">MEINE</span>' : '';
        
        // Aktions-Buttons nur für eigene Einträge
        const actionsHTML = isOwner ? `
            <div class="exam-actions">
                <button class="btn-edit" data-exam-id="${exam.id}">
                    <i class="fas fa-edit"></i> Bearbeiten
                </button>
                <button class="btn-delete" data-exam-id="${exam.id}">
                    <i class="fas fa-trash"></i> Löschen
                </button>
            </div>
        ` : `
            <div class="exam-actions">
                <span style="color: #999; font-style: italic; font-size: 0.9rem;">
                    <i class="fas fa-lock"></i> Nur ${exam.ownerName || 'Besitzer'} kann bearbeiten
                </span>
            </div>
        `;

        return `
            <div class="exam-item" ${exam.isTest ? 'style="border-left: 4px solid #ffc107;"' : (isOwner ? 'style="border-left: 4px solid #28a745;"' : 'style="border-left: 4px solid #e9ecef;"')}>
                <div class="exam-item-header">
                    <div class="exam-subject">${exam.subject}${firebaseIcon}${testBadge}${ownerBadge}</div>
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
            if (this.editingExam) {
                // Bearbeiten
                await this.updateExamInFirebase(this.editingExam.id, examData);
                this.logTest(`✏️ Klassenarbeit aktualisiert: ${examData.subject} - ${examData.topic}`, 'success');
                this.showNotification('Klassenarbeit in Firebase aktualisiert!', 'success');
            } else {
                // Neu hinzufügen
                const docRef = await this.addExamToFirebase(examData);
                this.logTest(`➕ Neue Klassenarbeit hinzugefügt: ${examData.subject} - ${examData.topic} (ID: ${docRef.id})`, 'success');
                this.showNotification('Klassenarbeit in Firebase gespeichert!', 'success');
            }
            
            this.closeModal();
        } catch (error) {
            this.logTest(`❌ Fehler beim Speichern: ${error.message}`, 'error');
            this.showNotification('Fehler beim Speichern in Firebase!', 'error');
        }
    }

    async addExamToFirebase(examData) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
        try {
            // Versuche zuerst globale Collection
            const examWithOwner = {
                ...examData,
                ownerId: this.userId,
                ownerName: `Benutzer ${this.userId.substring(0, 8)}...`
            };
            
            const examsRef = this.db.collection('exams');
            const docRef = await examsRef.add(examWithOwner);
            console.log('Klassenarbeit zu globaler Firebase Collection hinzugefügt:', docRef.id);
            return docRef;
            
        } catch (globalError) {
            this.logTest('⚠️ Globale Collection nicht verfügbar, verwende Benutzer-Collection', 'warning');
            
            // Fallback zu user-spezifischer Collection
            const examsRef = this.db.collection('users').doc(this.userId).collection('exams');
            const docRef = await examsRef.add(examData);
            console.log('Klassenarbeit zu Benutzer-Collection hinzugefügt:', docRef.id);
            return docRef;
        }
    }

    async updateExamInFirebase(examId, examData) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
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
        
        await examRef.update({
            ...examData,
            updatedAt: new Date().toISOString()
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
            this.logTest(`🗑️ Klassenarbeit gelöscht: ${exam.subject} - ${exam.topic}`, 'success');
            this.showNotification('Klassenarbeit aus Firebase gelöscht!', 'success');
        } catch (error) {
            this.logTest(`❌ Fehler beim Löschen: ${error.message}`, 'error');
            this.showNotification('Fehler beim Löschen!', 'error');
        }
    }

    async deleteExamFromFirebase(examId) {
        if (!this.userId || !this.db) throw new Error('Firebase nicht verfügbar');
        
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