import React from 'react';
import { removeEmojis } from '../../services/aiAssistant.service.js';

interface AiMarkdownRendererProps {
  content: string;
  isUser: boolean;
}

/**
 * Parses **bold**, *italic*, and `inline code` cleanly using strict Dual-Theme CSS tokens.
 */
function renderInlineTokens(text: string, isUser: boolean): React.ReactNode {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong
          key={idx}
          style={{
            color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-main)',
            fontWeight: 700,
          }}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3 && !part.startsWith('**')) {
      return (
        <em
          key={idx}
          style={{
            color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
            fontStyle: 'italic',
          }}
        >
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          style={{
            background: isUser
              ? 'color-mix(in srgb, var(--color-on-primary) 16%, transparent)'
              : 'var(--color-surface-elevated)',
            padding: '1px 5px',
            borderRadius: 4,
            fontSize: '0.83em',
            fontFamily: 'var(--font-family)',
            fontWeight: 700,
            color: isUser ? 'var(--color-on-primary)' : 'var(--color-sky)',
            border: isUser ? 'none' : '1px solid var(--color-border)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function normalizeMarkdown(raw: string): string {
  if (!raw) return '';
  let text = removeEmojis(raw);
  text = text.replace(/^[–—]\s+/gm, '- ');
  text = text.replace(/([^\n])\s+(#{1,4}\s+)/g, '$1\n\n$2');
  // Split clumped numbered list items like "1. **A** 2. **B**" safely without breaking "ngày 1. Sáng..."
  text = text.replace(/(:)\s+(\d+\.\s+(?:\*\*|[A-ZĐÀ-Ỹ]))/g, '$1\n$2');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export const AiMarkdownRenderer: React.FC<AiMarkdownRendererProps> = ({ content, isUser }) => {
  const normalized = normalizeMarkdown(content);
  const rawLines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push(<div key={`sp-${i}`} style={{ height: 4 }} />);
      i++;
      continue;
    }

    // GFM Table block detection (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < rawLines.length && /^\|[\s:-]+\|$/.test(rawLines[i + 1].trim().replace(/\|/g, '|'))) {
      const headerCells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      i += 2; // Skip header + separator
      const bodyRows: string[][] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        bodyRows.push(
          rawLines[i]
            .trim()
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );
        i++;
      }

      blocks.push(
        <div
          key={`tbl-${i}`}
          style={{
            overflowX: 'auto',
            margin: '6px 0',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'var(--font-family)' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-elevated)', borderBottom: '1px solid var(--color-border)' }}>
                {headerCells.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    style={{
                      padding: '6px 9px',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {renderInlineTokens(h, false)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: rIdx < bodyRows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '6px 9px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {renderInlineTokens(cell, false)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Horizontal divider
    if (trimmed === '---' || trimmed === '***') {
      blocks.push(
        <div
          key={`hr-${i}`}
          style={{
            borderBottom: isUser
              ? '1px solid color-mix(in srgb, var(--color-on-primary) 25%, transparent)'
              : '1px solid var(--color-border)',
            margin: '6px 0',
          }}
        />
      );
      i++;
      continue;
    }

    // Heading (# / ## / ###)
    if (trimmed.startsWith('#')) {
      const headerText = trimmed.replace(/^#{1,4}\s*/, '');
      blocks.push(
        <div
          key={`hd-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            marginBottom: 2,
            fontWeight: 800,
            fontSize: '0.9rem',
            color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-main)',
            letterSpacing: '-0.01em',
          }}
        >
          <span
            style={{
              width: 3,
              height: 14,
              borderRadius: 2,
              background: isUser ? 'var(--color-on-primary)' : 'var(--color-primary)',
              flexShrink: 0,
            }}
          />
          <span>{renderInlineTokens(headerText, isUser)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Bullet List Item (preserves indentation depth for nested bullets)
    const leadingSpaces = line.length - line.trimStart().length;
    const indentLevel = leadingSpaces >= 2 ? 1 : 0;
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push(
        <div
          key={`bl-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            margin: '1px 0',
            paddingLeft: indentLevel ? 18 : 4,
          }}
        >
          <span
            style={{
              width: indentLevel ? 4 : 5,
              height: indentLevel ? 4 : 5,
              borderRadius: '50%',
              background: isUser
                ? 'var(--color-on-primary)'
                : indentLevel
                ? 'var(--color-sky)'
                : 'var(--color-primary)',
              marginTop: 8,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              fontSize: '0.86rem',
              lineHeight: 1.6,
              color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
            }}
          >
            {renderInlineTokens(bulletMatch[1], isUser)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Numbered List Item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push(
        <div
          key={`nm-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            margin: '2px 0',
            paddingLeft: 2,
          }}
        >
          <span
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 4,
              background: isUser
                ? 'color-mix(in srgb, var(--color-on-primary) 18%, transparent)'
                : 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
              color: isUser ? 'var(--color-on-primary)' : 'var(--color-primary)',
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 2,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {numMatch[1]}
          </span>
          <div
            style={{
              flex: 1,
              fontSize: '0.86rem',
              lineHeight: 1.6,
              color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
            }}
          >
            {renderInlineTokens(numMatch[2], isUser)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Standard Paragraph
    blocks.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '2px 0',
          fontSize: '0.86rem',
          lineHeight: 1.62,
          color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
        }}
      >
        {renderInlineTokens(trimmed, isUser)}
      </p>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{blocks}</div>;
};
