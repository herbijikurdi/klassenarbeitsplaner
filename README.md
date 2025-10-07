# Klassenarbeitsplaner mit Firebase

Ein moderner, cloudbasierter Klassenarbeitsplaner mit Echtzeit-Synchronisation.

## 🚀 Features

- **☁️ Cloud-Datenbank**: Alle Daten werden in Firebase Firestore gespeichert
- **🔄 Echtzeit-Sync**: Änderungen werden sofort synchronisiert
- **📱 Responsive Design**: Funktioniert auf allen Geräten
- **🔒 Sicher**: Jeder Benutzer hat seine eigenen Daten
- **⚡ Offline-Modus**: Funktioniert auch ohne Internetverbindung
- **🎨 Modernes UI**: Schönes, intuitives Design

## 📦 Setup

### Voraussetzungen
- Ein Firebase-Projekt
- Firestore aktiviert
- Hosting (optional für Deployment)

### Installation

1. Klonen Sie das Repository oder laden Sie die Dateien herunter
2. Ersetzen Sie die Firebase-Konfiguration in `firebase-script.js` mit Ihren Daten
3. Öffnen Sie `index.html` in einem Webserver

### Firebase Setup

1. Gehen Sie zur [Firebase Console](https://console.firebase.google.com/)
2. Erstellen Sie ein neues Projekt oder wählen Sie ein bestehendes
3. Aktivieren Sie Firestore Database
4. Kopieren Sie Ihre Konfiguration

### Firestore Regeln

Fügen Sie diese Sicherheitsregeln zu Firestore hinzu:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Jeder Benutzer kann nur seine eigenen Daten lesen/schreiben
    match /users/{userId}/exams/{examId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Benutzer-Dokumente
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🏗️ Architektur

### Dateien
- `index.html` - HTML-Struktur
- `styles.css` - CSS-Styling
- `firebase-script.js` - Firebase-Integration und App-Logik

### Datenstruktur

```
users/
  {userId}/
    exams/
      {examId}/
        - subject: string
        - topic: string
        - date: string (YYYY-MM-DD)
        - time: string (HH:MM)
        - teacher: string
        - notes: string
        - createdAt: timestamp
        - updatedAt: timestamp
```

## 🔧 Funktionen

### Klassenarbeiten verwalten
- ➕ Hinzufügen neuer Klassenarbeiten
- ✏️ Bearbeiten bestehender Einträge
- 🗑️ Löschen von Klassenarbeiten
- 📅 Kalenderansicht mit visuellen Indikatoren

### Offline-Unterstützung
- 💾 Automatisches Backup in LocalStorage
- 🔄 Synchronisation bei Verbindungswiederherstellung
- 📶 Verbindungsstatus-Anzeige

### Sicherheit
- 🔐 Anonyme Authentifizierung
- 👤 Benutzerspezifische Daten
- 🛡️ Firestore Security Rules

## 🚀 Deployment

### Firebase Hosting

1. Installieren Sie Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Initialisieren Sie Firebase:
```bash
firebase init hosting
```

3. Deployen Sie:
```bash
firebase deploy
```

### Alternative Hosting-Optionen
- Netlify
- Vercel
- GitHub Pages (mit GitHub Actions für Firebase-Funktionen)

## 🔍 Entwicklung

### Lokaler Development Server

Verwenden Sie einen lokalen Webserver:
```bash
# Python
python -m http.server 8000

# Node.js
npx serve

# Live Server (VS Code Extension)
```

### Debugging

- Browser-Entwicklertools öffnen (F12)
- Console-Logs für Firebase-Operationen beachten
- Network-Tab für API-Requests überprüfen

## 📱 Browser-Unterstützung

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 🛠️ Anpassungen

### Design ändern
- Farben in `styles.css` anpassen
- CSS-Variablen für konsistente Themes
- Responsiveness für verschiedene Bildschirmgrößen

### Funktionen erweitern
- Kategorien für Fächer
- Erinnerungen/Notifications
- Import/Export von Daten
- Gemeinsame Kalender für Klassen

## ⚠️ Wichtige Hinweise

1. **Firebase-Limits**: Kostenloser Plan hat Limits (50k Reads/Writes pro Tag)
2. **Sicherheit**: Firestore Rules richtig konfigurieren
3. **Performance**: Bei vielen Klassenarbeiten Pagination implementieren
4. **Backup**: Regelmäßige Datenexporte empfohlen

## 🐛 Fehlerbehandlung

### Häufige Probleme

1. **Firebase nicht verbunden**
   - Konfiguration überprüfen
   - Internet-Verbindung testen
   - Browser-Console auf Fehler prüfen

2. **Daten werden nicht gespeichert**
   - Firestore Rules überprüfen
   - Authentifizierung prüfen
   - Quota-Limits überprüfen

3. **Offline-Modus funktioniert nicht**
   - LocalStorage verfügbar?
   - Service Worker implementieren (optional)

## 📞 Support

Bei Problemen:
1. Browser-Console auf Fehlermeldungen prüfen
2. Firebase Console auf Logs überprüfen
3. GitHub Issues erstellen (falls Repository verfügbar)

## 📄 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte.