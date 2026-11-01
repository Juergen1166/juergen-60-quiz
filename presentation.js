
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.QUIZ_CONFIG;
const $ = id => document.getElementById(id);

const db = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

const playerUrl = new URL('index.html', location.href).href;

// QR-Code in der Begrüßung
new QRCode($('qr'), {
  text: playerUrl,
  width: 220,
  height: 220
});

// QR-Code dauerhaft in der Ecke
new QRCode($('qrCorner'), {
  text: playerUrl,
  width: 120,
  height: 120
});

async function refresh() {
  try {
    const { data, error } = await db.rpc('quiz_state', {
      p_player_id: null
    });

    if (error) throw error;

    const q = data.question;

    // Noch keine Frage gestartet
    if (!q) {
      $('welcome').classList.remove('hidden');
      $('game').classList.add('hidden');
      $('qrCorner').classList.add('hidden');
      return;
    }

    // Präsentation der laufenden Frage
    $('welcome').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('qrCorner').classList.remove('hidden');

    $('questionNumber').textContent =
      `Frage ${q.number} von ${q.total}`;

    $('questionText').textContent = q.text;

    $('options').innerHTML = '';

    q.options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.textContent = opt;

      if (data.revealed &&
          data.correct_indices?.includes(i)) {
        li.classList.add('correct');
      }

      $('options').append(li);
    });

    // Richtige Antwort und Rangliste erst nach Auflösung
    if (data.revealed) {
      $('answerMessage').textContent = 'Die richtige Antwort ist markiert!';
      $('ranking').classList.remove('hidden');

      $('leaderboard').innerHTML = '';

      (data.scores || []).slice(0, 10).forEach((p, i) => {
        const li = document.createElement('li');
        li.textContent = `${p.name} – ${p.score} Punkte`;
        $('leaderboard').append(li);
      });

    } else {
      $('answerMessage').textContent = '';
      $('ranking').classList.add('hidden');
    }

  } catch (e) {
    console.error('Präsentationsfehler:', e);
  }
}

refresh();
setInterval(refresh, 3000);
