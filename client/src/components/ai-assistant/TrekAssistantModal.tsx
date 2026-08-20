import React, { useState, useEffect, useRef } from 'react';
import {
  IconBot,
  IconTrash,
  IconMaximize,
  IconMinimize,
  IconPhoneCall,
  IconCopy,
  IconCheck,
  IconMountain,
  IconShieldAlert,
  IconCompass,
  IconSettings,
  IconCpu,
  IconHiking,
  IconMapPin,
} from '../common/SvgIcons.js';

import { sendAiMessage, fetchQuickPrompts, removeEmojis } from '../../services/aiAssistant.service.js';
import type { Trail, AiChatMessage, UserProfile } from '../../types.js';

interface TrekAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrail?: Trail | null;
  currentUser?: UserProfile | null;
  onSelectTrail?: (trailId: string) => void;
}

export const TrekAssistantModal: React.FC<TrekAssistantModalProps> = ({
  isOpen,
  onClose,
  currentTrail,
  currentUser,
  onSelectTrail,
}) => {
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('trekmap_gemini_api_key') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [keySaveSuccess, setKeySaveSuccess] = useState(false);

  const getWelcomeMessage = (): AiChatMessage => {
    const rawName = currentUser?.fullName || '';
    const cleanName = rawName.replace(/\s*\(.*?\)/, '').trim();
    const nameGreeting = cleanName ? ` **${cleanName}**` : '';

    return {
      id: 'welcome-msg',
      role: 'assistant',
      content: removeEmojis(`**Xin chào${nameGreeting}!** Em là **TrekCopilot AI** — trợ lý thám hiểm & sinh tồn chuyên biệt cho địa hình leo núi tại Việt Nam.

Em có thể giúp bạn:
- **Tư vấn cung đường theo thể lực**: Săn mây Lảo Thẩn, Tà Xùa; chạm đỉnh Fansipan 3.143m; ngắm hoa Chi Pâu Tà Chì Nhù; hay thử thách Tà Năng - Phan Dũng...
- **Cứu hộ khẩn cấp 24/7**: Xử lý sốc độ cao (AMS), lạc đường (quy tắc S.T.O.P), hạ thân nhiệt & kết nối hotline kiểm lâm thực tế.
- **Lập checklist Balo & Lộ trình tập thể lực 4 tuần**: Quy tắc 3 lớp áo, kiểm soát tải trọng dưới 20% thể trọng.
- **Dự toán chi phí & Liên hệ Porter/Guide bản địa**.

*Hôm nay ${cleanName ? cleanName : 'bạn'} cần em tư vấn cung đường nào hoặc hỗ trợ điều gì không ạ?*`),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        {
          type: 'quick_reply',
          suggestions: [
            'Gợi ý cung săn mây cho người mới',
            'Kế hoạch tập thể lực 4 tuần',
            'Checklist Balo & Trang bị 2N1Đ',
            'Dự toán chi phí & Thuê Porter',
            'Cấp cứu khẩn cấp: Sốc độ cao & Lạc đường',
          ],
        },
      ],
    };
  };

  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('trekmap_ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: AiChatMessage) => ({
            ...m,
            content: removeEmojis(m.content),
          }));
        }
      }
    } catch (e) {
      // Ignore
    }
    return [getWelcomeMessage()];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkedGearItems, setCheckedGearItems] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('trekmap_ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      // Ignore
    }
  }, [messages]);

  // Load contextual quick prompts
  useEffect(() => {
    if (isOpen) {
      fetchQuickPrompts(
        currentTrail ? { name: currentTrail.name, province: currentTrail.province } : undefined
      ).then((prompts) => {
        if (prompts && prompts.length > 0) {
          setQuickPrompts(prompts.map(removeEmojis));
        }
      });
      // Autofocus input
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, currentTrail]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen && !showSettings) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, showSettings]);

  const handleSaveApiKey = (key: string) => {
    const cleanKey = key.trim();
    setGeminiApiKey(cleanKey);
    if (cleanKey) {
      localStorage.setItem('trekmap_gemini_api_key', cleanKey);
    } else {
      localStorage.removeItem('trekmap_gemini_api_key');
    }
    setKeySaveSuccess(true);
    setTimeout(() => {
      setKeySaveSuccess(false);
      setShowSettings(false);
    }, 1200);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = removeEmojis(textToSend || inputQuery).trim();
    if (!text || isLoading) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: removeEmojis(m.content) }));

      const res = await sendAiMessage({
        message: text,
        conversationHistory: history,
        userName: currentUser?.fullName,
        userRole: currentUser?.role,
        customApiKey: geminiApiKey || undefined,
        currentTrailContext: currentTrail
          ? {
              trailId: currentTrail.id,
              trailName: currentTrail.name,
              province: currentTrail.province,
              maxAltitudeM: currentTrail.maxAltitudeM,
              difficultyLevel: currentTrail.difficultyLevel,
            }
          : undefined,
      });

      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: removeEmojis(res.reply),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: res.actions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Đã xảy ra lỗi khi xử lý. Bạn vẫn có thể tra cứu thông tin thực địa bằng các câu hỏi mẫu bên dưới.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện không?')) {
      setMessages([getWelcomeMessage()]);
      sessionStorage.removeItem('trekmap_ai_chat_history');
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(removeEmojis(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleGearCheck = (itemKey: string) => {
    setCheckedGearItems((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  // Select appropriate pure SVG icon for prompt chips
  const getPromptSvgIcon = (promptText: string) => {
    const p = promptText.toLowerCase();
    if (p.includes('cứu hộ') || p.includes('khẩn cấp') || p.includes('sốc độ cao') || p.includes('lạc đường')) {
      return <IconShieldAlert size={14} color="#ef4444" />;
    }
    if (p.includes('săn mây') || p.includes('fansipan') || p.includes('lảo thẩn') || p.includes('tà xùa') || p.includes('đỉnh')) {
      return <IconMountain size={14} color="var(--color-sky)" />;
    }
    if (p.includes('thể lực') || p.includes('tập luyện') || p.includes('chạy bộ') || p.includes('balo') || p.includes('đồ')) {
      return <IconHiking size={14} color="var(--color-primary)" />;
    }
    if (p.includes('chi phí') || p.includes('porter') || p.includes('giá')) {
      return <IconCompass size={14} color="var(--color-earth)" />;
    }
    return <IconBot size={14} color="var(--color-primary)" />;
  };

  // Renderer for inline tokens: Bold keywords, Quoted terms as badges, Code

  const renderInlineSegments = (text: string, isUser: boolean) => {
    // Regex matches bold (**term**), quotes ("term", ""term"", “term”, ”term”), and inline code (`term`)
    const tokenRegex = /(\*\*.*?\*\*|(?:"{1,2}|“|”)[^"“”\n]+(?:"{1,2}|“|”)|`.*?`)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // 1. Bold Keyword Token: **keyword**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={index}
            style={{
              color: isUser ? '#070d1e' : 'var(--color-primary)',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              textShadow: isUser ? 'none' : '0 0 10px rgba(74, 222, 128, 0.25)',
            }}
          >
            {inner}
          </strong>
        );
      }

      // 2. Quoted Keyword Token: "keyword" or ""keyword"" or “keyword” -> Sleek Cyber-Alpine Focal Tag Badge
      const quoteMatch = part.match(/^(?:"{1,2}|“|”)([^"“”\n]+)(?:"{1,2}|“|”)$/);
      if (quoteMatch) {
        const keyword = quoteMatch[1].trim();
        return (
          <span
            key={index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              margin: '0 3px',
              borderRadius: '6px',
              background: isUser ? 'rgba(0, 0, 0, 0.16)' : 'rgba(56, 189, 248, 0.16)',
              color: isUser ? '#070d1e' : 'var(--color-sky)',
              border: isUser ? '1px solid rgba(0, 0, 0, 0.25)' : '1px solid rgba(56, 189, 248, 0.35)',
              fontWeight: 700,
              fontSize: '0.88em',
              letterSpacing: '0.01em',
              verticalAlign: 'baseline',
              boxShadow: isUser ? 'none' : '0 2px 8px rgba(56, 189, 248, 0.12)',
            }}
          >
            {keyword}
          </span>
        );
      }

      // 3. Inline code token: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const code = part.slice(1, -1);
        return (
          <code
            key={index}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.85em',
              fontFamily: 'monospace',
              color: isUser ? '#070d1e' : 'var(--color-primary)',
            }}
          >
            {code}
          </code>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  // Normalize text to break cramped inline lists into distinct rows
  const normalizeMessageFormatting = (rawText: string): string => {
    if (!rawText) return '';
    let text = removeEmojis(rawText);

    // 1. Break before numbered items if cramped: "...đây ạ: 1. Tin..." -> "...đây ạ:\n\n1. Tin..."
    text = text.replace(/([^\n])\s+(\d+\.\s+[A-ZĐÀ-Ỹa-zđà-ỹ])/g, '$1\n\n$2');

    // 2. Break before colons attached to numbers: "đây ạ: 1." -> "đây ạ:\n\n1."
    text = text.replace(/([:：])\s*(\d+\.)/g, '$1\n\n$2');

    // 3. Break before bullet items: "...Miền Bắc: - Hiện tại..." -> "...Miền Bắc:\n- Hiện tại..."
    text = text.replace(/([^\n])\s+-\s+([A-ZĐÀ-Ỹa-zđà-ỹ])/g, '$1\n- $2');
    text = text.replace(/([:：])\s*(-)/g, '$1\n- ');

    // 4. Break before markdown headers: "xong. ### Tiêu đề" -> "xong.\n\n### Tiêu đề"
    text = text.replace(/([^\n])\s+(#{1,4}\s+)/g, '$1\n\n$2');

    // 5. Clean up multiple empty lines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  };

  // Structured Message Renderer (Headers, Step cards, Bullet lists, Inline highlights)
  const renderFormattedMessage = (rawContent: string, isUser: boolean) => {
    const formattedContent = normalizeMessageFormatting(rawContent);
    const lines = formattedContent.split('\n');

    return lines.map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={lineIdx} style={{ height: 8 }} />;
      }

      // Header 3: ### Title
      if (trimmed.startsWith('### ')) {
        return (
          <h5
            key={lineIdx}
            style={{
              margin: '14px 0 6px 0',
              fontSize: '0.92rem',
              fontWeight: 800,
              color: isUser ? '#070d1e' : 'var(--color-primary)',
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 4, height: 14, borderRadius: 2, background: 'var(--color-primary)', flexShrink: 0 }} />
            {renderInlineSegments(trimmed.replace(/^###\s*/, ''), isUser)}
          </h5>
        );
      }

      // Header 1/2: # or ## Title
      if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        return (
          <h4
            key={lineIdx}
            style={{
              margin: '16px 0 8px 0',
              fontSize: '0.98rem',
              fontWeight: 800,
              color: isUser ? '#070d1e' : 'var(--color-sky)',
              letterSpacing: '-0.01em',
            }}
          >
            {renderInlineSegments(trimmed.replace(/^#{1,2}\s*/, ''), isUser)}
          </h4>
        );
      }

      // Numbered step lists: 1. , 2. , 3. -> Sleek Glass Card Block
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const num = numMatch[1];
        const rest = numMatch[2];
        return (
          <div
            key={lineIdx}
            style={{
              margin: '8px 0',
              padding: '10px 14px',
              background: isUser ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.035)',
              border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              boxShadow: isUser ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.15)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 22,
                height: 22,
                borderRadius: '50%',
                background: isUser
                  ? '#070d1e'
                  : 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                color: isUser ? 'var(--color-primary)' : '#070d1e',
                fontSize: '0.75rem',
                fontWeight: 800,
                marginTop: 2,
                flexShrink: 0,
                boxShadow: isUser ? 'none' : '0 2px 8px rgba(74, 222, 128, 0.3)',
              }}
            >
              {num}
            </span>
            <div style={{ flex: 1, lineHeight: 1.65, fontSize: '0.875rem' }}>
              {renderInlineSegments(rest, isUser)}
            </div>
          </div>
        );
      }

      // Bullet items: - or *
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const rest = trimmed.replace(/^[-*]\s+/, '');
        return (
          <div
            key={lineIdx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              margin: '5px 0 5px 8px',
              lineHeight: 1.6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isUser ? '#070d1e' : 'var(--color-primary)',
                marginTop: 8,
                flexShrink: 0,
                boxShadow: isUser ? 'none' : '0 0 6px var(--color-primary)',
              }}
            />
            <div style={{ flex: 1 }}>{renderInlineSegments(rest, isUser)}</div>
          </div>
        );
      }

      // Regular paragraph line with breathing room
      return (
        <p key={lineIdx} style={{ margin: '6px 0', lineHeight: 1.7, fontSize: '0.875rem' }}>
          {renderInlineSegments(trimmed, isUser)}
        </p>
      );
    });
  };


  if (!isOpen) return null;


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="TrekCopilot AI Virtual Assistant Window"
      style={{
        position: 'fixed',
        bottom: 140,
        right: 28,
        zIndex: 9995,
        width: isExpanded ? '660px' : '450px',
        maxWidth: 'calc(100vw - 36px)',
        height: isExpanded ? '780px' : '620px',
        maxHeight: 'calc(100vh - 165px)',
        background: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1.5px solid var(--color-border-glow)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(74, 222, 128, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(180deg, rgba(74, 222, 128, 0.12) 0%, rgba(15, 24, 46, 0.95) 100%)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              position: 'relative',
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
              color: '#070d1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(74, 222, 128, 0.4)',
            }}
          >
            <IconBot size={22} color="#070d1e" />
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#22c55e',
                border: '2px solid var(--color-bg-card)',
                boxShadow: '0 0 8px #22c55e',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 800,
                  color: 'var(--color-text-main)',
                  letterSpacing: '-0.01em',
                }}
              >
                TrekCopilot AI
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: geminiApiKey ? 'rgba(56, 189, 248, 0.2)' : 'rgba(74, 222, 128, 0.2)',
                  color: geminiApiKey ? 'var(--color-sky)' : 'var(--color-primary)',
                  border: geminiApiKey ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(74, 222, 128, 0.4)',
                }}
              >
                {geminiApiKey ? 'Gemini Live' : 'Real Knowledge Engine'}
              </span>
            </div>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: '0.75rem',
                color: 'var(--color-text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                }}
              />
              Trực tuyến 24/7 • Thám hiểm & Cứu hộ
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* AI Settings / API Key button */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            title="Cài đặt AI & Kết nối Google Gemini API"
            style={{
              background: showSettings ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
              border: 'none',
              color: showSettings ? 'var(--color-primary)' : 'var(--color-text-dim)',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <IconSettings size={17} />
          </button>

          <button
            type="button"
            onClick={handleClearHistory}
            title="Xóa lịch sử trò chuyện"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-dim)',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-error)';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-dim)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <IconTrash size={17} />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Phóng to cửa sổ'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-dim)',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-primary)';
              e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-dim)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {isExpanded ? <IconMinimize size={17} /> : <IconMaximize size={17} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Đóng cửa sổ"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-dim)',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              lineHeight: 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-main)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-dim)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Settings / Training Panel */}
      {showSettings ? (
        <div
          style={{
            flex: 1,
            padding: 20,
            overflowY: 'auto',
            background: 'rgba(7, 13, 30, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)' }}>
            <IconCpu size={20} color="var(--color-primary)" />
            <h4 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800 }}>
              Cài Đặt Mô Hình AI & Huấn Luyện Tri Thức
            </h4>
          </div>

          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            TrekCopilot AI mặc định sử dụng <strong>Cơ sở tri thức thực địa 100%</strong> của TrekMap. Bạn có thể kết nối thêm <strong>Google Gemini API Key</strong> (hoàn toàn miễn phí) để AI trò chuyện tự nhiên và giải đáp mọi tình huống sâu hơn!
          </p>

          <div
            style={{
              background: 'rgba(15, 24, 46, 0.8)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Google Gemini API Key (Tùy chọn):
            </label>
            <input
              type="password"
              defaultValue={geminiApiKey}
              id="gemini-key-input"
              placeholder="Nhập API Key..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--color-text-main)',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: 'var(--color-sky)', textDecoration: 'underline' }}
              >
                Lấy Gemini API Key miễn phí tại Google AI Studio
              </a>

              <button
                type="button"
                onClick={() => {
                  const val = (document.getElementById('gemini-key-input') as HTMLInputElement)?.value || '';
                  handleSaveApiKey(val);
                }}
                style={{
                  background: keySaveSuccess ? '#22c55e' : 'var(--color-primary)',
                  color: '#070d1e',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {keySaveSuccess ? <IconCheck size={14} color="#070d1e" /> : null}
                {keySaveSuccess ? 'Đã lưu!' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              fontSize: '0.78rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'var(--color-sky)', display: 'block', marginBottom: 4 }}>
              Nguồn Dữ Liệu Được Huấn Luyện (Real-world Grounding):
            </strong>
            - 10 đỉnh núi cao nhất Việt Nam (Fansipan, Pusilung, Putaleng, Kỳ Quan San, Tà Chì Nhù, Nhìu Cồ San, Lảo Thẩn, Tà Xùa...).<br />
            - Cẩm nang sơ cấp cứu y tế dã ngoại (AMS, hạ thân nhiệt, lạc đường S.T.O.P).<br />
            - Danh bạ hotline Ban Quản Lý VQG Hoàng Liên, Bát Xát, Bắc Yên & Đội cứu nạn Quốc Gia 114.<br />
            - Lịch trình tập thể lực 4 tuần & dinh dưỡng bù nước Oresol.
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(false)}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Quay lại trò chuyện
          </button>
        </div>
      ) : (
        <>
          {/* Context Banner if looking at a trail */}
          {currentTrail && (
            <div
              style={{
                padding: '8px 16px',
                background: 'rgba(56, 189, 248, 0.12)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: '0.78rem',
                color: 'var(--color-sky)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <IconMountain size={14} color="var(--color-sky)" />
                <span>
                  Đang xem: <strong>{currentTrail.name}</strong> ({currentTrail.maxAltitudeM}m - {currentTrail.province})
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSendMessage(`Cho tôi biết kinh nghiệm, thời tiết và chuẩn bị đồ leo cung ${currentTrail.name}`)}
                style={{
                  background: 'var(--color-sky)',
                  color: '#070d1e',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Hỏi về cung này
              </button>
            </div>
          )}

          {/* Message Stream */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    padding: '12px 16px',
                    borderRadius:
                      msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: msg.role === 'user' ? '#070d1e' : 'var(--color-text-main)',
                    border:
                      msg.role === 'user'
                        ? 'none'
                        : '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    fontWeight: msg.role === 'user' ? 600 : 400,
                    boxShadow:
                      msg.role === 'user'
                        ? '0 4px 16px rgba(74, 222, 128, 0.3)'
                        : '0 4px 16px rgba(0, 0, 0, 0.2)',
                    wordBreak: 'break-word',
                  }}
                >
                  {/* Message Content formatted with rich focal highlights and clean structure */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {renderFormattedMessage(msg.content, msg.role === 'user')}
                  </div>


                  {/* Action Cards */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {msg.actions.map((act, actIdx) => {
                        // 1. Trail Card Action
                        if (act.type === 'trail_card' && act.trailData) {
                          const t = act.trailData;
                          return (
                            <div
                              key={actIdx}
                              style={{
                                background: 'rgba(15, 24, 46, 0.95)',
                                border: '1px solid var(--color-border-glow)',
                                borderRadius: 'var(--radius-md)',
                                padding: 12,
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                                boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
                              }}
                            >
                              {t.coverImage && (
                                <img
                                  src={t.coverImage}
                                  alt={t.name || 'Trail'}
                                  style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 8,
                                    objectFit: 'cover',
                                    border: '1px solid var(--color-border)',
                                  }}
                                />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h4
                                  style={{
                                    margin: '0 0 4px 0',
                                    fontSize: '0.88rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-main)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {t.name}
                                </h4>
                                <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <IconMapPin size={12} color="var(--color-text-dim)" />
                                  {t.province} • Cao độ: <strong style={{ color: 'var(--color-primary)' }}>{t.maxAltitudeM}m</strong> • Cự ly: {t.distanceKm}km
                                </p>
                                {onSelectTrail && act.trailId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectTrail(act.trailId!);
                                      onClose();
                                    }}
                                    style={{
                                      background: 'var(--color-primary)',
                                      color: '#070d1e',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 10px',
                                      fontSize: '0.74rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <IconCompass size={13} color="#070d1e" />
                                    Mở trên Bản Đồ 3D
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // 2. Emergency SOS Action Card
                        if (act.type === 'emergency_sos' && act.emergencyContacts) {
                          return (
                            <div
                              key={actIdx}
                              style={{
                                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(15, 24, 46, 0.95) 100%)',
                                border: '1.5px solid #ef4444',
                                borderRadius: 'var(--radius-md)',
                                padding: 12,
                                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.25)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#f87171' }}>
                                <IconShieldAlert size={18} color="#ef4444" />
                                <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Hotline Cứu Hộ Thực Địa (100% Số Thật)
                                </strong>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {act.emergencyContacts.map((contact, cIdx) => (
                                  <div
                                    key={cIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                      padding: '6px 10px',
                                      background: 'rgba(0, 0, 0, 0.4)',
                                      borderRadius: 8,
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                        {removeEmojis(contact.name)}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                                        {removeEmojis(contact.address || contact.region || '')}
                                      </div>
                                    </div>
                                    <a
                                      href={`tel:${contact.phone.replace(/[^0-9]/g, '')}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        background: '#dc2626',
                                        color: '#ffffff',
                                        padding: '5px 10px',
                                        borderRadius: 6,
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        textDecoration: 'none',
                                        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.5)',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <IconPhoneCall size={13} color="#ffffff" />
                                      {contact.phone}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // 3. Gear Checklist Card
                        if (act.type === 'gear_checklist' && act.checklistItems) {
                          return (
                            <div
                              key={actIdx}
                              style={{
                                background: 'rgba(15, 24, 46, 0.95)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                borderRadius: 'var(--radius-md)',
                                padding: 12,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-sky)', fontSize: '0.82rem', fontWeight: 700 }}>
                                  <IconHiking size={15} color="var(--color-sky)" />
                                  <span>Danh Mục Balo (Tích chọn đồ đã chuẩn bị)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullText = act.checklistItems
                                      ?.map((c) => `${removeEmojis(c.category)}:\n` + c.items.map((i) => `- [ ] ${removeEmojis(i)}`).join('\n'))
                                      .join('\n\n');
                                    if (fullText) handleCopyText(`gear-${actIdx}`, fullText);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: 6,
                                    padding: '3px 8px',
                                    fontSize: '0.7rem',
                                    color: 'var(--color-text-muted)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  {copiedId === `gear-${actIdx}` ? (
                                    <>
                                      <IconCheck size={12} color="var(--color-primary)" />
                                      Đã chép
                                    </>
                                  ) : (
                                    <>
                                      <IconCopy size={12} />
                                      Sao chép
                                    </>
                                  )}
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {act.checklistItems.map((cat, catIdx) => (
                                  <div key={catIdx}>
                                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                                      {removeEmojis(cat.category)}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {cat.items.map((item, itemIdx) => {
                                        const key = `${catIdx}-${itemIdx}`;
                                        const isChecked = !!checkedGearItems[key];
                                        return (
                                          <label
                                            key={itemIdx}
                                            onClick={() => toggleGearCheck(key)}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 8,
                                              fontSize: '0.78rem',
                                              color: isChecked ? 'var(--color-text-dim)' : 'var(--color-text-main)',
                                              textDecoration: isChecked ? 'line-through' : 'none',
                                              cursor: 'pointer',
                                              userSelect: 'none',
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {}}
                                              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                            />
                                            <span>{removeEmojis(item)}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>

                {/* Timestamp & copy helper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--color-text-dim)', padding: '0 4px' }}>
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      title="Sao chép nội dung câu trả lời"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedId === msg.id ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {copiedId === msg.id ? <IconCheck size={12} color="var(--color-primary)" /> : <IconCopy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading typing state */}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconBot size={16} color="var(--color-primary)" />
                </div>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      animation: 'pulse 1s infinite alternate',
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-sky)',
                      animation: 'pulse 1s infinite alternate 0.3s',
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      animation: 'pulse 1s infinite alternate 0.6s',
                    }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel with Pure SVG Icons */}
          {quickPrompts.length > 0 && (
            <div
              style={{
                padding: '8px 14px',
                background: 'rgba(15, 24, 46, 0.75)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {quickPrompts.slice(0, 5).map((prompt, pIdx) => {
                const cleanPrompt = removeEmojis(prompt);
                return (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => handleSendMessage(cleanPrompt)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      borderRadius: 14,
                      padding: '5px 12px',
                      fontSize: '0.73rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    {getPromptSvgIcon(cleanPrompt)}
                    <span>{cleanPrompt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Input Form Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: '12px 14px',
              background: 'rgba(15, 24, 46, 0.95)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={currentTrail ? `Hỏi về cung ${currentTrail.name}...` : 'Hỏi về cung đường, thể lực, chi phí, cứu hộ...'}
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid var(--color-border)',
                borderRadius: 24,
                padding: '10px 16px',
                color: 'var(--color-text-main)',
                fontSize: '0.875rem',
                outline: 'none',
                fontFamily: 'var(--font-family)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(74, 222, 128, 0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />

            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              aria-label="Gửi tin nhắn"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: inputQuery.trim() && !isLoading ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
                color: inputQuery.trim() && !isLoading ? '#070d1e' : 'var(--color-text-dim)',
                border: 'none',
                cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                boxShadow: inputQuery.trim() && !isLoading ? '0 4px 14px rgba(74, 222, 128, 0.4)' : 'none',
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
};
