-- Migration: Ergebnisfreigabe und lineare Zeitwertung
-- Erst nach Prüfung auf dem Entwicklungszweig in Supabase ausführen.

ALTER TABLE public.quiz_room
  ADD COLUMN IF NOT EXISTS question_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_list_shown boolean NOT NULL DEFAULT false;

-- Falls bei der Migration bereits eine Fragerunde offen ist, beginnt
-- deren Zeitmessung ab jetzt statt mit einem NULL-Zeitstempel.
UPDATE public.quiz_room
SET question_started_at = clock_timestamp()
WHERE id = 1
  AND started = true
  AND current_question > 0
  AND revealed = false
  AND question_started_at IS NULL;

CREATE OR REPLACE FUNCTION public.quiz_host(p_pin text, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r public.quiz_room%rowtype;
  total integer;
BEGIN
  SELECT * INTO r FROM public.quiz_room WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Der Quizraum wurde nicht gefunden.';
  END IF;
  IF crypt(p_pin, r.host_pin_hash) <> r.host_pin_hash THEN
    RAISE EXCEPTION 'Die Spielleiter-PIN ist falsch.';
  END IF;

  SELECT count(*) INTO total FROM public.quiz_questions;

  IF p_action = 'check' THEN
    RETURN jsonb_build_object('ok', true, 'action', 'check');

  ELSIF p_action = 'start' THEN
    IF total < 1 THEN
      RAISE EXCEPTION 'Es sind keine Quizfragen vorhanden.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_answers) THEN
      RAISE EXCEPTION 'Es gibt bereits Antworten. Bitte zuerst zurücksetzen.';
    END IF;
    UPDATE public.quiz_room
    SET started = true,
        current_question = 1,
        revealed = false,
        question_started_at = clock_timestamp(),
        finished = false,
        final_list_shown = false
    WHERE id = 1;

  ELSIF p_action = 'next' THEN
    IF NOT r.started THEN
      UPDATE public.quiz_room
      SET started = true,
          current_question = 1,
          revealed = false,
          question_started_at = clock_timestamp(),
          finished = false,
          final_list_shown = false
      WHERE id = 1;
    ELSIF NOT r.revealed THEN
      RAISE EXCEPTION 'Bitte zuerst die Antwort anzeigen.';
    ELSIF r.current_question < total THEN
      UPDATE public.quiz_room
      SET current_question = r.current_question + 1,
          revealed = false,
          question_started_at = clock_timestamp()
      WHERE id = 1;
    ELSE
      UPDATE public.quiz_room
      SET finished = true, final_list_shown = false
      WHERE id = 1;
    END IF;

  ELSIF p_action = 'final_list' THEN
    IF NOT r.finished THEN
      RAISE EXCEPTION 'Die Siegerehrung ist noch nicht gestartet.';
    END IF;
    UPDATE public.quiz_room SET final_list_shown = true WHERE id = 1;

  ELSIF p_action = 'reveal' THEN
    IF NOT r.started OR r.current_question < 1 OR r.current_question > total THEN
      RAISE EXCEPTION 'Es läuft gerade keine gültige Frage.';
    END IF;
    IF NOT r.revealed THEN
      UPDATE public.quiz_answers a
      SET points_awarded =
        CASE
          WHEN a.selected_indices = (
            SELECT array_agg(x ORDER BY x) FROM unnest(q.correct_indices) x
          ) THEN
            GREATEST(
              200,
              LEAST(
                1000,
                FLOOR(
                  1000 - GREATEST(
                    0,
                    EXTRACT(EPOCH FROM (a.submitted_at - r.question_started_at)) - 5
                  ) * 8
                )::integer
              )
            )
          ELSE 0
        END
      FROM public.quiz_questions q
      WHERE q.question_no = r.current_question
        AND a.question_no = r.current_question;
    END IF;

    UPDATE public.quiz_room SET revealed = true WHERE id = 1;

  ELSIF p_action = 'reset' THEN
    DELETE FROM public.quiz_answers;
    DELETE FROM public.quiz_players;
    UPDATE public.quiz_room
    SET started = false,
        current_question = 0,
        revealed = false,
        question_started_at = NULL,
        finished = false,
        final_list_shown = false
    WHERE id = 1;

  ELSE
    RAISE EXCEPTION 'Unbekannte Aktion.';
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', p_action);
END;
$function$;

CREATE OR REPLACE FUNCTION public.quiz_state(p_player_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.quiz_room%rowtype;
  q public.quiz_questions%rowtype;
  result jsonb;
  scores jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO r FROM public.quiz_room WHERE id = 1;

  -- Punktestände werden erst nach Freigabe der aktuellen Frage ausgegeben.
  IF r.revealed THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('id', id, 'name', nickname, 'score', total)
        ORDER BY total DESC, nickname
      ),
      '[]'::jsonb
    )
    INTO scores
    FROM (
      SELECT p.id, p.nickname,
             COALESCE(SUM(a.points_awarded), 0)::integer AS total
      FROM public.quiz_players p
      LEFT JOIN public.quiz_answers a ON a.player_id = p.id
      GROUP BY p.id, p.nickname
    ) s;
  END IF;

  result := jsonb_build_object(
    'started', r.started,
    'current_question', r.current_question,
    'revealed', r.revealed,
    'finished', r.finished,
    'final_list_shown', r.final_list_shown,
    'scores', scores,
    'player_answered', false
  );

  IF r.started AND r.current_question > 0 THEN
    SELECT * INTO q
    FROM public.quiz_questions
    WHERE question_no = r.current_question;

    IF FOUND THEN
      result := result || jsonb_build_object(
        'question',
        jsonb_build_object(
          'number', q.question_no,
          'total', (SELECT count(*) FROM public.quiz_questions),
          'text', q.question_text,
          'options', q.options,
          'points', q.points
        )
      );

      IF r.revealed THEN
        result := result || jsonb_build_object(
          'correct_indices', to_jsonb(q.correct_indices)
        );
      END IF;

      IF p_player_id IS NOT NULL THEN
        result := result || jsonb_build_object(
          'player_answered',
          EXISTS (
            SELECT 1 FROM public.quiz_answers
            WHERE player_id = p_player_id
              AND question_no = q.question_no
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.quiz_submit(p_player_id uuid, p_selected integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.quiz_room%rowtype;
  q public.quiz_questions%rowtype;
BEGIN
  SELECT * INTO r FROM public.quiz_room WHERE id = 1 FOR UPDATE;

  IF NOT r.started OR r.current_question < 1 OR r.revealed THEN
    RAISE EXCEPTION 'Die Frage ist gerade nicht offen.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quiz_players WHERE id = p_player_id) THEN
    RAISE EXCEPTION 'Spieler nicht gefunden. Bitte erneut beitreten.';
  END IF;

  SELECT * INTO q
  FROM public.quiz_questions
  WHERE question_no = r.current_question;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Die aktuelle Quizfrage wurde nicht gefunden.';
  END IF;

  IF p_selected IS NULL
     OR cardinality(p_selected) = 0
     OR cardinality(p_selected) <> (SELECT count(DISTINCT x) FROM unnest(p_selected) x)
     OR EXISTS (
       SELECT 1 FROM unnest(p_selected) x
       WHERE x < 0 OR x >= cardinality(q.options)
     ) THEN
    RAISE EXCEPTION 'Bitte gültige Antwort(en) auswählen.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_answers
    WHERE player_id = p_player_id
      AND question_no = r.current_question
  ) THEN
    RAISE EXCEPTION 'Du hast bereits geantwortet.';
  END IF;

  -- Bewertung erfolgt bewusst erst beim Klick auf "Antwort anzeigen".
  INSERT INTO public.quiz_answers(
    player_id, question_no, selected_indices, points_awarded, submitted_at
  )
  VALUES (
    p_player_id,
    r.current_question,
    (SELECT array_agg(x ORDER BY x) FROM unnest(p_selected) x),
    0,
    clock_timestamp()
  );

  RETURN jsonb_build_object('ok', true, 'saved', true);
END;
$function$;
