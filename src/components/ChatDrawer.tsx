import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../hooks/useGameState';

interface ChatPanelProps {
  className?: string;
  onClose?: () => void;
  autoFocusInput?: boolean;
}

function ChatPanel({ className = '', onClose, autoFocusInput = false }: ChatPanelProps) {
  const messages = useGameStore((s) => s.chatMessages);
  const sendChat = useGameStore((s) => s.sendChat);
  const myPlayerId = useGameStore((s) => s.myPlayerId);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!autoFocusInput) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.clearTimeout(timeout);
  }, [autoFocusInput]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Prevent table keyboard shortcuts while typing in chat.
    e.stopPropagation();
  };

  return (
    <div className={`bg-charcoal/95 border border-gold/20 flex flex-col shadow-[0_16px_36px_rgba(0,0,0,0.35)] ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gold/15 bg-gradient-to-r from-charcoal-light/80 to-charcoal/60">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-gold font-bold text-lg font-[Georgia]">Table Chat</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-cream/40 hover:text-cream transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

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
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-gold/70' : 'text-cream/40'}`}>
                  {isMe ? 'You' : msg.playerName}
                </span>
                <span className="text-cream/20 text-[10px]">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

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

      <div className="border-t border-gold/15 p-3">
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
    </div>
  );
}

export default function ChatDrawer() {
  const show = useGameStore((s) => s.showChat);
  const toggle = useGameStore((s) => s.toggleChat);

  return (
    <>
      {/* Always-visible desktop chat rail (separate from table area) */}
      <div className="hidden lg:flex fixed right-3 top-[calc(var(--safe-top)+72px)] bottom-3 w-[300px] xl:w-[320px] z-30">
        <ChatPanel className="h-full w-full rounded-2xl overflow-hidden backdrop-blur-md" />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {show && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggle}
            />

            <motion.div
              className="fixed right-0 top-0 h-full w-full sm:w-[380px] z-50 lg:hidden pt-[var(--safe-top)] pb-[var(--safe-bottom)]"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <ChatPanel className="h-full w-full" onClose={toggle} autoFocusInput />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
