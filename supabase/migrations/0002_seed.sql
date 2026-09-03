-- ============================================================
-- KERIGMA - Seed inicial (dados padrão exibidos no site)
-- Mesmos itens hardcoded em index.html como fallback.
-- Aplicar APÓS a migration 0001_init.sql.
-- ============================================================

insert into public.services (sort_order, title, description, icon, whatsapp, items, image) values
(0, 'Livros Teológicos', 'Livros teológicos para aprofundar seu conhecimento da Palavra.', 'fa-book-bible', 'Olá! Tenho interesse nos Livros Teológicos. Poderia me enviar mais informações?', '["Bíblias de estudo","Teologia sistemática","História da Igreja","Hermenêutica bíblica","Aconselhamento pastoral"]'::jsonb, 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=720&q=80'),
(1, 'E-books', 'E-books práticos e acessíveis para estudo em qualquer lugar.', 'fa-tablet-alt', 'Olá! Tenho interesse nos E-books. Poderia me enviar mais informações?', '["E-books de teologia","Guias de estudo bíblico","Devocionais","Apostilas de cursos","Liderança cristã"]'::jsonb, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&q=80'),
(2, 'Cursos Online', 'Cursos online com certificado para sua formação teológica.', 'fa-video', 'Olá! Tenho interesse nos Cursos Online. Poderia me enviar mais informações?', '["Teologia Básica","Hermenêutica","Liderança","História da Igreja","Escatologia"]'::jsonb, 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=720&q=80'),
(3, 'Materiais de Estudo', 'Materiais complementares para grupos de estudo.', 'fa-pen-fancy', 'Olá! Tenho interesse nos Materiais de Estudo.', '["Guias para grupos","Lições","Mapas bíblicos","Discipulado","Plano de leitura"]'::jsonb, 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=720&q=80'),
(4, 'Palestras', 'Palestras e seminários ao vivo.', 'fa-church', 'Olá! Tenho interesse nas Palestras.', '["Seminários","Palestras família","Congressos","Encontros","Workshops"]'::jsonb, 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=720&q=80'),
(5, 'Infantil', 'Conteúdo cristão para crianças.', 'fa-child', 'Olá! Tenho interesse no Infantil.', '["Livros infantis","Devocionais","Revistas","Jovens","Atividades"]'::jsonb, 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=720&q=80');

insert into public.gallery (sort_order, title, image) values
(0, 'Culto de Louvor', 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80'),
(1, 'Confraternização', 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80'),
(2, 'Seminário 2025', 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80'),
(3, 'Batismo', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'),
(4, 'Retiro Espiritual', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'),
(5, 'Escola Bíblica', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80'),
(6, 'Formatura', 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80'),
(7, 'Ação Social', 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80'),
(8, 'Palestra', 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=900&q=80'),
(9, 'Encontro de Jovens', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80');

insert into public.site_settings (hero_title, hero_subtitle, whatsapp, email, cta_title, cta_text, address, whatsapp_text) values
('Escola de Teologia Kerigma', 'Transformando vidas através do conhecimento bíblico. Livros, e-books e cursos teológicos.', '5561981897079', 'contato@kerigma.com', 'Comece sua jornada teológica hoje', 'Entre em contato e descubra como podemos ajudar no seu crescimento espiritual e acadêmico.', 'Rua 2, Quadra 34, Lote 30 — Jardim Europa — Luziânia, GO — CEP 72855-852', 'Olá! Gostaria de saber mais sobre a Escola de Teologia Kerigma.');
