-- Public bucket for homepage media (testimonial photos now; How it works / Who it's for photos next). Anyone can view
-- a published image; only the server (staff-verified functions with the service role) uploads. Additive.
INSERT INTO storage.buckets (id, name, public) VALUES ('site-media', 'site-media', true) ON CONFLICT (id) DO NOTHING;
