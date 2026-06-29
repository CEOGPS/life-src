-- ============================================================================
-- LIFEOS1 MESSAGES SCHEMA
-- ============================================================================

-- 1. Platform Tokens (secure credential storage)
CREATE TABLE IF NOT EXISTS platform_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'telegram', 'instagram', 'messenger', 'whatsapp', 'signal', 'sms', 'snapchat', 'tiktok'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  platform_user_id TEXT, -- external platform ID
  platform_username TEXT,
  metadata JSONB, -- store additional platform-specific data
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_user_id)
);

-- 2. Conversations (thread = unified across platforms for same contact)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_initials TEXT,
  is_group BOOLEAN DEFAULT false,
  platforms TEXT[] DEFAULT '{}', -- ['telegram', 'messenger', 'sms']
  primary_platform TEXT, -- which platform initiated
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  metadata JSONB, -- group info, etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Messages (core message storage)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- which platform this came from
  platform_message_id TEXT, -- external message ID for deduplication
  sender_type TEXT NOT NULL CHECK (sender_type IN ('me', 'them')), -- who sent it
  sender_name TEXT,
  sender_avatar_url TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'file', 'voice'
  attachments JSONB, -- [{url, type, name}]
  read BOOLEAN DEFAULT false,
  delivered BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'sent', -- 'sending', 'sent', 'delivered', 'read', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id, platform, platform_message_id)
);

-- 4. Message Queue (for retry logic & queued sends)
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  status TEXT DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed'
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Platform Webhooks (track incoming webhooks for debugging)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  platform TEXT NOT NULL,
  webhook_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_platform_tokens_user_id ON platform_tokens(user_id);
CREATE INDEX idx_platform_tokens_platform ON platform_tokens(user_id, platform);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX idx_conversations_last_message ON conversations(user_id, last_message_at DESC);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_platform ON messages(user_id, platform);
CREATE INDEX idx_messages_created_at ON messages(user_id, created_at DESC);
CREATE INDEX idx_messages_platform_id ON messages(platform_message_id);

CREATE INDEX idx_message_queue_user_id ON message_queue(user_id);
CREATE INDEX idx_message_queue_status ON message_queue(status, scheduled_for);

CREATE INDEX idx_webhook_logs_platform ON webhook_logs(platform, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Users only see their own data
-- ============================================================================

ALTER TABLE platform_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own tokens"
  ON platform_tokens FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own messages"
  ON messages FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own queue"
  ON message_queue FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE platform_tokens ADD COLUMN account_email TEXT;
ALTER TABLE platform_tokens ADD COLUMN account_name TEXT;
ALTER TABLE platform_tokens ADD COLUMN is_primary BOOLEAN DEFAULT false;

-- ============================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Update conversation's last_message_at when new message arrives
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Auto-decrypt tokens (basic - consider pgcrypto for production)
CREATE OR REPLACE FUNCTION get_platform_token(user_uuid UUID, platform_name TEXT)
RETURNS TEXT AS $$
  SELECT access_token FROM platform_tokens
  WHERE user_id = user_uuid AND platform = platform_name AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
