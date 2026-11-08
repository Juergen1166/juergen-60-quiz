# Testplan – Ergebnisfreigabe und Zeitwertung

**Status:** Vorbereitet, noch nicht gegen die produktive Supabase-Datenbank ausgeführt.

## Vorbedingungen
- SQL-Migration und Frontend-Version müssen zusammen aktiviert werden.
- Vorher ein Backup der drei SQL-Funktionen und des Quiz-Zustands sichern.
- Für einen vollständigen Test nach Möglichkeit eine getrennte Supabase-Testdatenbank verwenden.
- Browser auf Handy und Beamer nach Bereitstellung neu laden.

## Testfälle
1. Spielleiter startet Frage 1; Handy und Beamer zeigen die Frage.
2. Spieler A sendet nach ca. 3 Sekunden eine richtige Antwort: nur „Antwort gespeichert“, keine Lösung und keine Punkte.
3. Spieler B sendet nach ca. 10 Sekunden eine richtige Antwort: ebenfalls keine Lösung und keine Punkte.
4. Spieler C sendet eine falsche Antwort: ebenfalls nur „Antwort gespeichert“.
5. Vor Freigabe: quiz_state liefert revealed=false, correct_indices fehlt und scores=[]; die Präsentation zeigt keine Rangliste.
6. Spielleiter klickt „Antwort anzeigen“: alle sehen richtige Lösung und Rangliste; A=1000, B ungefähr 960, C=0.
7. Erneuter Klick auf „Antwort anzeigen“ darf Punkte nicht doppelt vergeben.
8. Nächste Frage starten: Lösung und Rangliste verschwinden, Zeitmessung beginnt neu.
9. Mehrfachauswahl testen: nur exakt alle richtigen Antworten ergeben Punkte.
10. Reset: Antworten/Punkte gelöscht, Spieler bleiben erhalten, Startzeit wird zurückgesetzt.
11. Handy-Seite neu laden: bestehende Spieler-ID und abgegebene Antwort bleiben erkannt.
12. Test der letzten Frage und des bisherigen QR-Codes.
13. Grenzfälle: 5 Sekunden = 1000, 105 Sekunden oder später = 200, falsche Antwort = 0.
14. Parallelität: Antwortsendung und Freigabe zur selben Zeit dürfen keine Antwort nach Freigabe zulassen.

## Abnahme
Erst nach bestandenen Tests SQL in Supabase aktivieren und Änderungen nach main übernehmen. Ein Entwicklungszweig allein ändert die GitHub-Pages-Live-Version nicht.


## Ergänzung: Quiz-Finale
15. Nach Freigabe der letzten Frage und Klick auf „Nächste Frage“ wechselt die Präsentation zur Siegerehrung mit Podium und Konfetti.
16. Spielleitung klickt „Alle Platzierungen anzeigen“; die Präsentation zeigt alle Spieler nach Punkten sortiert.
17. Bei Punktgleichheit werden in der vollständigen Liste gleiche Platzierungen vergeben.
