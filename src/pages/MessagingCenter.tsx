import React, { FormEvent, useEffect, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import {
  createConversation,
  getConversationMessages,
  getConversations,
  sendMessage,
} from "../services/api";
import { ConversationSummary, PrivateMessage } from "../types";
import { useAuth } from "../context/AuthContext";

export default function MessagingCenter() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadConversations() {
    try {
      setError(null);
      const list = await getConversations();
      setConversations(list);
    } catch {
      setError("Failed to load conversations.");
    }
  }

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (!activeConversationId) return;
    getConversationMessages(activeConversationId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeConversationId]);

  async function onCreateConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipientId = String(form.get("recipientId") || "");
    const conversation = await createConversation(recipientId);
    setActiveConversationId(conversation.id);
    event.currentTarget.reset();
    await loadConversations();
  }

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversationId) return;
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "");

    await sendMessage(activeConversationId, body);
    event.currentTarget.reset();
    const list = await getConversationMessages(activeConversationId);
    setMessages(list);
  }

  if (!user) {
    return (
      <Card>
        <h1 className="text-2xl font-bold text-white">Messaging Section</h1>
        <p className="mt-2 text-slate-300">
          Login to send private messages and manage conversations.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-4">
        <Card>
          <h2 className="text-lg font-semibold text-white">
            Start conversation
          </h2>
          <p className="mt-1 text-xs text-slate-400">Enter recipient user ID</p>
          <form className="mt-3 space-y-2" onSubmit={onCreateConversation}>
            <input
              name="recipientId"
              required
              placeholder="Recipient user ID"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <Button type="submit" variant="secondary">
              Create
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
          <div className="mt-3 space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversationId(conversation.id)}
                className="block w-full rounded-lg border border-white/10 bg-slate-950 p-3 text-left transition hover:border-violet-400/50"
              >
                <p className="text-sm text-white">
                  {conversation.participants
                    .map((participant) => participant.name)
                    .join(", ")}
                </p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                  {conversation.lastMessage?.body || "No messages yet"}
                </p>
              </button>
            ))}
            {conversations.length === 0 ? (
              <p className="text-xs text-slate-400">No conversations yet.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="lg:col-span-2">
        <Card>
          <h1 className="text-2xl font-bold text-white">Messaging Section</h1>
          <p className="mt-1 text-sm text-slate-300">
            Private direct messaging between members.
          </p>

          {activeConversationId ? (
            <>
              <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-lg border border-white/10 bg-slate-950 p-3"
                  >
                    <p className="text-sm text-slate-200">{message.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {message.sender.name}
                    </p>
                  </div>
                ))}
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-400">No messages yet.</p>
                ) : null}
              </div>

              <form className="mt-4 flex gap-2" onSubmit={onSend}>
                <input
                  name="body"
                  required
                  placeholder="Type message"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                />
                <Button type="submit">Send</Button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-slate-300">
              Select a conversation to view and send messages.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
