import React, { FormEvent, useEffect, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import {
  createConversation,
  getConversationMessages,
  getConversations,
  searchUsers,
  sendMessage,
} from "../services/api";
import { ConversationSummary, PrivateMessage, SearchUser } from "../types";
import { useAuth } from "../context/AuthContext";

export default function MessagingCenter() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<SearchUser[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<SearchUser | null>(
    null,
  );
  const [searchingUsers, setSearchingUsers] = useState(false);

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

  useEffect(() => {
    const query = recipientQuery.trim();
    if (query.length < 2) {
      setRecipientResults([]);
      setSearchingUsers(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchingUsers(true);
      searchUsers(query)
        .then(setRecipientResults)
        .catch(() => setRecipientResults([]))
        .finally(() => setSearchingUsers(false));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [recipientQuery]);

  async function onCreateConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecipient) {
      setError("Select a recipient from search results first.");
      return;
    }

    const conversation = await createConversation(selectedRecipient.id);
    setActiveConversationId(conversation.id);
    event.currentTarget.reset();
    setRecipientQuery("");
    setRecipientResults([]);
    setSelectedRecipient(null);
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
        <Card className="border-white/15 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10">
          <h2 className="text-lg font-semibold text-white">
            Start conversation
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Search by name or email.
          </p>
          <form className="mt-3 space-y-2" onSubmit={onCreateConversation}>
            <input
              value={recipientQuery}
              onChange={(event) => {
                setRecipientQuery(event.target.value);
                setSelectedRecipient(null);
              }}
              placeholder="Type at least 2 characters"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />

            {selectedRecipient ? (
              <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs text-emerald-100">
                  Recipient:{" "}
                  <span className="font-semibold">
                    {selectedRecipient.name}
                  </span>
                </p>
                <p className="text-[11px] text-emerald-200/90">
                  {selectedRecipient.email}
                </p>
              </div>
            ) : null}

            {searchingUsers ? (
              <p className="text-xs text-slate-400">Searching users…</p>
            ) : null}

            {!searchingUsers && recipientResults.length > 0 ? (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-2">
                {recipientResults.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecipient(candidate);
                      setRecipientQuery(candidate.name);
                      setRecipientResults([]);
                    }}
                    className="block w-full rounded-xl border border-white/10 px-3 py-2 text-left transition hover:border-violet-300/40 hover:bg-white/5"
                  >
                    <p className="text-sm text-white">{candidate.name}</p>
                    <p className="text-xs text-slate-400">{candidate.email}</p>
                  </button>
                ))}
              </div>
            ) : null}

            <Button type="submit" variant="secondary">
              Create
            </Button>
          </form>
        </Card>

        <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
          <div className="mt-3 space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversationId(conversation.id)}
                className="block w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-left transition hover:border-violet-400/50"
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
        <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
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
                    className="rounded-xl border border-white/10 bg-slate-950 p-3"
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
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
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
