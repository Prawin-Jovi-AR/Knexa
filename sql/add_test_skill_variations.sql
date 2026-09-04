-- Add distinct skills to the 20 existing test profiles.
-- Run after knexa_complete_setup.sql if the main setup already succeeded.

insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values
('00000000-0000-0000-0000-000000000001','Prototyping','Design','Advanced',85,4),
('00000000-0000-0000-0000-000000000002','API Development','Programming','Advanced',84,5),
('00000000-0000-0000-0000-000000000003','Research Methods','Data','Advanced',79,4),
('00000000-0000-0000-0000-000000000004','Node.js','Programming','Advanced',88,5),
('00000000-0000-0000-0000-000000000005','Editing','Communication','Expert',91,7),
('00000000-0000-0000-0000-000000000006','3D Printing','Technology','Intermediate',74,3),
('00000000-0000-0000-0000-000000000007','Usability Testing','Design','Advanced',86,5),
('00000000-0000-0000-0000-000000000008','Cloud Architecture','Technology','Expert',90,6),
('00000000-0000-0000-0000-000000000009','Digital Art','Design','Advanced',82,5),
('00000000-0000-0000-0000-000000000010','Business Intelligence','Business','Expert',93,8),
('00000000-0000-0000-0000-000000000011','Conversation Practice','Languages','Advanced',87,6),
('00000000-0000-0000-0000-000000000012','Mobile UI','Programming','Advanced',85,4),
('00000000-0000-0000-0000-000000000013','Network Security','Technology','Intermediate',72,3),
('00000000-0000-0000-0000-000000000014','Documentary Editing','Media','Advanced',81,5),
('00000000-0000-0000-0000-000000000015','Technical Writing','Communication','Expert',92,9),
('00000000-0000-0000-0000-000000000016','CI/CD','Technology','Advanced',86,5),
('00000000-0000-0000-0000-000000000017','Digital Sculpting','Art','Intermediate',69,2),
('00000000-0000-0000-0000-000000000018','Dashboard Design','Data','Advanced',83,4),
('00000000-0000-0000-0000-000000000019','Market Research','Business','Advanced',84,6),
('00000000-0000-0000-0000-000000000020','Frontend Architecture','Programming','Advanced',91,5)
on conflict (user_id, skill_name) do nothing;

insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values
('00000000-0000-0000-0000-000000000001','Service Design','Design','Map better end-to-end experiences'),
('00000000-0000-0000-0000-000000000002','Jazz Piano','Music','Learn improvisation and rhythm'),
('00000000-0000-0000-0000-000000000003','Climate Science','Science','Understand practical climate solutions'),
('00000000-0000-0000-0000-000000000004','Game Development','Technology','Design a small playable world'),
('00000000-0000-0000-0000-000000000005','Podcasting','Media','Tell thoughtful long-form stories'),
('00000000-0000-0000-0000-000000000006','Electronics','Technology','Build useful physical prototypes'),
('00000000-0000-0000-0000-000000000007','Information Architecture','Design','Organize complex content clearly'),
('00000000-0000-0000-0000-000000000008','Team Coaching','Business','Help teams work more effectively'),
('00000000-0000-0000-0000-000000000009','Ceramics','Art','Practice a hands-on creative craft'),
('00000000-0000-0000-0000-000000000010','Economics','Business','Connect analysis to real decisions'),
('00000000-0000-0000-0000-000000000011','Japanese','Languages','Explore a new writing system'),
('00000000-0000-0000-0000-000000000012','Motion Design','Media','Make interfaces feel more expressive'),
('00000000-0000-0000-0000-000000000013','Ethical Hacking','Technology','Learn defensive security methods'),
('00000000-0000-0000-0000-000000000014','Color Grading','Media','Improve visual mood and continuity'),
('00000000-0000-0000-0000-000000000015','Public Policy','Society','Understand how research becomes action'),
('00000000-0000-0000-0000-000000000016','Infrastructure as Code','Technology','Make deployments repeatable'),
('00000000-0000-0000-0000-000000000017','Animation','Art','Bring characters to life'),
('00000000-0000-0000-0000-000000000018','Statistics','Data','Make stronger analytical conclusions'),
('00000000-0000-0000-0000-000000000019','Negotiation','Business','Build better partnership outcomes'),
('00000000-0000-0000-0000-000000000020','Natural Language Processing','Data','Explore language-focused AI')
on conflict (user_id, skill_name) do nothing;
