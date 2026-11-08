
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.QUIZ_CONFIG;
const $ = id => document.getElementById(id);
let db = null;
let pin = '';
let timer = null;

function connect() {
  if (!cfg || cfg.supabaseUrl.startsWith('HIER_')) {
    throw Error('Die Verbindung ist noch nicht eingerichtet.');
  }
  db = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

function msg(t) {
  $('hostMsg').textContent = t || '';
}

$('loginBtn').addEventListener('click', async () => {
  try {
    connect();
    pin = $('pin').value;
    await action('check');
    $('controls').classList.remove('hidden');
    $('loginBtn').disabled = true;

    new QRCode($('qr'), {
      text: location.href.replace(/host\.html.*$/, 'index.html'),
      width: 180,
      height: 180
    });

    await refresh();
    timer = setInterval(refresh, 3000);
    msg('Verbunden.');
  } catch (e) {
    msg(e.message || 'Verbindung fehlgeschlagen.');
  }
});

async function action(a) {
  const { data, error } = await db.rpc('quiz_host', {
    p_pin: pin,
    p_action: a
  });
  if (error) throw error;
  return data;
}

$('startBtn').addEventListener('click', () => doAction('start'));
$('nextBtn').addEventListener('click', () => doAction('next'));
$('finalListBtn').addEventListener('click', () => doAction('final_list'));
$('revealBtn').addEventListener('click', () => doAction('reveal'));

$('resetBtn').addEventListener('click', () => {
  const overlay = document.createElement('div');

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: white;
    color: #222;
    padding: 25px;
    border-radius: 16px;
    max-width: 350px;
    width: 100%;
    text-align: center;
  `;

  const text = document.createElement('p');
  text.textContent =
    'Möchtest du das Quiz zurücksetzen? Alle Antworten und Punkte werden gelöscht. Die Spieler bleiben angemeldet und können direkt wieder mitspielen. Die 20 Quizfragen bleiben erhalten.';
  box.append(text);

  const cancel = document.createElement('button');
  cancel.textContent = 'Abbrechen';
  cancel.style.margin = '8px';

  cancel.addEventListener('click', () => overlay.remove());

  const yes = document.createElement('button');
  yes.textContent = 'Ja, Quiz zurücksetzen';
  yes.className = 'danger';
  yes.style.margin = '8px';

  yes.addEventListener('click', () => {
    overlay.remove();
    doAction('reset');
  });

  box.append(cancel, yes);
  overlay.append(box);
  document.body.append(overlay);
});

async function doAction(a) {
  try {
    await action(a);
    msg('Aktion ausgeführt.');
    await refresh();
  } catch (e) {
    msg(e.message || 'Aktion fehlgeschlagen.');
  }
}

async function deletePlayer(playerId, playerName) {
  if (!confirm('Spieler "' + playerName + '" wirklich löschen? Seine Punkte und Antworten gehen verloren.')) {
    return;
  }

  try {
    const { error } = await db.rpc('quiz_host_delete_player', {
      p_pin: pin,
      p_player_id: playerId
    });

    if (error) throw error;

    msg('Spieler ' + playerName + ' wurde gelöscht.');
    await refresh();
  } catch (e) {
    msg(e.message || 'Spieler konnte nicht gelöscht werden.');
  }
}

async function refresh() {
  try {
    const { data, error } = await db.rpc('quiz_state', {
      p_player_id: null
    });

    if (error) throw error;

    const q = data.question;
    $('hostQuestion').textContent = data.finished
      ? 'Quiz beendet – Siegerehrung läuft.'
      : q ? `Frage ${q.number} von ${q.total}: ${q.text}` : 'Noch nicht gestartet';
    $('finalListBtn').classList.toggle('hidden', !data.finished || data.final_list_shown);

    $('hostAnswers').innerHTML = '';

    if (q?.options) {
      q.options.forEach((opt, i) => {
        const div = document.createElement('p');
        div.textContent =
          (data.revealed && data.correct_indices?.includes(i) ? '✓ ' : '') + opt;
        $('hostAnswers').append(div);
      });
    }

    $('hostScores').innerHTML = '';

    (data.scores || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.name} – ${p.score} Punkte `;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Spieler löschen';
      btn.className = 'danger';

      btn.addEventListener('click', () => {
        deletePlayer(p.id, p.name);
      });

      li.append(btn);
      $('hostScores').append(li);
    });

  } catch (e) {
    msg(e.message || 'Aktualisierung fehlgeschlagen.');
  }
}
