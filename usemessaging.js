// useMessaging.js - Custom hook for LifeOS1 Messages
// Handles all backend communication for messaging functionality

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useMessaging(userId) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ============================================================================
  // FETCH CONVERSATIONS
  // ============================================================================

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ============================================================================
  // FETCH MESSAGES FOR CONVERSATION
  // ============================================================================

  const fetchConversationMessages = useCallback(async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages((prev) => ({
        ...prev,
        [conversationId]: data || [],
      }));

      return data || [];
    } catch (err) {
      setError(err.message);
      console.error("Error fetching messages:", err);
      return [];
    }
  }, []);

  // ============================================================================
  // SEND MESSAGE
  // ============================================================================

  const sendMessage = useCallback(
    async (conversationId, platform, content) => {
      try {
        // 1. Insert message into message_queue
        const { data: queuedMsg, error: queueError } = await supabase
          .from("message_queue")
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            platform,
            content,
            status: "pending",
          })
          .select()
          .single();

        if (queueError) throw queueError;

        // 2. Optimistically add to UI
        const newMessage = {
          id: queuedMsg.id,
          conversation_id: conversationId,
          platform,
          sender_type: "me",
          content,
          status: "sending",
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), newMessage],
        }));

        // 3. Send to backend worker (async)
        try {
          await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              conversation_id: conversationId,
              platform,
              content,
            }),
          });
        } catch (sendErr) {
          console.error("Error sending message:", sendErr);
          // Mark as failed in queue
          await supabase
            .from("message_queue")
            .update({ status: "failed", error_message: sendErr.message })
            .eq("id", queuedMsg.id);
        }

        return queuedMsg;
      } catch (err) {
        setError(err.message);
        console.error("Error sending message:", err);
        throw err;
      }
    },
    [userId]
  );

  // ============================================================================
  // SYNC PLATFORM MESSAGES
  // ============================================================================

  const syncPlatform = useCallback(async (platform) => {
    try {
      const response = await fetch(`/api/sync/${platform}?user_id=${userId}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      // Refetch conversations after sync
      await fetchConversations();

      return result;
    } catch (err) {
      setError(err.message);
      console.error(`Error syncing ${platform}:`, err);
      throw err;
    }
  }, [userId, fetchConversations]);

  // ============================================================================
  // STORE PLATFORM TOKEN
  // ============================================================================

  const storePlatformToken = useCallback(
    async (platform, accessToken, refreshToken, platformUserId) => {
      try {
        const response = await fetch("/api/tokens/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            platform,
            access_token: accessToken,
            refresh_token: refreshToken,
            platform_user_id: platformUserId,
          }),
        });

        if (!response.ok) throw new Error("Failed to store token");

        return await response.json();
      } catch (err) {
        setError(err.message);
        console.error("Error storing token:", err);
        throw err;
      }
    },
    [userId]
  );

  // ============================================================================
  // SUBSCRIBE TO REALTIME UPDATES
  // ============================================================================

  useEffect(() => {
    if (!userId) return;

    // Fetch initial conversations
    fetchConversations();

    // Subscribe to new messages
    const messageSubscription = supabase
      .from("messages")
      .on("*", (payload) => {
        if (payload.new) {
          const conversationId = payload.new.conversation_id;
          setMessages((prev) => ({
            ...prev,
            [conversationId]: [
              ...(prev[conversationId] || []),
              payload.new,
            ],
          }));

          // Update conversation last_message_at
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? { ...conv, last_message_at: payload.new.created_at }
                : conv
            )
          );
        }
      })
      .subscribe();

    // Subscribe to conversation updates
    const convSubscription = supabase
      .from("conversations")
      .on("*", (payload) => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
      convSubscription.unsubscribe();
    };
  }, [userId, fetchConversations]);

  return {
    conversations,
    messages,
    loading,
    error,
    fetchConversationMessages,
    sendMessage,
    syncPlatform,
    storePlatformToken,
    refreshConversations: fetchConversations,
  };
}

// ============================================================================
// EXPORT HELPER TO FORMAT CONVERSATIONS FOR UI
// ============================================================================

export function formatConversationForUI(conversation, latestMessage) {
  return {
    id: conversation.id,
    initials: conversation.contact_initials || "?",
    name: conversation.contact_name,
    preview: latestMessage?.content || "No messages",
    time: formatTime(latestMessage?.created_at || conversation.created_at),
    unread: conversation.unread_count || 0,
    platforms: conversation.platforms || [],
    tag: "Direct", // or fetch from contacts
    isOnline: false, // you'll need to track this separately
    lastSeen: "now",
  };
}

function formatTime(timestamp) {
  if (!timestamp) return "now";

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString();
}
