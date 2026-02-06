// ─── Chat Drawer ───────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../hooks/useGameState';

export default function ChatDrawer() {
  const show = useGameStore((s) => s.showChat);
  const toggle = useGameStore((s) => s.toggleChat);
  const messages = useGameStore((s) => s.chatMessages);
  const sendChat = useGameStore((s) => s.sendChat);
  const myPlayerId = useGameStore((s) => s.myPlayerId);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus input when drawer opens
  useEffect(() => {
    if (show) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [show]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Prevent game keyboard shortcuts from firing while typing
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
          />

          {/* Drawer Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full sm:w-[380px] bg-charcoal border-l border-charcoal-lighter z-50 flex flex-col shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-lighter">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h2 className="text-gold font-bold text-lg font-[Georgia]">Table Chat</h2>
              </div>
              <button
                onClick={toggle}
                className="text-cream/40 hover:text-cream transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-charcoal-lighter scrollbar-track-transparent">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-cream/30 gap-2">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs">No messages yet. Say hello!</span>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.playerId === myPlayerId;
                const isSystem = msg.isSystem;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="text-cream/30 text-[11px] italic">{msg.text}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Name & Time */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-gold/70' : 'text-cream/40'}`}>
                        {isMe ? 'You' : msg.playerName}
                      </span>
                      <span className="text-cream/20 text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        isMe
                          ? 'bg-gold/20 text-gold rounded-tr-md border border-gold/15'
                          : 'bg-charcoal-lighter/80 text-cream/90 rounded-tl-md border border-charcoal-lighter'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-charcoal-lighter p-3">
              <div className="flex items-center gap-2 bg-navy/50 rounded-xl border border-charcoal-lighter focus-within:border-gold/30 transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 bg-transparent text-cream text-sm px-4 py-3 placeholder-cream/20 outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`p-2 mr-1 rounded-lg transition-all duration-150 ${
                    input.trim()
                      ? 'text-gold hover:bg-gold/20'
                      : 'text-cream/20 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
