import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  IconX,
  IconEye,
  IconEyeOff,
} from '../common/SvgIcons.js';

import { sendAiMessage, fetchQuickPrompts, removeEmojis } from '../../services/aiAssistant.service.js';
import type { Trail, AiChatMessage, UserProfile, AiAssistantAction } from '../../types.js';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('trekmap_gemini_api_key') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [keySaveSuccess, setKeySaveSuccess] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showApiKeyText, setShowApiKeyText] = useState(false);
  const [preferredRegion, setPreferredRegion] = useState<string>(() => {
    return localStorage.getItem('trekmap_preferred_region') || 'danang';
  });
  const [engineMode, setEngineMode] = useState<'knowledge' | 'gemini'>(() => {
    return (localStorage.getItem('trekmap_engine_mode') as any) || 'knowledge';
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Keyboard shortcut: ESC to dismiss dialogs, minimize, or close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showClearConfirm) {
          setShowClearConfirm(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else if (isExpanded) {
          setIsExpanded(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showClearConfirm, showSettings, isExpanded, onClose]);

  // Capture user GPS coordinates gracefully if allowed
  useEffect(() => {
    if (isOpen && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Ignore if denied or unavailable
        },
        { timeout: 5000, maximumAge: 600000 }
      );
    }
  }, [isOpen]);

  const getWelcomeMessage = (): AiChatMessage => {
    const rawName = currentUser?.fullName || '';
    const cleanName = rawName.replace(/\s*\(.*?\)/, '').trim();
    const nameGreeting = cleanName ? ` **${cleanName}**` : '';

    return {
      id: 'welcome-msg',
      role: 'assistant',
      content: removeEmojis(`**Xin chào${nameGreeting}!** Em là **TrekCopilot AI** — trợ lý thám hiểm & sinh tồn chuyên biệt cho núi rừng Việt Nam.

Em có thể giúp bạn:
- **Tư vấn chọn cung theo thể lực**: Săn mây Lảo Thẩn, Tà Xùa; chạm đỉnh Fansipan 3.143m; ngắm hoa Chi Pâu Tà Chì Nhù; hay thử thách Tà Năng - Phan Dũng...
- **Cứu hộ khẩn cấp 24/7**: Xử lý sốc độ cao (AMS), lạc rừng (giao thức S.T.O.P), hạ thân nhiệt & hotline kiểm lâm thật.
- **Chuẩn bị hành trang**: Checklist đồ đạc dã ngoại, quy tắc 3 lớp áo và giáo án rèn thể lực 4 tuần.
- **Đi suối thác & Săn mây chill**: Gợi ý các địa điểm mát mẻ, an toàn lũ quét quanh khu vực bạn ở.

*Bạn đang chuẩn bị cho chuyến đi nào hoặc cần em hỗ trợ điều gì không ạ?*`),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        {
          type: 'quick_reply',
          suggestions: [
            'Gợi ý cung săn mây cho người mới',
            'Tìm địa điểm mát mẻ mây nhiều đi chill',
            'Đi suối thác gần tôi cuối tuần',
            'Checklist Balo & Trang bị 2N1Đ',
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
    } catch {
      // Ignore
    }
    return [getWelcomeMessage()];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkedGearItems, setCheckedGearItems] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('trekmap_ai_chat_history', JSON.stringify(messages));
    } catch {
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
      setEngineMode('gemini');
      localStorage.setItem('trekmap_engine_mode', 'gemini');
      triggerToast('Đã lưu khóa Google Gemini API!');
    } else {
      localStorage.removeItem('trekmap_gemini_api_key');
      setEngineMode('knowledge');
      localStorage.setItem('trekmap_engine_mode', 'knowledge');
      triggerToast('Đã chuyển sang Tri thức Thực địa TrekMap');
    }
    setKeySaveSuccess(true);
    setTimeout(() => {
      setKeySaveSuccess(false);
      setShowSettings(false);
    }, 800);
  };

  const getEffectiveCoords = () => {
    if (preferredRegion === 'danang') return { lat: 16.0544, lng: 108.2022 };
    if (preferredRegion === 'north') return { lat: 21.0285, lng: 105.8542 };
    if (preferredRegion === 'south') return { lat: 10.8231, lng: 106.6297 };
    if (preferredRegion === 'taynguyen') return { lat: 13.9833, lng: 108.0000 };
    return userCoords; // auto
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
        customApiKey: engineMode === 'gemini' ? (geminiApiKey || undefined) : undefined,
        userCoordinates: getEffectiveCoords() || undefined,
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
    } catch {
      const errorMsg: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Đã xảy ra lỗi khi kết nối. Bạn có thể tra cứu thông tin thực địa bằng các câu hỏi gợi ý bên dưới.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmClear = () => {
    setMessages([getWelcomeMessage()]);
    sessionStorage.removeItem('trekmap_ai_chat_history');
    setCheckedGearItems({});
    setShowClearConfirm(false);
    triggerToast('Đã làm mới cuộc trò chuyện!');
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(removeEmojis(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleGearCheck = (itemKey: string) => {
    setCheckedGearItems((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  // Pure SVG icon selector for quick prompt chips
  const getPromptSvgIcon = (promptText: string) => {
    const p = promptText.toLowerCase();
    if (p.includes('cứu hộ') || p.includes('khẩn cấp') || p.includes('sốc độ cao') || p.includes('lạc đường')) {
      return <IconShieldAlert size={14} color="#ef4444" />;
    }
    if (p.includes('săn mây') || p.includes('fansipan') || p.includes('lảo thẩn') || p.includes('tà xùa') || p.includes('chill')) {
      return <IconMountain size={14} color="var(--color-sky)" />;
    }
    if (p.includes('thể lực') || p.includes('tập luyện') || p.includes('balo') || p.includes('suối') || p.includes('thác')) {
      return <IconHiking size={14} color="var(--color-primary)" />;
    }
    return <IconCompass size={14} color="var(--color-sky)" />;
  };

  /**
   * Refined inline markdown parser without aggressive neon styling.
   * Bold text is cleanly bolded in main text color, code is subtly badge-highlighted.
   */
  const renderInlineContent = (text: string, isUser: boolean): React.ReactNode => {
    // Regex matches **bold**, `code`, and "quoted" phrases
    const tokenRegex = /(\*\*.*?\*\*|`.*?`)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // 1. Bold text: **content**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={index}
            style={{
              color: isUser ? '#070d1e' : 'var(--color-text-main)',
              fontWeight: 700,
            }}
          >
            {inner}
          </strong>
        );
      }

      // 2. Inline code: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const code = part.slice(1, -1);
        return (
          <code
            key={index}
            style={{
              background: isUser ? 'rgba(0,0,0,0.15)' : 'rgba(255, 255, 255, 0.08)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.84em',
              fontFamily: 'monospace',
              color: isUser ? '#070d1e' : 'var(--color-sky)',
              border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {code}
          </code>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  /**
   * Normalize formatting: ensures lists and headers have clean line breaks,
   * avoiding "wall of text" and broken formatting.
   */
  const normalizeContent = (raw: string): string => {
    if (!raw) return '';
    let text = removeEmojis(raw);

    // Normalize unicode dashes (–, —) at line beginnings to regular bullet "-"
    text = text.replace(/^[–—]\s+/gm, '- ');

    // Break before numbered items if clumped: "sau đây: 1. Mục..." -> "sau đây:\n1. Mục..."
    text = text.replace(/([^\n])\s+(\d+\.\s+[A-ZĐÀ-Ỹa-zđà-ỹ])/g, '$1\n$2');

    // Break before bullet items only if clumped after sentence endings (: or . or !): "vùng: - Núi..." -> "vùng:\n- Núi..."
    text = text.replace(/([.:!])\s+([–—-]\s+[*A-ZĐÀ-Ỹ])/g, '$1\n$2');

    // Break before markdown headers if clumped
    text = text.replace(/([^\n])\s+(#{1,4}\s+)/g, '$1\n\n$2');

    // Remove 3+ consecutive newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  };

  /**
   * Structured message renderer that creates clean paragraphs, lists, and headings.
   */
  const renderStructuredMessage = (rawText: string, isUser: boolean) => {
    const text = normalizeContent(rawText);
    const lines = text.split('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={lineIdx} style={{ height: 4 }} />;
          }

          // Header: ### / ## / #
          if (trimmed.startsWith('#')) {
            const headerText = trimmed.replace(/^#{1,4}\s*/, '');
            return (
              <div
                key={lineIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                  marginBottom: 4,
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  color: isUser ? '#070d1e' : 'var(--color-sky)',
                  letterSpacing: '-0.01em',
                }}
              >
                <span
                  style={{
                    width: 3,
                    height: 14,
                    borderRadius: 2,
                    background: isUser ? '#070d1e' : 'var(--color-sky)',
                    flexShrink: 0,
                  }}
                />
                <span>{renderInlineContent(headerText, isUser)}</span>
              </div>
            );
          }

          // Bullet List Item: - ... or * ... or • ...
          const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
          if (bulletMatch) {
            return (
              <div
                key={lineIdx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  margin: '2px 0',
                  paddingLeft: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: isUser ? '#070d1e' : 'var(--color-primary)',
                    marginTop: 8,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    fontSize: '0.875rem',
                    lineHeight: 1.62,
                    color: isUser ? '#070d1e' : 'var(--color-text-muted)',
                  }}
                >
                  {renderInlineContent(bulletMatch[1], isUser)}
                </div>
              </div>
            );
          }

          // Numbered List Item: 1. ...
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            return (
              <div
                key={lineIdx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  margin: '4px 0',
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isUser ? 'rgba(0,0,0,0.2)' : 'rgba(74, 222, 128, 0.15)',
                    color: isUser ? '#070d1e' : 'var(--color-primary)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  {numMatch[1]}
                </span>
                <div
                  style={{
                    flex: 1,
                    fontSize: '0.875rem',
                    lineHeight: 1.62,
                    color: isUser ? '#070d1e' : 'var(--color-text-muted)',
                  }}
                >
                  {renderInlineContent(numMatch[2], isUser)}
                </div>
              </div>
            );
          }

          // Horizontal divider: ---
          if (trimmed === '---') {
            return (
              <div
                key={lineIdx}
                style={{
                  borderBottom: isUser ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(255,255,255,0.08)',
                  margin: '8px 0',
                }}
              />
            );
          }

          // Standard paragraph
          return (
            <p
              key={lineIdx}
              style={{
                margin: '3px 0',
                fontSize: '0.875rem',
                lineHeight: 1.65,
                color: isUser ? '#070d1e' : 'var(--color-text-muted)',
              }}
            >
              {renderInlineContent(trimmed, isUser)}
            </p>
          );
        })}
      </div>
    );
  };

  /**
   * Action Card Renderer: Renders Trail Card, SOS Alert, and Gear Checklist
   */
  const renderActionCard = (act: AiAssistantAction, actIdx: number) => {
    // 1. Trail Card Action (Alpine Expedition Showcase Card)
    if (act.type === 'trail_card' && act.trailData) {
      const t = act.trailData;
      return (
        <div
          key={actIdx}
          style={{
            marginTop: 10,
            background: 'linear-gradient(180deg, rgba(20, 32, 58, 0.95) 0%, rgba(12, 20, 38, 0.98) 100%)',
            border: '1px solid rgba(74, 222, 128, 0.35)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 20px rgba(74, 222, 128, 0.1)',
          }}
        >
          <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            {t.coverImage ? (
              <img
                src={t.coverImage}
                alt={t.name || 'Trail'}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 10,
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconMountain size={28} color="var(--color-primary)" />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--color-text-main)',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {t.name}
              </h4>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '2px 7px',
                    borderRadius: 6,
                    color: 'var(--color-text-dim)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <IconMapPin size={11} /> {t.province}
                </span>

                <span
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(74, 222, 128, 0.12)',
                    padding: '2px 7px',
                    borderRadius: 6,
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <IconMountain size={11} /> {t.maxAltitudeM}m
                </span>

                <span
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(56, 189, 248, 0.12)',
                    padding: '2px 7px',
                    borderRadius: 6,
                    color: 'var(--color-sky)',
                    fontWeight: 600,
                  }}
                >
                  {t.distanceKm} km
                </span>
              </div>
            </div>
          </div>

          {onSelectTrail && act.trailId && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                Độ khó: {t.difficultyLevel}/5
              </span>

              <button
                type="button"
                onClick={() => {
                  onSelectTrail(act.trailId!);
                  onClose();
                }}
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                  color: '#070d1e',
                  border: 'none',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 2px 8px rgba(74, 222, 128, 0.35)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 222, 128, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(74, 222, 128, 0.35)';
                }}
              >
                <IconCompass size={13} color="#070d1e" />
                Mở trên Bản Đồ 3D
              </button>
            </div>
          )}
        </div>
      );
    }

    // 2. Emergency SOS Action Card
    if (act.type === 'emergency_sos' && act.emergencyContacts) {
      return (
        <div
          key={actIdx}
          style={{
            marginTop: 10,
            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(15, 24, 46, 0.95) 100%)',
            border: '1.5px solid #ef4444',
            borderRadius: 12,
            padding: 12,
            boxShadow: '0 6px 20px rgba(239, 68, 68, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#f87171' }}>
            <IconShieldAlert size={16} color="#ef4444" />
            <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
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
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <IconPhoneCall size={12} color="#ffffff" />
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
            marginTop: 10,
            background: 'rgba(15, 24, 46, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-sky)', fontSize: '0.8rem', fontWeight: 700 }}>
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
                padding: '2px 8px',
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
                  <IconCheck size={11} color="var(--color-primary)" /> Đã chép
                </>
              ) : (
                <>
                  <IconCopy size={11} /> Sao chép
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {act.checklistItems.map((cat, catIdx) => (
              <div key={catIdx}>
                <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
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
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 9998,
            transition: 'opacity 0.25s ease',
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cửa sổ Trợ Lý Hỏi Đáp AI TrekCopilot"
        style={{
          position: 'fixed',
          bottom: isExpanded ? 'calc((100vh - min(880px, calc(100vh - 40px))) / 2)' : '24px',
          right: isExpanded ? 'calc((100vw - min(1120px, calc(100vw - 40px))) / 2)' : '24px',
          zIndex: 9999,
          width: isExpanded ? 'min(1120px, calc(100vw - 40px))' : '440px',
          maxWidth: 'calc(100vw - 32px)',
          height: isExpanded ? 'min(880px, calc(100vh - 40px))' : '620px',
          maxHeight: 'calc(100vh - 40px)',
          background: 'rgba(11, 19, 38, 0.96)',
          borderRadius: 20,
          border: isExpanded ? '1px solid rgba(74, 222, 128, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isExpanded
            ? '0 30px 80px rgba(0, 0, 0, 0.85), 0 0 50px rgba(74, 222, 128, 0.2)'
            : '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(74, 222, 128, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: 'blur(24px)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Refined Header */}
        <div
          style={{
            padding: '14px 18px',
            background: 'linear-gradient(180deg, rgba(74, 222, 128, 0.08) 0%, rgba(15, 24, 46, 0.9) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                color: '#070d1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px rgba(74, 222, 128, 0.35)',
                flexShrink: 0,
              }}
            >
              <IconBot size={20} color="#070d1e" />
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid #0b1326',
                  boxShadow: '0 0 6px #22c55e',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '0.96rem',
                    color: 'var(--color-text-main)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Hỏi Đáp AI
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: engineMode === 'gemini' && geminiApiKey ? 'rgba(56, 189, 248, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                    color: engineMode === 'gemini' && geminiApiKey ? 'var(--color-sky)' : 'var(--color-primary)',
                    border: engineMode === 'gemini' && geminiApiKey ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(74, 222, 128, 0.3)',
                  }}
                >
                  {engineMode === 'gemini' && geminiApiKey ? 'Gemini 3.6' : 'AI Thực Địa'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--color-text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 1,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Trực tuyến • Sẵn sàng hỗ trợ
              </div>
            </div>
          </div>

          {/* Clean 4 Header Control SVGs with Full Functionality */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* SVG 1: Settings */}
            <button
              type="button"
              onClick={() => {
                setShowSettings((prev) => !prev);
                setShowClearConfirm(false);
              }}
              title={showSettings ? 'Đóng cài đặt & về cuộc trò chuyện' : 'Cài đặt mô hình AI & khu vực'}
              aria-label="Cài đặt mô hình AI"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: showSettings ? 'rgba(74, 222, 128, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                border: showSettings ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: showSettings ? 'var(--color-primary)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <IconSettings size={16} />
            </button>

            {/* SVG 2: Trash / Clear Chat */}
            <button
              type="button"
              onClick={() => {
                setShowClearConfirm(true);
                setShowSettings(false);
              }}
              title="Làm mới cuộc trò chuyện"
              aria-label="Làm mới cuộc trò chuyện"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: showClearConfirm ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                border: showClearConfirm ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: showClearConfirm ? '#ef4444' : 'var(--color-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!showClearConfirm) {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showClearConfirm) {
                  e.currentTarget.style.color = 'var(--color-text-dim)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }
              }}
            >
              <IconTrash size={16} />
            </button>

            {/* SVG 3: Maximize / Minimize Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Thu nhỏ cửa sổ (Esc)' : 'Phóng to toàn màn hình'}
              aria-label={isExpanded ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: isExpanded ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: isExpanded ? 'var(--color-sky)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {isExpanded ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
            </button>

            {/* SVG 4: Close Pure SVG */}
            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ (Esc)"
              aria-label="Đóng cửa sổ Hỏi Đáp AI"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--color-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-dim)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Dynamic Toast Feedback */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: 68,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 35,
              background: 'rgba(15, 24, 46, 0.96)',
              border: '1px solid var(--color-primary)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(74, 222, 128, 0.3)',
              color: 'var(--color-primary)',
              padding: '7px 18px',
              borderRadius: 9999,
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'none',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <IconCheck size={14} color="var(--color-primary)" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Inline Confirmation Dialog for Clear History (Trash SVG Button) */}
        {showClearConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 30,
              background: 'rgba(7, 13, 30, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(24, 34, 60, 0.98) 0%, rgba(13, 20, 38, 0.98) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 16,
                padding: 24,
                maxWidth: 360,
                width: '100%',
                boxShadow: '0 24px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.2)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <IconTrash size={22} color="#ef4444" />
              </div>

              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Xóa Lịch Sử Trò Chuyện?
              </h3>

              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Toàn bộ tin nhắn trao đổi hiện tại sẽ được xóa và đặt lại về màn hình chào đón ban đầu.
              </p>

              <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel (Gear SVG Button) */}
        {showSettings ? (
          <div
            style={{
              flex: 1,
              padding: isExpanded ? '24px 32px' : 20,
              maxWidth: isExpanded ? 820 : '100%',
              margin: isExpanded ? '0 auto' : '0',
              width: '100%',
              boxSizing: 'border-box',
              overflowY: 'auto',
              background: 'rgba(11, 19, 38, 0.98)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header of Settings */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)' }}>
                <IconSettings size={18} color="var(--color-primary)" />
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>
                  Cài Đặt TrekCopilot AI
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--color-text-main)',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ← Quay lại chat
              </button>
            </div>

            {/* Section 1: Preferred Region / Location Context */}
            <div
              style={{
                background: 'rgba(15, 24, 46, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconMapPin size={15} color="var(--color-primary)" />
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Khu Vực Ưu Tiên Mặc Định (Vị Trí Của Bạn)
                </label>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Khi bạn hỏi các câu như <em>"tìm con suối gần tôi"</em>, AI sẽ ưu tiên gợi ý các địa điểm thuộc đúng khu vực bạn đã chọn:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isExpanded ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { id: 'danang', label: 'Đà Nẵng & Miền Trung', desc: 'Giếng Trời, Khe Ram, Bạch Mã, K50...' },
                  { id: 'north', label: 'Hà Nội & Miền Bắc', desc: 'Fansipan, Tà Xùa, Lảo Thẩn, Cửa Tử...' },
                  { id: 'south', label: 'TP.HCM & Nam Bộ', desc: 'Núi Dinh, Bà Đen, Chứa Chan...' },
                  { id: 'auto', label: 'Tự động (GPS)', desc: 'Theo định vị thời gian thực từ thiết bị' },
                ].map((r) => {
                  const isSelected = preferredRegion === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setPreferredRegion(r.id);
                        localStorage.setItem('trekmap_preferred_region', r.id);
                        triggerToast(`Đã chọn vị trí: ${r.label}`);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                        {r.label}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', lineHeight: 1.3 }}>
                        {r.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: AI Engine Mode */}
            <div
              style={{
                background: 'rgba(15, 24, 46, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCpu size={15} color="var(--color-sky)" />
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Chế Độ Mô Hình AI
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isExpanded ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div
                  onClick={() => {
                    setEngineMode('knowledge');
                    localStorage.setItem('trekmap_engine_mode', 'knowledge');
                    triggerToast('Đã kích hoạt Tri thức Thực địa TrekMap');
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: engineMode === 'knowledge' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: engineMode === 'knowledge' ? '1.5px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--color-primary)' }}>
                      Tri Thức Thực Địa TrekMap
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(74, 222, 128, 0.2)', color: 'var(--color-primary)' }}>
                      Khuyên Dùng • 0ms
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                    Dữ liệu 100% thực tế về 25 đỉnh núi & suối thác Việt Nam, hoạt động mượt mà offline không cần mạng internet.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setEngineMode('gemini');
                    localStorage.setItem('trekmap_engine_mode', 'gemini');
                    triggerToast('Đã kích hoạt Google Gemini Live');
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: engineMode === 'gemini' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: engineMode === 'gemini' ? '1.5px solid var(--color-sky)' : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--color-sky)' }}>
                      Google Gemini Live AI
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.2)', color: 'var(--color-sky)' }}>
                      Điện Toán Đám Mây
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                    Trò chuyện tự nhiên và linh hoạt qua API Gemini từ Google (yêu cầu kết nối mạng và khóa API).
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Gemini API Key Config */}
            <div
              style={{
                background: 'rgba(15, 24, 46, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Google Gemini API Key (Tùy chọn)
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.74rem', color: 'var(--color-sky)', textDecoration: 'underline' }}
                >
                  Lấy API Key miễn phí tại Google AI Studio
                </a>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showApiKeyText ? 'text' : 'password'}
                  defaultValue={geminiApiKey}
                  id="gemini-key-input"
                  placeholder="Nhập khóa API Gemini..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    padding: '9px 40px 9px 12px',
                    color: 'var(--color-text-main)',
                    fontSize: '0.84rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeyText(!showApiKeyText)}
                  title={showApiKeyText ? 'Ẩn khóa' : 'Hiện khóa'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-dim)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showApiKeyText ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                {geminiApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveApiKey('');
                      const input = document.getElementById('gemini-key-input') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Xóa Key
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('gemini-key-input') as HTMLInputElement;
                    if (input) handleSaveApiKey(input.value);
                  }}
                  style={{
                    background: keySaveSuccess ? 'var(--color-primary)' : 'var(--color-sky)',
                    color: '#070d1e',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {keySaveSuccess ? 'Đã lưu thành công!' : 'Lưu API Key'}
                </button>
              </div>
            </div>
          </div>
        ) : (
        <>
          {/* Context Banner if viewing trail */}
          {currentTrail && (
            <div
              style={{
                padding: '8px 16px',
                background: 'rgba(56, 189, 248, 0.1)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: '0.76rem',
                color: 'var(--color-sky)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <IconMountain size={13} color="var(--color-sky)" />
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
                  borderRadius: 10,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Hỏi về cung này
              </button>
            </div>
          )}

          {/* Unified Chat Log Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 3,
                }}
              >
                {/* Assistant Label */}
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4, marginBottom: 2 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: 'rgba(74, 222, 128, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconBot size={11} color="var(--color-primary)" />
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                      TrekCopilot
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>•</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>{msg.timestamp}</span>
                  </div>
                )}

                {/* Bubble Container */}
                <div
                  style={{
                    maxWidth: msg.role === 'user' ? '86%' : '96%',
                    padding: msg.role === 'user' ? '10px 14px' : '14px 16px',
                    borderRadius:
                      msg.role === 'user' ? '16px 16px 4px 16px' : '14px 14px 14px 4px',
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)'
                        : 'rgba(15, 24, 46, 0.75)',
                    color: msg.role === 'user' ? '#070d1e' : 'var(--color-text-muted)',
                    border:
                      msg.role === 'user'
                        ? 'none'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.875rem',
                    lineHeight: 1.62,
                    boxShadow:
                      msg.role === 'user'
                        ? '0 4px 14px rgba(74, 222, 128, 0.25)'
                        : '0 4px 16px rgba(0, 0, 0, 0.2)',
                    wordBreak: 'break-word',
                  }}
                >
                  {/* Message Content */}
                  {renderStructuredMessage(msg.content, msg.role === 'user')}

                  {/* Attached Action Cards (Trail Card, SOS, Checklist) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      {msg.actions.map((act, actIdx) => renderActionCard(act, actIdx))}
                    </div>
                  )}
                </div>

                {/* User timestamp */}
                {msg.role === 'user' && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', paddingRight: 4 }}>
                    {msg.timestamp}
                  </span>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconBot size={14} color="var(--color-primary)" />
                </div>
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '14px 14px 14px 4px',
                    background: 'rgba(15, 24, 46, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
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

          {/* Quick Prompts Suggestions Carousel (Clean, no ugly scrollbar) */}
          {quickPrompts.length > 0 && (
            <div
              style={{
                padding: '6px 14px',
                background: 'rgba(11, 19, 38, 0.85)',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
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
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--color-text-muted)',
                      borderRadius: 9999,
                      padding: '5px 12px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(74, 222, 128, 0.12)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                      e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                  >
                    {getPromptSvgIcon(cleanPrompt)}
                    <span>{cleanPrompt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Unified Input Prompt Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: '10px 14px',
              background: 'rgba(9, 15, 30, 0.98)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
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
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 22,
                padding: '9px 16px',
                color: 'var(--color-text-main)',
                fontSize: '0.85rem',
                outline: 'none',
                fontFamily: 'var(--font-family)',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(74, 222, 128, 0.25)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />

            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              aria-label="Gửi tin nhắn"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: inputQuery.trim() && !isLoading ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: inputQuery.trim() && !isLoading ? '#070d1e' : 'var(--color-text-dim)',
                border: 'none',
                cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                boxShadow: inputQuery.trim() && !isLoading ? '0 3px 12px rgba(74, 222, 128, 0.4)' : 'none',
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
    </>,
    document.body
  );
};
