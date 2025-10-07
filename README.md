# Klassenarbeitsplaner (Lokale Version)

Ein moderner Klassenarbeitsplaner mit lokaler Datenspeicherung.

## 🚀 Features

- **💾 Lokale Speicherung**: Alle Daten werden sicher im Browser gespeichert
- **📱 Responsive Design**: Funktioniert auf allen Geräten
- **⚡ Schnell & Zuverlässig**: Keine Internetverbindung erforderlich
- **🎨 Modernes UI**: Schönes, intuitives Design
- **🔒 Privat**: Daten bleiben auf Ihrem Gerät

## 📦 Setup

### Voraussetzungen
- Moderner Webbrowser (Chrome, Firefox, Safari, Edge)
- Keine Internetverbindung erforderlich

### Installation

1. Laden Sie alle Dateien herunter
2. Öffnen Sie `index.html` direkt im Browser
3. Fertig! Keine weitere Konfiguration nötig

### Lokale Speicherung

Die App nutzt LocalStorage für die Datenspeicherung:
- Daten bleiben auch nach Browser-Neustart erhalten
- Keine externe Datenbank erforderlich
- Funktioniert komplett offline
- Pro Browser/Gerät separate Daten

## 🏗️ Architektur

### Dateien
- `index.html` - HTML-Struktur
- `styles.css` - CSS-Styling
- `script-local.js` - Lokale App-Logik mit LocalStorage

### Datenstruktur (LocalStorage)

```javascript
// Gespeichert unter 'klassenarbeiten' im LocalStorage
[
  {
    id: "1633024800000",
    subject: "Mathematik",
    topic: "Geometrie", 
    date: "2025-10-15",
    time: "10:00",
    teacher: "Herr Mueller",
    notes: "Kapitel 5-7 lernen"
  }
]
```

## 🔧 Funktionen

### Klassenarbeiten verwalten
- ➕ Hinzufügen neuer Klassenarbeiten
- ✏️ Bearbeiten bestehender Einträge
- 🗑️ Löschen von Klassenarbeiten
- 📅 Kalenderansicht mit visuellen Indikatoren

### Lokale Speicherung
- 💾 Automatische Speicherung im Browser
- 🔄 Daten bleiben nach Neustart erhalten
- 📶 Verbindungsstatus-Anzeige (zeigt "Lokal")
- ⚡ Keine Internetverbindung erforderlich

### Datenschutz
- 🔐 Alle Daten bleiben auf Ihrem Gerät
- 👤 Keine Benutzerregistrierung erforderlich
- 🛡️ Keine Datenübertragung ins Internet

## 🚀 Deployment

### Einfaches Hosting

Da es sich um eine reine HTML/CSS/JS-App handelt, kann sie überall gehostet werden:

1. **GitHub Pages** (kostenlos)
2. **Netlify** (kostenlos)
3. **Vercel** (kostenlos) 
4. **Eigener Webserver**

### Lokale Nutzung

```bash
# Einfach index.html öffnen oder lokalen Server starten:

# Python
python -m http.server 8000

# Node.js 
npx serve

# PHP
php -S localhost:8000
```

## 🔍 Entwicklung

### Lokaler Development Server

Verwenden Sie einen lokalen Webserver (optional):
```bash
# Python
python -m http.server 8000

# Node.js
npx serve

# Live Server (VS Code Extension)
```

**Hinweis:** Für die lokale Version ist kein Webserver erforderlich - `index.html` kann direkt geöffnet werden.

### Debugging

- Browser-Entwicklertools öffnen (F12)
- Console-Logs für App-Operationen beachten
- Application-Tab → LocalStorage für gespeicherte Daten

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

1. **Browser-Daten**: Daten sind an den Browser/Gerät gebunden
2. **Backup**: Browser-Cache/Daten löschen entfernt alle Klassenarbeiten
3. **Sync**: Keine Synchronisation zwischen verschiedenen Geräten
4. **Export**: Regelmäßige manuelle Backups empfohlen

## 🐛 Fehlerbehandlung

### Häufige Probleme

1. **Daten sind weg**
   - Browser-Cache wurde geleert
   - Privater Modus verwendet
   - LocalStorage nicht verfügbar

2. **App lädt nicht**
   - JavaScript deaktiviert
   - Veralteter Browser
   - Datei-Pfade überprüfen

3. **Funktionen arbeiten nicht**
   - Browser-Console auf Fehlermeldungen prüfen
   - LocalStorage-Quota erreicht (sehr selten)

## 📞 Support

Bei Problemen:
1. Browser-Console auf Fehlermeldungen prüfen (F12)
2. LocalStorage im Browser überprüfen (Application-Tab)
3. Mit anderem Browser testen

## � **API-Konfiguration**

### Aktuelle Firebase-Konfiguration:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCtLOaSFdlMLj5azy5vsYUUpICIo664J0g",
  authDomain: "klassenarbeitsplaner-674b4.firebaseapp.com", 
  projectId: "klassenarbeitsplaner-674b4",
  storageBucket: "klassenarbeitsplaner-674b4.firebasestorage.app",
  messagingSenderId: "130440095635",
  appId: "1:130440095635:web:e22374d62553523d97aa66"
};
```

### API-Endpunkte:
- **Firestore Database**: `https://firestore.googleapis.com/v1/projects/klassenarbeitsplaner-674b4/databases/(default)/documents/`
- **Authentication**: `https://identitytoolkit.googleapis.com/v1/`
- **Storage**: `https://firebasestorage.googleapis.com/v0/b/klassenarbeitsplaner-674b4.firebasestorage.app/`

### Verwendete Firebase-Services:
- **Firestore**: Cloud-Datenbank für Klassenarbeiten
- **Authentication**: Anonyme Benutzerauthentifizierung  
- **Hosting**: Optionales Web-Hosting

## �📄 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte.