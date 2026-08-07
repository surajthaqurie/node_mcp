-- Migration 003: Seed initial diverse dummy users for testing and pagination

INSERT INTO users (name, email, role)
VALUES
  ('Alice Smith', 'alice@example.com', 'admin'),
  ('Bob Jones', 'bob@example.com', 'user'),
  ('Charlie Brown', 'charlie@example.com', 'user'),
  ('Sophia Chen', 'sophia.chen@techcorp.io', 'lead_developer'),
  ('Liam W. Neeson', 'liam.neeson@actiondev.com', 'admin'),
  ('Emma Watson', 'emma.watson@designhub.org', 'ui_ux_designer'),
  ('Noah Miller', 'noah.miller@cloudops.net', 'devops_engineer'),
  ('Olivia Rodrigo', 'olivia.r@soundcode.io', 'frontend_developer'),
  ('Ethan Hunt', 'ethan.hunt@secops.agency', 'security_engineer'),
  ('Ava Martinez', 'ava.martinez@dataflow.ai', 'data_scientist'),
  ('Lucas Scott', 'lucas.scott@productlab.co', 'product_manager'),
  ('Mia Hamm', 'mia.hamm@qaauto.io', 'qa_lead'),
  ('Oliver Queen', 'oliver.queen@startech.com', 'cto'),
  ('Isabella Garcia', 'isabella.g@backendhub.dev', 'backend_developer'),
  ('James Bond', 'agent007@mi6services.gov', 'admin'),
  ('Charlotte Bronte', 'charlotte.b@docs-writer.org', 'tech_writer'),
  ('Benjamin Button', 'benjamin.b@chronos.io', 'fullstack_developer'),
  ('Amelia Earhart', 'amelia.e@skynetworks.net', 'system_architect'),
  ('Alexander Hamilton', 'alex.h@fintech-apps.com', 'financial_analyst'),
  ('Harper Lee', 'harper.lee@contentstudio.io', 'content_strategist'),
  ('Daniel Craig', 'daniel.craig@cinema-tech.org', 'media_engineer'),
  ('Evelyn Vance', 'evelyn.vance@quantumcorp.ai', 'ai_researcher'),
  ('Henry Cavill', 'henry.cavill@gamerdev.net', 'game_developer')
ON CONFLICT (email) DO NOTHING;
