
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.QUIZ_CONFIG;
const $ = id => document.getElementById(id);

const QUESTION_ART = {
  1: ['🚲', 'Jürgens Fahrradwelt'],
  2: ['🚗', 'Das erste Auto'],
  3: ['🌡️', 'Wer dreht die Heizung ab?'],
  4: ['🏢', 'Jürgens Arbeitsplatz'],
  5: ['🏍️', 'Das erste Motorrad'],
  6: ['🚲', 'Sicher unterwegs mit dem Fahrrad'],
  7: ['🎸', 'Jürgens Lieblingsmusik'],
  8: ['🚴', 'Kilometer sammeln'],
  9: ['🎭', 'Ein Abend im Theaterhaus'],
  10: ['🎙️', 'Jürgens Lieblingspodcast'],
  11: ['📱', 'Instagram & Co.'],
  12: ['❤️', 'Eine gemeinsame Geschichte'],
  13: ['🌍', 'Reisen in die Ferne'],
  14: ['🏡', 'Das erste gemeinsame Zuhause'],
  15: ['🎂', 'Geburtstage feiern'],
  16: ['🐈', 'Die Katzenfamilie'],
  17: ['🧳', 'Eine Reise, die warten musste'],
  18: ['📚', 'Silkes Lesewelt'],
  19: ['👔', 'Jürgens Stil'],
  20: ['🔤', 'Wörter mit besonderem Dreh']
};

function showQuestionArt(questionNumber) {
  const art = document.getElementById('questionArt');
  if (!art) return;
  const [icon, caption] = QUESTION_ART[Number(questionNumber)] || ['🎉', 'Geburtstagsquiz'];
  art.replaceChildren();
  if (Number(questionNumber) === 6) {
    // Gezeichneter Fahrradhelm statt des bisherigen militärischen Helmsymbols.
    const helmet = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    helmet.setAttribute('viewBox', '0 0 120 90');
    helmet.setAttribute('class', 'question-art-icon bicycle-helmet');
    helmet.setAttribute('role', 'img');
    helmet.setAttribute('aria-label', 'Fahrradhelm');
    helmet.innerHTML = `
      <path d="M13 59 C14 32 33 12 59 12 C83 12 101 29 105 51 L115 56 L113 64 L19 64 C14 64 11 62 13 59Z"
        fill="#e5ad43" stroke="#76531d" stroke-width="4" stroke-linejoin="round"/>
      <path d="M30 43 C35 30 46 23 59 22 M55 17 L53 30 M75 21 L70 34 M91 33 L83 43"
        fill="none" stroke="#fff4d9" stroke-width="5" stroke-linecap="round"/>
      <path d="M36 64 L32 76 M85 64 L91 76 M32 76 Q60 84 91 76"
        fill="none" stroke="#76531d" stroke-width="4" stroke-linecap="round"/>
    `;
    art.append(helmet);
  } else {
    const symbol = document.createElement('span');
    symbol.className = 'question-art-icon';
    symbol.textContent = icon;
    art.append(symbol);
  }
  const label = document.createElement('span');
  label.className = 'question-art-caption';
  label.textContent = caption;
  art.append(label);
}


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

    $('welcome').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('qrCorner').classList.remove('hidden');

    const revealed = data.revealed;

    // Frage und Antwortmöglichkeiten nur während der Fragerunde
    $('questionNumber').classList.toggle('hidden', revealed);
    $('questionText').classList.toggle('hidden', revealed);
    $('options').classList.toggle('hidden', revealed);

    // Frage anzeigen
    $('questionNumber').textContent =
      `Frage ${q.number} von ${q.total}`;

    showQuestionArt(q.number);
    $('questionText').textContent = q.text;

    $('options').innerHTML = '';

    q.options.forEach(opt => {
      const li = document.createElement('li');
      li.textContent = opt;
      $('options').append(li);
    });

    // Nach Auflösung: richtige Antwort und Rangliste
    if (revealed) {
      const correctAnswers = (data.correct_indices || [])
        .map(i => q.options[i]);

      $('answerMessage').textContent =
        'Richtige Antwort: ' + correctAnswers.join(', ');

      $('answerMessage').classList.remove('hidden');
      $('ranking').classList.remove('hidden');

      $('leaderboard').innerHTML = '';

      (data.scores || []).slice(0, 10).forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name} – ${p.score} Punkte`;
        $('leaderboard').append(li);
      });

    } else {
      $('answerMessage').textContent = '';
      $('answerMessage').classList.add('hidden');
      $('ranking').classList.add('hidden');
    }

  } catch (e) {
    console.error('Präsentationsfehler:', e);
  }
}

refresh();
setInterval(refresh, 3000);
