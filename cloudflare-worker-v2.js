// ============================================================================
// LIFEOS1 MESSAGE ROUTER v2.1 - Cloudflare Worker
// Enhanced with Google Voice + Signal support, better error handling, and optimizations
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  supabase: {
    url: "https://mhvcdstgkyplhzjptgfr.supabase.co",
    anonKey: null, // Will be set from env
  },
  signal: {
    apiUrl: null, // Will be set from env
  },
  telegram: {
    apiUrl: "https://api.telegram.org/bot",
  },
  google: {
    gmailApi: "https://www.googleapis.com/gmail/v1/users/me",
  },
  instagram: {
    graphApi: "https://graph.instagram.com",
  },
  whatsapp: {
    graphApi: "https://graph.facebook.com/v17.0",
  },
};

// Platform handlers with metadata
const platforms = {
  telegram: {
    name: "Telegram",
    fetch: fetchTelegramMessages,
    webhook: handleTelegramWebhook,
    send: sendTelegramMessage,
    supportsWebhooks: true,
  },
  messenger: {
    name: "Messenger",
    fetch: fetchMessengerMessages,
    webhook: handleMessengerWebhook,
    send: sendMessengerMessage,
    supportsWebhooks: true,
  },
  instagram: {
    name: "Instagram",
    fetch: fetchInstagramMessages,
    webhook: handleInstagramWebhook,
    send: sendInstagramMessage,
    supportsWebhooks: true,
  },
  "google-voice": {
    name: "Google Voice",
    fetch: fetchGoogleVoiceMessages,
    webhook: handleGoogleVoiceWebhook,
    send: sendGoogleVoiceMessage,
    supportsWebhooks: false,
  },
  signal: {
    name: "Signal",
    fetch: fetchSignalMessages,
    webhook: handleSignalWebhook,
    send: sendSignalMessage,
    supportsWebhooks: true,
  },
  whatsapp: {
    name: "WhatsApp",
    fetch: fetchWhatsAppMessages,
    webhook: handleWhatsAppWebhook,
    send: sendWhatsAppMessage,
    supportsWebhooks: true,
  },
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    // Initialize config with environment variables
    CONFIG.supabase.anonKey = env.SUPABASE_ANON_KEY;
    CONFIG.signal.apiUrl = env.SIGNAL_CLI_API_URL || "http://localhost:8080";
    
    const supabase = createSupabaseClient(env);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers for browser requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight requests
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Platform message sync routes
      if (path.startsWith("/api/sync/") && method === "GET") {
        const platform = path.split("/")[3];
        const userId = url.searchParams.get("user_id");
        if (!userId) throw new Error("user_id required");
        return await syncPlatformMessages(platform, userId, supabase, env);
      }

      // Webhook routes
      if (path.startsWith("/webhook/") && method === "POST") {
        const platform = path.split("/")[2];
        return await handleWebhook(platform, request, supabase, env);
      }

      // Get conversations
      if (path === "/api/conversations" && method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) throw new Error("user_id required");
        return await getConversations(userId, supabase, corsHeaders);
      }

      // Get single conversation
      if (path.match(/^\/api\/conversations\/[^\/]+$/) && method === "GET") {
        const conversationId = path.split("/").pop();
        return await getConversation(conversationId, supabase, corsHeaders);
      }

      // Get messages for conversation
      if (path === "/api/conversations/messages" && method === "GET") {
        const conversationId = url.searchParams.get("conversation_id");
        const limit = parseInt(url.searchParams.get("limit")) || 50;
        const offset = parseInt(url.searchParams.get("offset")) || 0;
        if (!conversationId) throw new Error("conversation_id required");
        return await getConversationMessages(conversationId, limit, offset, supabase, corsHeaders);
      }

      // Send message
      if (path === "/api/messages/send" && method === "POST") {
        const data = await request.json();
        return await sendMessage(data, supabase, env, corsHeaders);
      }

      // Send reply to specific message
      if (path === "/api/messages/reply" && method === "POST") {
        const data = await request.json();
        return await sendReply(data, supabase, env, corsHeaders);
      }

      // Store platform token
      if (path === "/api/tokens/store" && method === "POST") {
        const data = await request.json();
        return await storePlatformToken(data, supabase, corsHeaders);
      }

      // Get user's platform tokens
      if (path === "/api/tokens" && method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) throw new Error("user_id required");
        return await getUserTokens(userId, supabase, corsHeaders);
      }

      // Delete platform token
      if (path === "/api/tokens/delete" && method === "DELETE") {
        const data = await request.json();
        return await deletePlatformToken(data, supabase, corsHeaders);
      }

      // Sync all platforms for user
      if (path === "/api/sync-all" && method === "POST") {
        const { user_id, platforms: platformsToSync } = await request.json();
        return await syncAllPlatforms(user_id, platformsToSync, supabase, env, corsHeaders);
      }

      // Webhook registration endpoint
      if (path === "/api/webhooks/register" && method === "POST") {
        const data = await request.json();
        return await registerWebhook(data, supabase, env, corsHeaders);
      }

      // Health check
      if (path === "/health" && method === "GET") {
        return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ error: "Not found" }), { 
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error) {
      console.error("Handler error:", error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function createSupabaseClient(env) {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(CONFIG.supabase.url, env.SUPABASE_ANON_KEY);
}

// ============================================================================
// TELEGRAM HANDLERS
// ============================================================================

async function fetchTelegramMessages(userId, token, supabase, env) {
  try {
    const response = await fetch(`${CONFIG.telegram.apiUrl}${token}/getUpdates`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();

    if (!data.ok) throw new Error(data.description);

    const messages = [];
    for (const update of data.result) {
      if (update.message && !update.message.from.is_bot) {
        const msg = update.message;
        messages.push({
          platform_message_id: `tg_${msg.message_id}`,
          platform: "telegram",
          platform_conversation_id: msg.chat.id.toString(),
          sender_type: msg.from.id.toString(),
          sender_name: msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : ""),
          content: msg.text || msg.caption || "[Media]",
          created_at: new Date(msg.date * 1000).toISOString(),
          raw_data: msg,
        });
      }
    }

    return messages;
  } catch (error) {
    console.error("Telegram fetch error:", error);
    return [];
  }
}

async function handleTelegramWebhook(request, supabase, env) {
  try {
    const data = await request.json();
    if (!data.message) return new Response("OK");

    const msg = data.message;
    
    // Store incoming message
    await storeIncomingMessage({
      platform: "telegram",
      platform_message_id: `tg_${msg.message_id}`,
      platform_conversation_id: msg.chat.id.toString(),
      sender_name: msg.from.first_name,
      sender_id: msg.from.id.toString(),
      content: msg.text || msg.caption || "[Media]",
      created_at: new Date(msg.date * 1000).toISOString(),
      raw_data: msg,
    }, supabase);

    return new Response("OK");
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("Error", { status: 500 });
  }
}

async function sendTelegramMessage(chatId, token, content, env) {
  const response = await fetch(`${CONFIG.telegram.apiUrl}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: content,
      parse_mode: "HTML",
    }),
  });
  return await response.json();
}

// ============================================================================
// MESSENGER HANDLERS
// ============================================================================

async function fetchMessengerMessages(userId, token, supabase, env) {
  try {
    // Get pages associated with token
    const pagesResponse = await fetch(`https://graph.facebook.com/v17.0/me/accounts?access_token=${token}`);
    const pagesData = await pagesResponse.json();

    const allMessages = [];
    for (const page of pagesData.data || []) {
      const conversationsResponse = await fetch(
        `https://graph.facebook.com/v17.0/${page.id}/conversations?fields=messages.limit(10){id,from,message,created_time}&access_token=${page.access_token}`
      );
      const convData = await conversationsResponse.json();

      for (const conversation of convData.data || []) {
        const messages = conversation.messages?.data || [];
        for (const msg of messages) {
          if (msg.from?.id !== page.id) { // Only store incoming messages
            allMessages.push({
              platform_message_id: `fb_${msg.id}`,
              platform: "messenger",
              platform_conversation_id: conversation.id,
              sender_name: msg.from?.name || "Unknown",
              sender_type: msg.from?.id,
              content: msg.message || "[Media]",
              created_at: msg.created_time,
              raw_data: msg,
            });
          }
        }
      }
    }

    return allMessages;
  } catch (error) {
    console.error("Messenger fetch error:", error);
    return [];
  }
}

async function handleMessengerWebhook(request, supabase, env) {
  try {
    const data = await request.json();

    // Verify webhook
    if (request.url.includes("?hub.verify_token")) {
      const url = new URL(request.url);
      const verifyToken = url.searchParams.get("hub.verify_token");
      if (verifyToken === env.MESSENGER_VERIFY_TOKEN) {
        return new Response(url.searchParams.get("hub.challenge"));
      }
      return new Response("Invalid token", { status: 403 });
    }

    if (data.object !== "page") return new Response("OK");

    for (const entry of data.entry) {
      for (const msgEvent of entry.messaging) {
        if (msgEvent.message && !msgEvent.message.is_echo) {
          await storeIncomingMessage({
            platform: "messenger",
            platform_message_id: `fb_${msgEvent.message.mid}`,
            platform_conversation_id: msgEvent.sender.id,
            sender_name: msgEvent.sender.id,
            sender_id: msgEvent.sender.id,
            content: msgEvent.message.text || "[Media]",
            created_at: new Date(msgEvent.timestamp).toISOString(),
            raw_data: msgEvent,
          }, supabase);
        }
      }
    }

    return new Response("OK");
  } catch (error) {
    console.error("Messenger webhook error:", error);
    return new Response("OK");
  }
}

async function sendMessengerMessage(recipientId, token, content, env) {
  const response = await fetch("https://graph.facebook.com/v17.0/me/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: content },
    }),
  });
  return await response.json();
}

// ============================================================================
// INSTAGRAM HANDLERS
// ============================================================================

async function fetchInstagramMessages(userId, token, supabase, env) {
  try {
    const response = await fetch(
      `${CONFIG.instagram.graphApi}/me/conversations?fields=id,messages{id,from,text,timestamp}&access_token=${token}`
    );
    const data = await response.json();

    const messages = [];
    for (const conv of data.data || []) {
      const msgData = conv.messages || {};
      for (const msg of msgData.data || []) {
        if (msg.from?.username !== "YOUR_INSTAGRAM_ID") {
          messages.push({
            platform_message_id: `ig_${msg.id}`,
            platform: "instagram",
            platform_conversation_id: conv.id,
            sender_name: msg.from?.username || "Unknown",
            sender_type: msg.from?.id,
            content: msg.text || "[Media]",
            created_at: new Date(msg.timestamp * 1000).toISOString(),
            raw_data: msg,
          });
        }
      }
    }

    return messages;
  } catch (error) {
    console.error("Instagram fetch error:", error);
    return [];
  }
}

async function handleInstagramWebhook(request, supabase, env) {
  // Instagram uses the same webhook pattern as Messenger
  return handleMessengerWebhook(request, supabase, env);
}

async function sendInstagramMessage(recipientId, token, content, env) {
  // Instagram uses Messenger API for DMs
  return sendMessengerMessage(recipientId, token, content, env);
}

// ============================================================================
// GOOGLE VOICE HANDLERS (via Gmail API)
// ============================================================================

async function fetchGoogleVoiceMessages(userId, token, supabase, env) {
  try {
    // Search for Google Voice SMS messages
    const response = await fetch(
      `${CONFIG.google.gmailApi}/messages?q=from:txt.voice.google.com OR subject:"SMS"&maxResults=20`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();

    const messages = [];
    for (const msg of data.messages || []) {
      // Check if we already have this message
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("platform_message_id", `gv_${msg.id}`)
        .single();

      if (existing) continue;

      const msgDetails = await fetch(
        `${CONFIG.google.gmailApi}/messages/${msg.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      ).then((r) => r.json());

      // Parse SMS from email
      const headers = msgDetails.payload.headers || [];
      const from = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "";
      
      // Extract phone number from email
      const phoneMatch = from.match(/\+?(\d[\d\s\-\(\)]{8,}\d)/);
      const phoneNumber = phoneMatch ? phoneMatch[0] : from;

      // Extract message body
      let body = msgDetails.snippet || subject;
      if (msgDetails.payload?.parts) {
        const textPart = msgDetails.payload.parts.find(p => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString();
        }
      }

      messages.push({
        platform_message_id: `gv_${msg.id}`,
        platform: "google-voice",
        platform_conversation_id: phoneNumber,
        sender_name: phoneNumber,
        sender_type: "them",
        content: body,
        created_at: new Date(parseInt(msgDetails.internalDate)).toISOString(),
        raw_data: { from, subject, snippet: msgDetails.snippet },
      });
    }

    return messages;
  } catch (error) {
    console.error("Google Voice fetch error:", error);
    return [];
  }
}

async function handleGoogleVoiceWebhook(request, supabase, env) {
  // Google Voice doesn't support webhooks - use polling/sync instead
  // This endpoint can be used to trigger a manual sync
  return new Response(JSON.stringify({ message: "Use /api/sync/google-voice for polling" }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function sendGoogleVoiceMessage(phoneNumber, token, content, env) {
  // Google Voice doesn't have a direct API
  // Would need to use Gmail API to send email to SMS gateway
  // phoneNumber@txt.voice.google.com or similar
  throw new Error("Google Voice sending not implemented - use SMS gateway instead");
}

// ============================================================================
// SIGNAL HANDLERS (via signal-cli-rest-api)
// ============================================================================

async function fetchSignalMessages(userId, signalNumber, supabase, env) {
  try {
    const response = await fetch(`${CONFIG.signal.apiUrl}/v1/receive/${signalNumber}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) throw new Error(`Signal API error: ${response.status}`);
    
    const data = await response.json();

    const messages = [];
    for (const message of data || []) {
      messages.push({
        platform_message_id: `signal_${message.id || message.timestamp}`,
        platform: "signal",
        platform_conversation_id: message.source,
        sender_name: message.sourceName || message.source,
        sender_type: message.source === signalNumber ? "me" : "them",
        content: message.body || message.message || "[Media]",
        created_at: new Date(message.timestamp).toISOString(),
        raw_data: message,
      });
    }

    return messages;
  } catch (error) {
    console.error("Signal fetch error:", error);
    return [];
  }
}

async function handleSignalWebhook(request, supabase, env) {
  try {
    const data = await request.json();
    
    await storeIncomingMessage({
      platform: "signal",
      platform_message_id: `signal_${data.id || data.timestamp}`,
      platform_conversation_id: data.source,
      sender_name: data.sourceName || data.source,
      sender_id: data.source,
      content: data.body || data.message || "[Media]",
      created_at: new Date(data.timestamp).toISOString(),
      raw_data: data,
    }, supabase);

    return new Response("OK");
  } catch (error) {
    console.error("Signal webhook error:", error);
    return new Response("OK");
  }
}

async function sendSignalMessage(recipientNumber, signalNumber, content, env) {
  const response = await fetch(`${CONFIG.signal.apiUrl}/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      number: signalNumber,
      recipients: [recipientNumber],
      message: content,
    }),
  });
  return await response.json();
}

// ============================================================================
// WHATSAPP HANDLERS
// ============================================================================

async function fetchWhatsAppMessages(userId, token, supabase, env) {
  try {
    // WhatsApp Business API uses webhooks primarily
    // Get phone number ID from token
    const response = await fetch(`${CONFIG.whatsapp.graphApi}/me/phone_numbers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    
    // WhatsApp doesn't support message polling via API
    // Messages are delivered via webhooks only
    return [];
  } catch (error) {
    console.error("WhatsApp fetch error:", error);
    return [];
  }
}

async function handleWhatsAppWebhook(request, supabase, env) {
  try {
    const data = await request.json();

    // Verify webhook
    if (request.url.includes("?hub.verify_token")) {
      const url = new URL(request.url);
      const verifyToken = url.searchParams.get("hub.verify_token");
      if (verifyToken === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(url.searchParams.get("hub.challenge"));
      }
      return new Response("Invalid token", { status: 403 });
    }

    if (data.object !== "whatsapp_business_account") return new Response("OK");

    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        if (change.value?.messages) {
          for (const msg of change.value.messages) {
            await storeIncomingMessage({
              platform: "whatsapp",
              platform_message_id: `wa_${msg.id}`,
              platform_conversation_id: msg.from,
              sender_name: msg.from,
              sender_id: msg.from,
              content: msg.text?.body || msg.type || "[Media]",
              created_at: new Date(msg.timestamp * 1000).toISOString(),
              raw_data: msg,
            }, supabase);
          }
        }
      }
    }

    return new Response("OK");
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return new Response("OK");
  }
}

async function sendWhatsAppMessage(recipientId, token, content, env, phoneNumberId) {
  const response = await fetch(`${CONFIG.whatsapp.graphApi}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipientId,
      type: "text",
      text: { body: content },
    }),
  });
  return await response.json();
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

async function storeIncomingMessage(messageData, supabase) {
  try {
    // Get or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("platform", messageData.platform)
      .eq("platform_conversation_id", messageData.platform_conversation_id)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          platform: messageData.platform,
          platform_conversation_id: messageData.platform_conversation_id,
          contact_name: messageData.sender_name,
          last_message_at: messageData.created_at,
        })
        .select()
        .single();
      conversation = newConv;
    } else {
      // Update last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: messageData.created_at })
        .eq("id", conversation.id);
    }

    // Store message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      platform_message_id: messageData.platform_message_id,
      platform: messageData.platform,
      sender_type: "them",
      sender_name: messageData.sender_name,
      content: messageData.content,
      created_at: messageData.created_at,
      raw_data: messageData.raw_data,
    });

    // Trigger any automations/webhooks
    await triggerMessageWebhook(conversation.id, messageData, supabase);

    return true;
  } catch (error) {
    console.error("Store message error:", error);
    return false;
  }
}

async function triggerMessageWebhook(conversationId, messageData, supabase) {
  // This could call external webhooks for automation
  // For now, just log
  console.log(`New message in conversation ${conversationId}`);
}

async function syncPlatformMessages(platform, userId, supabase, env) {
  const handler = platforms[platform];
  if (!handler) {
    return new Response(JSON.stringify({ error: "Platform not found" }), { 
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get token from Supabase
    const { data: tokenData, error } = await supabase
      .from("platform_tokens")
      .select("access_token, refresh_token, platform_user_id, metadata")
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("is_active", true)
      .single();

    if (error) throw new Error(`No token found for ${platform}: ${error.message}`);
    if (!tokenData.access_token && !tokenData.platform_user_id) {
      throw new Error(`No valid credentials for ${platform}`);
    }

    // Refresh token if needed
    let accessToken = tokenData.access_token;
    if (tokenData.refresh_token && platform === "google-voice") {
      accessToken = await refreshGoogleToken(tokenData.refresh_token, env);
      if (accessToken) {
        await supabase
          .from("platform_tokens")
          .update({ access_token: accessToken, updated_at: new Date().toISOString() })
          .eq("id", tokenData.id);
      }
    }

    const messages = await handler.fetch(
      userId, 
      accessToken || tokenData.platform_user_id, 
      supabase, 
      env
    );

    let stored = 0;
    for (const msg of messages) {
      try {
        await storeIncomingMessage(msg, supabase);
        stored++;
      } catch (e) {
        if (!e.message?.includes("duplicate")) {
          console.error("Error storing message:", e);
        }
      }
    }

    // Update last_sync_at
    await supabase
      .from("platform_tokens")
      .update({ last_sync_at: new Date().toISOString(), sync_status: "success" })
      .eq("id", tokenData.id);

    return new Response(JSON.stringify({ 
      success: true, 
      count: messages.length,
      stored,
      platform,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    
    // Update sync status to error
    await supabase
      .from("platform_tokens")
      .update({ sync_status: "error", sync_error: error.message })
      .eq("user_id", userId)
      .eq("platform", platform);
    
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function syncAllPlatforms(userId, platformList, supabase, env, corsHeaders) {
  const results = {};
  const platformsToSync = platformList || Object.keys(platforms);
  
  for (const platform of platformsToSync) {
    try {
      const response = await syncPlatformMessages(platform, userId, supabase, env);
      const data = await response.json();
      results[platform] = data;
    } catch (error) {
      results[platform] = { error: error.message };
    }
  }
  
  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleWebhook(platform, request, supabase, env) {
  const handler = platforms[platform];
  if (!handler || !handler.webhook) {
    return new Response(JSON.stringify({ error: "Platform not found or webhook not supported" }), { 
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return await handler.webhook(request, supabase, env);
}

async function getConversations(userId, supabase, corsHeaders) {
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      last_message:messages!conversations_last_message_id_fkey(content, created_at, sender_type),
      unread_count:messages(count)
    `)
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  // Add unread count
  const conversationsWithUnread = await Promise.all((data || []).map(async (conv) => {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .eq("is_read", false)
      .eq("sender_type", "them");
    
    return { ...conv, unread_count: count || 0 };
  }));

  return new Response(JSON.stringify(conversationsWithUnread), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function getConversation(conversationId, supabase, corsHeaders) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (error) throw error;

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function getConversationMessages(conversationId, limit, offset, supabase, corsHeaders) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Mark messages as read
  await supabase
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("is_read", false)
    .eq("sender_type", "them");

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function sendMessage(data, supabase, env, corsHeaders) {
  const { user_id, conversation_id, platform, content, reply_to_id } = data;

  // Get conversation details
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("platform, platform_conversation_id, contact_id")
    .eq("id", conversation_id)
    .single();

  if (convError) throw new Error("Conversation not found");

  // Get platform token
  const { data: tokenData, error: tokenError } = await supabase
    .from("platform_tokens")
    .select("access_token, platform_user_id, metadata")
    .eq("user_id", user_id)
    .eq("platform", conversation.platform)
    .eq("is_active", true)
    .single();

  if (tokenError) throw new Error(`No token found for ${conversation.platform}`);

  // Send via platform
  const handler = platforms[conversation.platform];
  if (!handler || !handler.send) throw new Error(`Sending not supported for ${conversation.platform}`);

  let sendResult;
  const recipientId = conversation.platform_conversation_id;
  
  switch (conversation.platform) {
    case "telegram":
      sendResult = await handler.send(recipientId, tokenData.access_token, content, env);
      break;
    case "whatsapp":
      sendResult = await handler.send(recipientId, tokenData.access_token, content, env, tokenData.metadata?.phone_number_id);
      break;
    case "signal":
      sendResult = await handler.send(recipientId, tokenData.platform_user_id, content, env);
      break;
    default:
      sendResult = await handler.send(recipientId, tokenData.access_token, content, env);
  }

  // Store sent message
  const { data: sentMessage } = await supabase
    .from("messages")
    .insert({
      conversation_id,
      platform: conversation.platform,
      sender_type: "me",
      content: content,
      created_at: new Date().toISOString(),
      status: "sent",
      platform_response: sendResult,
    })
    .select()
    .single();

  // Update conversation last_message_at
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation_id);

  // Add to message queue for processing
  await supabase.from("message_queue").insert({
    message_id: sentMessage.id,
    conversation_id,
    platform: conversation.platform,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ success: true, message: sentMessage }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function sendReply(data, supabase, env, corsHeaders) {
  const { user_id, message_id, content } = data;

  // Get original message to find conversation
  const { data: originalMessage, error: msgError } = await supabase
    .from("messages")
    .select("conversation_id")
    .eq("id", message_id)
    .single();

  if (msgError) throw new Error("Original message not found");

  return await sendMessage({
    user_id,
    conversation_id: originalMessage.conversation_id,
    platform: null, // Will be derived from conversation
    content,
    reply_to_id: message_id,
  }, supabase, env, corsHeaders);
}

async function storePlatformToken(data, supabase, corsHeaders) {
  const { user_id, platform, access_token, refresh_token, platform_user_id, metadata } = data;

  // Check if token exists
  const { data: existing } = await supabase
    .from("platform_tokens")
    .select("id")
    .eq("user_id", user_id)
    .eq("platform", platform)
    .single();

  const tokenData = {
    user_id,
    platform,
    access_token,
    refresh_token,
    platform_user_id,
    metadata,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    result = await supabase
      .from("platform_tokens")
      .update(tokenData)
      .eq("id", existing.id);
  } else {
    tokenData.created_at = new Date().toISOString();
    result = await supabase
      .from("platform_tokens")
      .insert(tokenData);
  }

  if (result.error) throw result.error;

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function getUserTokens(userId, supabase, corsHeaders) {
  const { data, error } = await supabase
    .from("platform_tokens")
    .select("platform, platform_user_id, is_active, last_sync_at, sync_status, created_at, updated_at")
    .eq("user_id", userId)
    .order("platform");

  if (error) throw error;

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function deletePlatformToken(data, supabase, corsHeaders) {
  const { user_id, platform } = data;

  const { error } = await supabase
    .from("platform_tokens")
    .delete()
    .eq("user_id", user_id)
    .eq("platform", platform);

  if (error) throw error;

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function registerWebhook(data, supabase, env, corsHeaders) {
  const { platform, webhook_url, events } = data;

  const { error } = await supabase
    .from("webhook_subscriptions")
    .insert({
      platform,
      webhook_url,
      events: events || ["message.received", "message.sent"],
      is_active: true,
      created_at: new Date().toISOString(),
    });

  if (error) throw error;

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function refreshGoogleToken(refreshToken, env) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}