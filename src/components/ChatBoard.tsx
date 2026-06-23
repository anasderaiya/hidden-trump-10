import React, { useState } from 'react';
import { Message } from '../types';
import { Send } from 'lucide-react';

interface ChatBoardProps {
  messages: Message[];
  onSendMessage: (text: string, isEmote?: boolean) => void;
  className?: string;
}

const PRESET_EMOTES = ["😊", "🔥", "👑", "👍", "😮", "😎", "🍿", "😭", "🥱", "♣️", "♦️", "♥️", "♠️"];
const QUICK_CHATS = [
  "Let's win this Team!",
  "Great trick Partner!",
  "Drop a Ten!",
  "Open the hidden card!",
  "Good game everyone!",
  "We got this!",
  "Unlucky play!",
  "Careful with Trump!"
];

export const ChatBoard: React.FC<ChatBoardProps> = ({
  messages,
  onSendMessage,
  className = ""
}) => {
  const [typedMessage, setTypedMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;
    onSendMessage(typedMessage.trim(), false);
    setTypedMessage("");
  };

  const handleQuickSend = (text: string) => {
    onSendMessage(text, false);
  };

  const handleEmoteSend = (emote: string) => {
    onSendMessage(emote, true);
  };

  return (
    <div id="chat-board" className={`flex flex-col bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden h-full shadow-2xl ${className}`}>
      
      {/* Header bar */}
      <div className="bg-slate-950/50 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          🔴 Realtime Arena Chat
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[160px] sm:max-h-full scrollbar-thin scrollbar-thumb-slate-800">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8 font-medium">
            Lobby is quiet. Use quick chat!
          </div>
        ) : (
          messages.map(msg => {
            const isSystem = msg.senderId === 'system';
            return (
              <div
                key={msg.id}
                className={`text-xs leading-relaxed ${isSystem ? 'text-blue-400 bg-blue-950/40 py-1.5 px-3 rounded-xl border border-blue-900/30 text-center italic font-medium' : 'text-slate-200'}`}
              >
                {!isSystem && (
                  <span className="font-extrabold text-slate-450 mr-2">{msg.senderName}:</span>
                )}
                <span className={msg.isEmote ? 'text-base' : ''}>{msg.text}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Preset / Emotes Tray */}
      <div className="bg-slate-950/80 p-3.5 border-t border-slate-800/80 space-y-3">
        <div className="flex flex-wrap gap-2 justify-center max-h-16 overflow-y-auto">
          {PRESET_EMOTES.map(emote => (
            <button
              key={emote}
              onClick={() => handleEmoteSend(emote)}
              className="text-sm bg-slate-900 hover:bg-slate-800 hover:scale-110 w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer border border-slate-800/60"
            >
              {emote}
            </button>
          ))}
        </div>

        {/* Quick phrases button list */}
        <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none scroll-smooth">
          {QUICK_CHATS.map(phrase => (
            <button
              key={phrase}
              onClick={() => handleQuickSend(phrase)}
              className="text-[10px] uppercase tracking-wider whitespace-nowrap bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-400 font-bold px-3 py-1.5 rounded-full border border-slate-800/60 transition-all cursor-pointer"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>

      {/* Typing Form */}
      <form onSubmit={handleSubmit} className="flex p-3 bg-slate-950/90 border-t border-slate-800/85 gap-2 items-center">
        <input
          id="chat-input-field"
          type="text"
          value={typedMessage}
          onChange={e => setTypedMessage(e.target.value)}
          placeholder="Send a whisper..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          id="btn-chat-submit"
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white p-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center font-bold"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};

