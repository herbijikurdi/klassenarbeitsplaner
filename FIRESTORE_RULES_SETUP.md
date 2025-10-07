# Firebase Firestore Sicherheitsregeln für Admin-Zugriff

## 🔐 Übersicht der Sicherheitsregeln

Diese Firestore-Regeln ermöglichen es dem Admin-Account (`admin@admin.admin`) auf alle Daten zuzugreifen, während normale Benutzer nur ihre eigenen Daten verwalten können.

## 📋 Implementierung der Regeln

### 1. Firebase Console öffnen
1. Gehen Sie zu [Firebase Console](https://console.firebase.google.com/)
2. Wählen Sie Ihr Projekt `klassenarbeitsplaner-674b4`
3. Navigieren Sie zu **Firestore Database**
4. Klicken Sie auf **Regeln** (Rules)

### 2. Regeln einsetzen
1. Kopieren Sie den Inhalt der `firestore.rules` Datei
2. Ersetzen Sie die bestehenden Regeln komplett
3. Klicken Sie auf **Veröffentlichen** (Publish)

### 3. Regeln testen
Verwenden Sie den **Regelsimulator** in der Firebase Console:

```javascript
// Test: Admin-Zugriff
auth: { uid: 'admin-uid', token: { email: 'admin@admin.admin' } }
Path: /exams/test-exam-id
Operation: read/write/delete
// Sollte: ALLOW

// Test: Normaler Benutzer auf eigene Daten
auth: { uid: 'user123' }
Path: /users/user123/exams/exam456
Operation: read/write
// Sollte: ALLOW

// Test: Normaler Benutzer auf fremde Daten
auth: { uid: 'user123' }
Path: /users/user456/exams/exam789
Operation: read/write
// Sollte: DENY
```

## 🛡️ Sicherheitsfeatures

### Admin-Berechtigung
- **Vollzugriff**: Admin kann alle Collections lesen, schreiben und löschen
- **Email-Verifikation**: Nur `admin@admin.admin` gilt als Admin
- **Globale Berechtigung**: Admin kann auf alle Benutzer-Collections zugreifen

### Benutzer-Berechtigung
- **Eigene Daten**: Benutzer können nur ihre eigenen Daten verwalten
- **Geteilte Exams**: Globale `exams` Collection ist für alle lesbar
- **Sichere Isolation**: Kein Zugriff auf fremde Benutzerdaten

### Collection-spezifische Regeln

#### `/exams/{examId}` (Globale Klassenarbeiten)
- **Lesen**: Alle authentifizierten Benutzer
- **Schreiben**: Admin oder Ersteller
- **Löschen**: Admin oder Besitzer

#### `/users/{userId}/exams/{examId}` (Benutzer-Exams)
- **Alle Operationen**: Admin oder Besitzer

#### `/admin/{document}` (Admin-Bereich)
- **Alle Operationen**: Nur Admin

#### `/logs/{logId}` (System-Logs)
- **Lesen**: Nur Admin
- **Schreiben**: Alle (für Logging)

## ⚠️ Wichtige Hinweise

### Vor der Implementierung
1. **Backup erstellen**: Sichern Sie die aktuellen Regeln
2. **Testumgebung**: Testen Sie die Regeln erst in einer Testumgebung
3. **Admin-Account**: Stellen Sie sicher, dass `admin@admin.admin` existiert

### Nach der Implementierung
1. **Funktionalität testen**: Prüfen Sie Admin- und Benutzer-Zugriff
2. **Performance überwachen**: Beobachten Sie die Firestore-Performance
3. **Logs überprüfen**: Kontrollieren Sie die Firestore-Logs auf Fehler

## 🚀 Firebase CLI Deployment (Optional)

Falls Sie Firebase CLI verwenden:

```bash
# Installation (falls nicht installiert)
npm install -g firebase-tools

# Login
firebase login

# Projekt initialisieren
firebase init firestore

# Regeln deployen
firebase deploy --only firestore:rules
```

## 🔧 Debugging

### Regel-Test-Tool
Verwenden Sie das integrierte Test-Tool in der Firebase Console:
1. Firestore → Regeln → **Regelsimulator**
2. Testen Sie verschiedene Szenarien
3. Überprüfen Sie Allow/Deny-Entscheidungen

### Häufige Probleme
- **Admin-Account nicht erkannt**: Email-Adresse exakt `admin@admin.admin` verwenden
- **Zugriff verweigert**: Authentication-Token überprüfen
- **Regeln nicht aktiv**: Deployment-Status in Firebase Console prüfen

## 📊 Monitoring

### Firestore-Logs
- **Firebase Console**: Firestore → Verwendung → Anfragen
- **Cloud Logging**: Detaillierte Regel-Evaluierung
- **Performance**: Regel-Evaluierungszeit überwachen

### Sicherheits-Alerts
- **Ungewöhnliche Zugriffe**: Monitoring für Admin-Account einrichten
- **Fehlgeschlagene Authentifizierung**: Logs auf wiederholte Fehler prüfen
- **Regel-Verletzungen**: Automatische Benachrichtigungen einrichten