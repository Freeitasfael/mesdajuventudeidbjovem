INSERT INTO public.app_settings (key, value) VALUES
  ('hero_prizes', '[
    {"position":"1º PRÊMIO","name":"iPhone 15","image":""},
    {"position":"2º PRÊMIO","name":"PlayStation 5","image":""},
    {"position":"3º PRÊMIO","name":"Moto CG 160","image":""}
  ]'::jsonb),
  ('hero_stats', '{"years":16,"people":"MILHARES","coverage":"TODO O PAÍS"}'::jsonb)
ON CONFLICT (key) DO NOTHING;