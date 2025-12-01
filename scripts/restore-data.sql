-- First insert the audio asset (needed for video foreign keys)
INSERT INTO assets (id, campaign_id, type, filename, original_filename, s3_url, s3_key, file_size, mime_type, created_by)
VALUES
  ('c2c44da4-4589-429f-9a74-282c58ae7f4f', 'campaign-carly-hummingbird-tour', 'AUDIO', 'bfd7a494-ebdc-4c1d-a448-68a75d9e6aaf.mp3', 'the way that I have a list of 100 other things.mp3', 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/bfd7a494-ebdc-4c1d-a448-68a75d9e6aaf.mp3', 'campaigns/campaign-carly-hummingbird-tour/bfd7a494-ebdc-4c1d-a448-68a75d9e6aaf.mp3', 972360, 'audio/mpeg', 'abd58942-1390-47ac-80b6-5938bafb9e0d')
ON CONFLICT (id) DO NOTHING;

-- Insert image assets
INSERT INTO assets (id, campaign_id, type, filename, original_filename, s3_url, s3_key, file_size, mime_type, created_by)
VALUES
  ('98ac2967-d873-4192-877f-6fbcc6b759f7', 'campaign-carly-hummingbird-tour', 'IMAGE', '606d69f1-bdbf-4f0b-a128-bb80bbf4fc15.webp', 'CP-photo-the-29-black-tour-tee-front_Carly-Pearce.webp', 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/606d69f1-bdbf-4f0b-a128-bb80bbf4fc15.webp', 'campaigns/campaign-carly-hummingbird-tour/606d69f1-bdbf-4f0b-a128-bb80bbf4fc15.webp', 52070, 'image/webp', 'abd58942-1390-47ac-80b6-5938bafb9e0d'),
  ('060fb41c-8e40-43c0-b3cb-02373867db6c', 'campaign-carly-hummingbird-tour', 'IMAGE', '53d6e1e7-7e45-428e-a7a5-d3b10a0a3572.webp', 'CP-TRUCK-ON-FIRE-TEE-FRONT.webp', 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/53d6e1e7-7e45-428e-a7a5-d3b10a0a3572.webp', 'campaigns/campaign-carly-hummingbird-tour/53d6e1e7-7e45-428e-a7a5-d3b10a0a3572.webp', 77676, 'image/webp', 'abd58942-1390-47ac-80b6-5938bafb9e0d'),
  ('a1b82ba6-fbb1-47b7-b5bb-cf1618b89797', 'campaign-carly-hummingbird-tour', 'IMAGE', 'aceafb17-f20d-4b22-bebb-6167f394b086.webp', 'CP-HUMMINGBIRD-CREWNECK-SAND.webp', 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/aceafb17-f20d-4b22-bebb-6167f394b086.webp', 'campaigns/campaign-carly-hummingbird-tour/aceafb17-f20d-4b22-bebb-6167f394b086.webp', 74414, 'image/webp', 'abd58942-1390-47ac-80b6-5938bafb9e0d'),
  ('ea9b6123-ac3e-4828-897c-6c974d2f278b', 'campaign-carly-hummingbird-tour', 'GOODS', '0ec09075-cf26-4dea-83ba-08183feab2ee.webp', 'CP-photo-the-29-black-tour-tee-front_Carly-Pearce.webp', 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/0ec09075-cf26-4dea-83ba-08183feab2ee.webp', 'campaigns/campaign-carly-hummingbird-tour/0ec09075-cf26-4dea-83ba-08183feab2ee.webp', 52070, 'image/webp', 'abd58942-1390-47ac-80b6-5938bafb9e0d')
ON CONFLICT (id) DO NOTHING;

-- Insert video generations with output_url
INSERT INTO video_generations (id, campaign_id, prompt, duration_seconds, aspect_ratio, status, progress, output_url, created_by, audio_asset_id)
VALUES
  ('e6ac1fbc-c31e-48ca-8886-9c759c60635f', 'campaign-carly-hummingbird-tour', 'Compose video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/2fb4e458-8cc1-4f14-8bbf-13adbde743bf.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('20f332d5-a47c-4513-838d-70da0dbbb211', 'campaign-carly-hummingbird-tour', 'Compose video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/da11714e-655d-4834-b067-0a553f6039d4.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('79d263b7-c031-46d6-9e51-978a94589ece', 'campaign-carly-hummingbird-tour', 'Compose video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/c0ee75e6-cf35-4475-9d8f-51d922bb0f81.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('3a6b6c91-4a55-4a09-9418-86568805bd9d', 'campaign-carly-hummingbird-tour', 'Truck video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/43775884-d4d8-4956-b8be-0a7845805b44.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('0dfca499-ab5b-4726-add8-a90285cd729f', 'campaign-carly-hummingbird-tour', 'Country video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/4c2bd021-3460-4111-8eeb-a85714479de4.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('9c90b9d1-0008-4515-bf4c-0a25fd7ab99f', 'campaign-carly-hummingbird-tour', 'Truck sunset video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/70b82623-97ac-4ade-badc-3f46d49afea8.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('3472bef4-b38a-4488-8815-7befd7074a8c', 'campaign-carly-hummingbird-tour', 'Rustic scene video', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/72afa814-70c9-429e-8a66-392fc143f86c.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f')
ON CONFLICT (id) DO NOTHING;

-- Insert video generations with composed_output_url
INSERT INTO video_generations (id, campaign_id, prompt, duration_seconds, aspect_ratio, status, progress, composed_output_url, created_by, audio_asset_id)
VALUES
  ('compose-1764493716471', 'campaign-carly-hummingbird-tour', 'Compose video generation', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764493716471/output.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('compose-1764497159248', 'campaign-carly-hummingbird-tour', 'Compose video generation', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764497159248/output.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('compose-1764507640204', 'campaign-carly-hummingbird-tour', 'Compose video generation', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764507640204/output.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f'),
  ('compose-1764509486319', 'campaign-carly-hummingbird-tour', 'Compose video generation', 15, '9:16', 'COMPLETED', 100, 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764509486319/output.mp4', 'abd58942-1390-47ac-80b6-5938bafb9e0d', 'c2c44da4-4589-429f-9a74-282c58ae7f4f')
ON CONFLICT (id) DO NOTHING;
