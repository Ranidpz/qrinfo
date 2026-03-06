'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, ChevronDown, X, AtSign, Trophy, ArrowLeft } from 'lucide-react';
import { useQGamesTheme } from './QGamesThemeContext';
import {
  QGamesChatPhrase,
  QGamesChatMessage,
  QGamesAvatarType,
  ChatPhraseType,
} from '@/types/qgames';
import { sendChatMessage } from '@/lib/qgames-realtime';
import { useLobbyChatMessages, useChatModeration } from '@/hooks/useQGamesRealtime';

interface ConnectedPlayer {
  id: string;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
}

interface LobbyChatProps {
  codeId: string;
  visitorId: string;
  playerNickname: string;
  playerAvatarType: QGamesAvatarType;
  playerAvatarValue: string;
  phrases: QGamesChatPhrase[];
  connectedPlayers: ConnectedPlayer[];
  isRTL: boolean;
  onViewLeaderboard?: () => void;
  onViewOnline?: () => void;
  onBack?: () => void;
  viewerCount?: number;
}

export default function LobbyChat({
  codeId,
  visitorId,
  playerNickname,
  playerAvatarType,
  playerAvatarValue,
  phrases,
  connectedPlayers,
  isRTL,
  onViewLeaderboard,
  onViewOnline,
  onBack,
  viewerCount = 0,
}: LobbyChatProps) {
  const theme = useQGamesTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [pendingMention, setPendingMention] = useState<ConnectedPlayer | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastSeenCountRef = useRef(0);
  const isAtBottomRef = useRef(true);

  const { messages } = useLobbyChatMessages(codeId);
  const {
    canSend,
    isBanned,
    cooldownSeconds,
    warningMessage,
    dismissWarning,
    checkCanSend,
    recordSend,
  } = useChatModeration(codeId, visitorId);

  // Separate text phrases from emoji-only
  const textPhrases = phrases.filter(p => p.type === 'text');
  const emojiPhrases = phrases.filter(p => p.type === 'emoji');

  // Track unread messages when collapsed
  useEffect(() => {
    if (isExpanded) {
      setUnreadCount(0);
      lastSeenCountRef.current = messages.length;
    } else {
      const newCount = messages.length - lastSeenCountRef.current;
      if (newCount > 0) setUnreadCount(newCount);
    }
  }, [messages.length, isExpanded]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isExpanded && isAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isExpanded]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const handleSendPhrase = useCallback(async (phrase: QGamesChatPhrase) => {
    if (!checkCanSend()) return;

    const msg: Omit<QGamesChatMessage, 'id'> = {
      senderId: visitorId,
      senderNickname: playerNickname,
      senderAvatarType: playerAvatarType,
      senderAvatarValue: playerAvatarValue,
      phraseId: phrase.id,
      text: phrase.text,
      phraseType: phrase.type,
      sentAt: Date.now(),
    };
    if (phrase.emoji) msg.emoji = phrase.emoji;
    if (phrase.color) msg.color = phrase.color;

    if (pendingMention) {
      msg.mentionId = pendingMention.id;
      msg.mentionNickname = pendingMention.nickname;
      setPendingMention(null);
    }

    recordSend();
    await sendChatMessage(codeId, msg);
  }, [codeId, visitorId, playerNickname, playerAvatarType, playerAvatarValue, pendingMention, checkCanSend, recordSend]);

  const handleSelectMention = useCallback((player: ConnectedPlayer) => {
    setPendingMention(player);
    setShowMentionPicker(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isAtBottomRef.current = true;
  }, []);

  const lastMessage = messages[messages.length - 1];
  const otherPlayers = connectedPlayers.filter(p => p.id !== visitorId);

  // ── Collapsed bar ──
  if (!isExpanded) {
    return (
      <div
        className="fixed bottom-6 left-4 right-4 z-40 flex items-center gap-2"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Chat button */}
        <button
          onClick={() => setIsExpanded(true)}
          className="flex-1 flex items-center gap-2 py-2.5 px-4 rounded-2xl transition-all duration-200 active:scale-[0.98]"
          style={{
            backgroundColor: theme.surfaceColor,
            border: `1px solid ${theme.borderColor}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="relative">
            <MessageCircle size={18} style={{ color: theme.accentColor }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse"
                style={{ backgroundColor: theme.accentColor, color: theme.backgroundColor }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span
            className="flex-1 text-start text-sm truncate"
            style={{ color: lastMessage ? theme.textColor : theme.textSecondary }}
          >
            {lastMessage
              ? `${lastMessage.senderNickname}: ${lastMessage.phraseType === 'emoji' ? lastMessage.text : (lastMessage.emoji ? `${lastMessage.emoji} ${lastMessage.text}` : lastMessage.text)}`
              : (isRTL ? 'צ\'אט' : 'Chat')
            }
          </span>
          <ChevronDown size={16} style={{ color: theme.textSecondary, transform: 'rotate(180deg)' }} />
        </button>

        {/* Online count */}
        {viewerCount > 0 && (
          <button
            onClick={onViewOnline}
            className="shrink-0 flex items-center gap-1 px-2.5 h-11 rounded-2xl transition-all active:scale-[0.95]"
            style={{
              backgroundColor: theme.surfaceColor,
              border: `1px solid ${theme.borderColor}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
            <span className="text-xs font-medium tabular-nums" style={{ color: theme.textColor }}>{viewerCount}</span>
          </button>
        )}

        {/* Leaderboard or Back button */}
        {(onViewLeaderboard || onBack) && (
          <button
            onClick={onBack || onViewLeaderboard}
            className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-[0.95]"
            style={{
              backgroundColor: theme.surfaceColor,
              border: `1px solid ${theme.borderColor}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            {onBack ? (
              <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} style={{ color: theme.accentColor }} />
            ) : (
              <Trophy size={18} style={{ color: theme.accentColor }} />
            )}
          </button>
        )}
      </div>
    );
  }

  // ── Expanded chat ──
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col animate-in slide-in-from-bottom duration-300"
      style={{
        height: '60vh',
        maxHeight: '500px',
        backgroundColor: theme.backgroundColor,
        borderTop: `1px solid ${theme.borderColor}`,
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${theme.borderColor}` }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: theme.accentColor }} />
          <span className="text-sm font-medium" style={{ color: theme.textColor }}>
            {isRTL ? 'צ\'אט' : 'Chat'}
          </span>
          <span className="text-xs" style={{ color: theme.textSecondary }}>
            {messages.length}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 rounded-lg transition-colors"
          style={{ color: theme.textSecondary }}
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Warning banner */}
      {warningMessage && (
        <div
          className="flex items-center justify-between px-4 py-2 text-sm animate-in slide-in-from-top duration-200"
          style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
        >
          <span>{warningMessage}</span>
          <button onClick={dismissWarning} className="p-0.5">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages list */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: theme.textSecondary }}>
              {isRTL ? 'בחרו בועה ושלחו הודעה 💬' : 'Pick a bubble and send a message 💬'}
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === visitorId}
            isMentioned={msg.mentionId === visitorId}
            theme={theme}
            isRTL={isRTL}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* New messages indicator */}
      {!isAtBottomRef.current && messages.length > 5 && (
        <button
          onClick={scrollToBottom}
          className="absolute left-1/2 -translate-x-1/2 bottom-[180px] px-3 py-1 rounded-full text-xs font-medium animate-in fade-in duration-200"
          style={{
            backgroundColor: theme.primaryColor,
            color: '#fff',
          }}
        >
          {isRTL ? 'הודעות חדשות ↓' : 'New messages ↓'}
        </button>
      )}

      {/* Mention tag (if selected) */}
      {pendingMention && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
          style={{ borderTop: `1px solid ${theme.borderColor}` }}
        >
          <span className="text-xs" style={{ color: theme.accentColor }}>
            @{pendingMention.nickname}
          </span>
          <button
            onClick={() => setPendingMention(null)}
            className="p-0.5 rounded"
            style={{ color: theme.textSecondary }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Mention picker dropdown */}
      {showMentionPicker && otherPlayers.length > 0 && (
        <div
          className="px-3 py-2 overflow-x-auto flex gap-2 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-200 scrollbar-hide"
          style={{ borderTop: `1px solid ${theme.borderColor}` }}
        >
          {otherPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => handleSelectMention(player)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 transition-all active:scale-95"
              style={{
                backgroundColor: theme.surfaceColor,
                border: `1px solid ${theme.borderColor}`,
              }}
            >
              <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-xs shrink-0">
                {player.avatarType === 'selfie' && player.avatarValue.startsWith('http') ? (
                  <img src={player.avatarValue} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{player.avatarValue}</span>
                )}
              </div>
              <span className="text-xs whitespace-nowrap" style={{ color: theme.textColor }}>
                {player.nickname}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Text phrase picker */}
      <div
        className="px-3 py-2 overflow-y-auto max-h-[120px] shrink-0"
        style={{ borderTop: `1px solid ${theme.borderColor}` }}
      >
        {isBanned ? (
          <div className="text-center py-3">
            <span className="text-sm" style={{ color: theme.textSecondary }}>
              {isRTL ? 'נחסמתם מהצ\'אט 🚫' : 'You\'ve been blocked from chat 🚫'}
            </span>
          </div>
        ) : cooldownSeconds > 0 ? (
          <div className="text-center py-3">
            <span className="text-sm" style={{ color: theme.textSecondary }}>
              {isRTL ? `רגע... ${cooldownSeconds}` : `Wait... ${cooldownSeconds}`}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {textPhrases.map((phrase, i) => {
              const bubbleColor = phrase.color || theme.primaryColor;
              return (
                <button
                  key={phrase.id}
                  onClick={() => handleSendPhrase(phrase)}
                  disabled={!canSend}
                  className="chat-bounce-in px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
                  style={{
                    backgroundColor: `${bubbleColor}20`,
                    color: bubbleColor,
                    border: `1px solid ${bubbleColor}40`,
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {phrase.emoji && <span className="me-1">{phrase.emoji}</span>}
                  {phrase.text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Emoji reactions row (below text phrases) */}
      {emojiPhrases.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto shrink-0 scrollbar-hide"
          style={{ borderTop: `1px solid ${theme.borderColor}` }}
        >
          {emojiPhrases.map((phrase, i) => (
            <button
              key={phrase.id}
              onClick={() => handleSendPhrase(phrase)}
              disabled={!canSend}
              className="chat-bounce-in text-xl shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40"
              style={{
                backgroundColor: theme.surfaceColor,
                animationDelay: `${(textPhrases.length + i) * 40}ms`,
              }}
            >
              {phrase.text}
            </button>
          ))}

          {/* Mention button */}
          {otherPlayers.length > 0 && (
            <button
              onClick={() => setShowMentionPicker(!showMentionPicker)}
              className="chat-bounce-in shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                backgroundColor: pendingMention ? `${theme.accentColor}33` : theme.surfaceColor,
                color: pendingMention ? theme.accentColor : theme.textSecondary,
                animationDelay: `${(textPhrases.length + emojiPhrases.length) * 40}ms`,
              }}
            >
              <AtSign size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chat bubble component ──
function ChatBubble({
  message,
  isOwn,
  isMentioned,
  theme,
  isRTL,
}: {
  message: QGamesChatMessage;
  isOwn: boolean;
  isMentioned: boolean;
  theme: ReturnType<typeof useQGamesTheme>;
  isRTL: boolean;
}) {
  const bubbleColor = message.color || theme.primaryColor;
  const isEmojiOnly = message.phraseType === 'emoji';
  // In RTL, flex is already right-to-left, so own = default (right), others = reverse (left)
  const shouldReverse = isRTL ? !isOwn : isOwn;

  if (isEmojiOnly) {
    return (
      <div
        className={`flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${shouldReverse ? 'flex-row-reverse' : ''}`}
      >
        <Avatar type={message.senderAvatarType} value={message.senderAvatarValue} size={20} />
        <span className="text-[10px]" style={{ color: theme.textSecondary }}>
          {message.senderNickname}
        </span>
        <span className="text-3xl">{message.text}</span>
        {message.mentionNickname && (
          <span className="text-[10px] font-medium" style={{ color: theme.accentColor }}>
            @{message.mentionNickname}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${shouldReverse ? 'flex-row-reverse' : ''}`}
    >
      <Avatar type={message.senderAvatarType} value={message.senderAvatarValue} size={24} />
      <div className="flex flex-col max-w-[75%]">
        <span className="text-[10px] mb-0.5" style={{ color: theme.textSecondary }}>
          {message.senderNickname}
        </span>
        <div
          className="px-3 py-1.5 rounded-2xl text-sm"
          style={{
            backgroundColor: isOwn ? `${bubbleColor}25` : theme.surfaceColor,
            color: theme.textColor,
            borderInlineStart: isMentioned ? `3px solid ${theme.accentColor}` : undefined,
          }}
        >
          {message.emoji && <span className="me-1">{message.emoji}</span>}
          {message.text}
          {message.mentionNickname && (
            <span className="font-medium ms-1" style={{ color: theme.accentColor }}>
              @{message.mentionNickname}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tiny avatar helper ──
function Avatar({ type, value, size }: { type: QGamesAvatarType; value: string; size: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.7 }}
    >
      {type === 'selfie' && value.startsWith('http') ? (
        <img src={value} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}
