import React, { useState } from 'react';
import { MessageSquare, Send, Bold, Italic, Code, Image as ImageIcon, Smile, Quote, AtSign, Users } from 'lucide-react';

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  nameColor?: string;
  quote?: { author: string; text: string };
  text: string;
  time: string;
}

const initialMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    senderName: 'Hientnenguyen',
    senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    nameColor: '#38bdf8',
    text: 'Cung Tà Xùa cuối tuần này mây bồng bềnh 360 độ luôn nhé anh em!',
    time: 'Hôm nay lúc 18:25',
  },
  {
    id: 'msg-2',
    senderName: 'Nguyễn Thị Hương Lan',
    senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
    nameColor: '#0ed7b5',
    text: 'Tình hình suối trạm Trạm Tôn Fansipan có chảy siết không mọi người?',
    time: 'Hôm nay lúc 18:47',
  },
  {
    id: 'msg-3',
    senderName: 'tryhard_trekker',
    senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    nameColor: '#f43f5e',
    text: 'Sa Pa đang có mưa phùn nhẹ nhưng lán 2800m gió êm lắm, vừa lên trưa nay!',
    time: 'Hôm nay lúc 18:48',
  },
  {
    id: 'msg-4',
    senderName: 'Trương Công Thịnh',
    senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
    nameColor: '#d946ef',
    quote: {
      author: 'tryhard_trekker',
      text: 'Sa Pa đang có mưa phùn nhẹ nhưng lán 2800m gió êm lắm, vừa lên trưa nay!',
    },
    text: 'Thế cần chuẩn bị áo mưa bộ chuyên dụng đúng không bác?',
    time: '9 phút trước',
  },
];

const onlineUsers = [
  { name: 'Hoàng Nguyễn', color: '#0ed7b5', status: 'online' },
  { name: 'Vũ Nguyễn Bình', color: '#38bdf8', status: 'online' },
  { name: 'A Páo (Guide Tà Xùa)', color: '#fbbf24', status: 'online' },
  { name: 'LanAnh_Outdoor', color: '#f43f5e', status: 'online' },
  { name: 'Chảo A Sải', color: '#10b981', status: 'online' },
  { name: 'hahahahah NGan', color: '#a855f7', status: 'online' },
  { name: 'tonny123', color: '#f97316', status: 'online' },
];

export const LiveTrekkerChatroom: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [quoteMessage, setQuoteMessage] = useState<{ author: string; text: string } | null>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: 'Bạn (Trekker Pro)',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      nameColor: '#0ed7b5',
      quote: quoteMessage || undefined,
      text: inputText,
      time: 'Vừa xong',
    };

    setMessages([...messages, newMsg]);
    setInputText('');
    setQuoteMessage(null);
  };

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
      marginBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--color-bg-main)',
        borderBottom: '1px solid var(--color-border)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={20} color="var(--color-primary)" />
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', margin: 0 }}>
            Tán Gẫu Trekker Trực Tuyến
          </h3>
          <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 10px' }}>
            ● 342 Trekker Online
          </span>
        </div>

        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          Phòng chat tự do kinh nghiệm & hỏi đáp nhanh
        </div>
      </div>

      {/* Main Container Grid (Chat stream + Online Members Sidebar) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', minHeight: 380, maxHeight: 480 }}>
        {/* Chat Feed */}
        <div style={{
          padding: 20,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--color-bg-card)',
        }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <img
                src={msg.senderAvatar}
                alt={msg.senderName}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: msg.nameColor || 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      @{msg.senderName}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)', background: 'var(--color-bg-main)', padding: '2px 8px', borderRadius: 10 }}>
                    {msg.time}
                  </span>
                </div>

                {/* Quoted Box */}
                {msg.quote && (
                  <div style={{
                    background: 'var(--color-bg-main)',
                    borderLeft: '3px solid var(--color-primary)',
                    borderRadius: '0 8px 8px 0',
                    padding: '8px 12px',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-muted)',
                    marginBottom: 8,
                  }}>
                    <strong style={{ color: 'var(--color-primary)' }}>{msg.quote.author} đã viết:</strong>
                    <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>{msg.quote.text}</div>
                  </div>
                )}

                {/* Message Text */}
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: 'var(--line-height-normal)' }}>
                  {msg.text}
                </div>

                <button
                  onClick={() => setQuoteMessage({ author: msg.senderName, text: msg.text })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-dim)',
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'pointer',
                    marginTop: 4,
                    padding: 0,
                  }}
                >
                  Trích dẫn trả lời
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Online Members Sidebar */}
        <div style={{
          background: 'var(--color-bg-main)',
          borderLeft: '1px solid var(--color-border)',
          padding: 14,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} /> Thành viên Online
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {onlineUsers.map((u, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-xs)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }} />
                <span style={{ color: u.color, fontWeight: 600 }}>{u.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rich Text Toolbar & Input Area */}
      <form onSubmit={handleSendMessage} style={{
        background: 'var(--color-bg-main)',
        borderTop: '1px solid var(--color-border)',
        padding: 12,
      }}>
        {/* Quoting Banner */}
        {quoteMessage && (
          <div style={{
            background: 'var(--color-bg-card)',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span>Đang trả lời @{quoteMessage.author}: "{quoteMessage.text}"</span>
            <button onClick={() => setQuoteMessage(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Toolbar Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, color: 'var(--color-primary)' }}>
          <span title="In đậm" style={{ cursor: 'pointer', display: 'inline-flex' }}><Bold size={15} /></span>
          <span title="In nghiêng" style={{ cursor: 'pointer', display: 'inline-flex' }}><Italic size={15} /></span>
          <span title="Mã nguồn" style={{ cursor: 'pointer', display: 'inline-flex' }}><Code size={15} /></span>
          <span title="Trích dẫn" style={{ cursor: 'pointer', display: 'inline-flex' }}><Quote size={15} /></span>
          <span title="Nhắc tên người dùng" style={{ cursor: 'pointer', display: 'inline-flex' }}><AtSign size={15} /></span>
          <span title="Đính kèm ảnh" style={{ cursor: 'pointer', display: 'inline-flex' }}><ImageIcon size={15} /></span>
          <span title="Biểu cảm" style={{ cursor: 'pointer', display: 'inline-flex' }}><Smile size={15} /></span>
        </div>

        {/* Input Text Box + Send Button */}
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Nhập tin nhắn tán gẫu cùng cộng đồng trekker..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--color-text-main)',
              fontSize: 'var(--font-size-sm)',
              outline: 'none',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
            <Send size={16} /> Gửi
          </button>
        </div>
      </form>
    </div>
  );
};
