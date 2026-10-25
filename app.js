
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.QUIZ_CONFIG;
const $ = id => document.getElementById(id);

let db = null;
let playerId = localStorage.getItem('juergen60_player_id');
let lastQuestion = 0;
let selected = new Set();
let stateTimer = null;

function connect() {
  if (!cfg || cfg.supabaseUrl.startsWith('HIER_')) {
    throw Error('Die Verbindung ist noch nicht eingerichtet. Bitte erst Supabase konfigurieren.');
  }
  db = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

function message(id, text) {
  $(id).textContent = text || '';
}

$('joinBtn').addEventListener('click', async () => {
  try {
    connect();
    message('joinMsg', 'Verbinde …');

    const { data, error } = await db.rpc('quiz_join', {
      p_code: $('roomCode').value,
      p_nickname: $('nickname').value
    });

    if (error) throw error;

    playerId = data.player_id;
    localStorage.setItem('juergen60_player_id', playerId);
    $('join').classList.add('hidden');
    $('game').classList.remove('hidden');

    await refresh();

    if (stateTimer) clearInterval(stateTimer);
    stateTimer = setInterval(refresh, 3000);
  } catch (e) {
    message('joinMsg', e.message || 'Verbindung fehlgeschlagen.');
  }
});

async function refresh() {
  if (!db || !playerId) return;

  try {
    const { data, error } = await db.rpc('quiz_state', {
      p_player_id: playerId
    });

    if (error) throw error;
    render(data);
  } catch (e) {
    message('gameMsg', e.message || 'Aktualisierung fehlgeschlagen.');
  }
}

function render(s) {
  const scores = $('scores');
  scores.innerHTML = '';

  (s.scores || []).slice(0, 12).forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} – ${p.score} Punkte`;
    scores.append(li);
  });

  const q = s.question;

  if (!s.started || !q) {
    $('status').textContent = 'Warte auf den Spielstart';
    $('questionTitle').textContent = 'Die Spielleitung startet gleich …';
    $('answers').innerHTML = '';
    $('sendBtn').classList.add('hidden');
    return;
  }

  if (lastQuestion !== q.number) {
    lastQuestion = q.number;
    selected.clear();
    message('gameMsg', '');
  }

  $('status').textContent =
    `Frage ${q.number} von ${q.total} · ${q.points} Punkte`;

  $('questionTitle').textContent = q.text;
  $('answers').innerHTML = '';

  // Nur Frage 3 erlaubt eine einzige Antwort.
  const singleChoice = Number(q.number) === 3;

  q.options.forEach((opt, i) => {
    const label = document.createElement('label');
    label.className = 'answer';

    const input = document.createElement('input');
    input.type = singleChoice ? 'radio' : 'checkbox';
    input.name = 'quiz-answer';
    input.checked = selected.has(i);
    input.disabled = s.revealed || s.player_answered;

    input.addEventListener('change', () => {
      if (singleChoice) {
        selected.clear();
        if (input.checked) selected.add(i);
        render(s);
      } else {
        if (input.checked) selected.add(i);
        else selected.delete(i);
      }
    });

    const span = document.createElement('span');
    span.textContent = opt;
    label.append(input, span);

    if (s.revealed && s.correct_indices?.includes(i)) {
      label.classList.add('correct');
    }

    $('answers').append(label);
  });

  $('sendBtn').classList.toggle(
    'hidden',
    s.revealed || s.player_answered
  );

  $('sendBtn').textContent =
    s.player_answered ? 'Antwort abgegeben' : 'Antwort abschicken';

  if (s.player_answered) {
    message('gameMsg', 'Deine Antwort ist gespeichert.');
  } else if (s.revealed) {
    message('gameMsg', 'Die richtigen Antworten sind grün markiert.');
  } else if (singleChoice) {
    message('gameMsg', 'Bitte eine Antwort auswählen.');
  } else {
    message('gameMsg', 'Bei Mehrfachauswahl bitte alle passenden Antworten markieren.');
  }
}

$('sendBtn').addEventListener('click', async () => {
  try {
    if (!selected.size) {
      message('gameMsg', 'Bitte mindestens eine Antwort auswählen.');
      return;
    }

    const { data, error } = await db.rpc('quiz_submit', {
      p_player_id: playerId,
      p_selected: [...selected].sort((a, b) => a - b)
    });

    if (error) throw error;

    message(
      'gameMsg',
      data.points > 0
        ? 'Richtig! Punkte gutgeschrieben.'
        : 'Antwort gespeichert – diesmal leider keine Punkte.'
    );

    await refresh();
  } catch (e) {
    message('gameMsg', e.message || 'Antwort konnte nicht gespeichert werden.');
  }
});

// Vorhandene Spielersitzung beim erneuten Öffnen wiederherstellen.
if (playerId) {
  try {
    connect();
    $('join').classList.add('hidden');
    $('game').classList.remove('hidden');
    refresh();
    stateTimer = setInterval(refresh, 3000);
  } catch (e) {
    localStorage.removeItem('juergen60_player_id');
    playerId = null;
  }
}
