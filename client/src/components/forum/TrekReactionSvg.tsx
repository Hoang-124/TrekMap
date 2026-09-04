import React from 'react';

export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'buon' | 'huhu' | 'angry' | 'dislike' | 'sad' | null;

interface SvgIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** 1. LIKE - Huy hiệu Xanh Dương Nút Thích Chuẩn Quốc Tế */
export const IconReactionLike: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="18" cy="18" r="18" fill="#1877F2" />
    <path
      fill="#FFFFFF"
      d="M10 17.5h3.5v10.5H10zm16.5 1.5c0-.8-.7-1.5-1.5-1.5h-5.2l.8-3.8.02-.3c0-.4-.2-.8-.4-1.1L18.7 11 13.9 15.8c-.4.4-.6.9-.6 1.4v8.8c0 1.1.9 2 2 2h7c.8 0 1.5-.5 1.8-1.2l2.6-6.1c.1-.2.2-.4.2-.7v-2.5z"
    />
  </svg>
);

/** 2. LOVE - Huy hiệu Trái Tim Đỏ Hồng Cổ Điển */
export const IconReactionLove: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="18" cy="18" r="18" fill="#F33E58" />
    <path
      fill="#FFFFFF"
      d="M18 28.5s-8.5-5.3-10.5-10.8c-1.6-4.4.8-8.7 5.2-8.7 3 0 4.5 1.8 5.3 3 .8-1.2 2.3-3 5.3-3 4.4 0 6.8 4.3 5.2 8.7-2 5.5-10.5 10.8-10.5 10.8z"
    />
  </svg>
);

/** 3. HAHA - Mặt Cười Tít Mắt Sảng Khoái (Chuẩn Vector Nghệ Sĩ Human-Crafted) */
export const IconReactionHaha: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path fill="#FFCC4D" d="M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18" />
    <path fill="#664500" d="M18 22c-3.623 0-6.027-.422-9-1-.679-.131-2 0-2 2 0 4 4.595 9 11 9 6.404 0 11-5 11-9 0-2-1.321-2.132-2-2-2.973.578-5.377 1-9 1z" />
    <path fill="#FFF" d="M9 23s3 1 9 1 9-1 9-1-2 4-9 4-9-4-9-4z" />
    <path
      fill="#664500"
      d="M6.001 20c-.304 0-.604-.138-.801-.4-.332-.441-.242-1.068.2-1.399.143-.107 2.951-2.183 6.856-2.933C9.781 14.027 7.034 14 6.999 14c-.552-.002-.999-.45-.998-1.002 0-.551.447-.998.999-.998.221 0 5.452.038 8.707 3.293.286.286.372.716.217 1.09-.155.374-.52.617-.924.617-4.613 0-8.363 2.772-8.4 2.8-.18.135-.391.2-.599.2zm23.998-.001c-.208 0-.418-.064-.598-.198C29.363 19.772 25.59 17 21 17c-.404 0-.77-.243-.924-.617-.155-.374-.069-.804.217-1.09C23.549 12.038 28.779 12 29 12c.552 0 .998.447.999.998.001.552-.446 1-.997 1.002-.036 0-2.783.027-5.258 1.268 3.905.75 6.713 2.825 6.855 2.933.441.331.531.956.201 1.398-.196.261-.496.4-.801.4z"
    />
  </svg>
);

/** 4. WOW - Mặt Ngạc Nhiên Tròn Tròn (Biểu Cảm Hài Hòa Tự Nhiên) */
export const IconReactionWow: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path fill="#FFCC4D" d="M36 18c0 9.941-8.059 18-18 18S0 27.941 0 18 8.059 0 18 0s18 8.059 18 18" />
    <path
      fill="#664500"
      d="M9.5 8.5c-.3 0-.5.2-.6.4-.3.6-.1 1.3.5 1.6 1.8.8 3.8.8 5.6 0 .6-.3.8-1 .5-1.6-.3-.6-1-.8-1.6-.5-1.3.5-2.7.5-4 0-.1-.1-.3-.1-.4-.1zm17 0c-.1 0-.3 0-.4.1-1.3.5-2.7.5-4 0-.6-.3-1.3-.1-1.6.5-.3.6-.1 1.3.5 1.6 1.8.8 3.8.8 5.6 0 .6-.3.8-1 .5-1.6-.1-.2-.3-.4-.6-.4z"
    />
    <ellipse fill="#664500" cx="18" cy="25" rx="4" ry="5.5" />
    <ellipse fill="#664500" cx="12" cy="14" rx="2.5" ry="3.5" />
    <ellipse fill="#664500" cx="24" cy="14" rx="2.5" ry="3.5" />
  </svg>
);

/** 5. BUỒN - Mặt Buồn Bã & Giọt Nước Mắt Đồng Cảm (Chân Thật, Giàu Cảm Xúc) */
export const IconReactionBuon: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path fill="#FFCC4D" d="M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18" />
    <ellipse fill="#664500" cx="11.5" cy="17" rx="2.5" ry="3.5" />
    <ellipse fill="#664500" cx="24.5" cy="17" rx="2.5" ry="3.5" />
    <path
      fill="#664500"
      d="M5.999 13.5c-.208 0-.419-.065-.599-.2-.442-.331-.531-.958-.2-1.4 3.262-4.35 7.616-4.4 7.8-4.4.552 0 1 .448 1 1 0 .551-.445.998-.996 1-.155.002-3.568.086-6.204 3.6-.196.262-.497.4-.801.4zm24.002 0c-.305 0-.604-.138-.801-.4-2.641-3.521-6.061-3.599-6.206-3.6-.55-.006-.994-.456-.991-1.005.003-.551.447-.995.997-.995.184 0 4.537.05 7.8 4.4.332.442.242 1.069-.2 1.4-.18.135-.39.2-.599.2zm-6.516 14.879C23.474 28.335 22.34 24 18 24s-5.474 4.335-5.485 4.379c-.053.213.044.431.232.544.188.112.433.086.596-.06C13.352 28.855 14.356 28 18 28c3.59 0 4.617.83 4.656.863.095.09.219.137.344.137.084 0 .169-.021.246-.064.196-.112.294-.339.239-.557z"
    />
    <path fill="#5DADEC" d="M16 31c0 2.762-2.238 5-5 5s-5-2.238-5-5 4-10 5-10 5 7.238 5 10z" />
  </svg>
);

/** 6. HUHU - Khóc Oà Nước Mắt Rơi Suối Nước (Biểu Tượng Cảm Xúc Kinh Điển) */
export const IconReactionHuhu: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path fill="#FFCC4D" d="M36 18c0 9.941-8.059 18-18 18S0 27.941 0 18 8.059 0 18 0s18 8.059 18 18" />
    <path d="M22 27c0 2.763-1.791 3-4 3-2.21 0-4-.237-4-3 0-2.761 1.79-6 4-6 2.209 0 4 3.239 4 6zm8-12c-.124 0-.25-.023-.371-.072-5.229-2.091-7.372-5.241-7.461-5.374-.307-.46-.183-1.081.277-1.387.459-.306 1.077-.184 1.385.274.019.027 1.93 2.785 6.541 4.629.513.206.763.787.558 1.3-.157.392-.533.63-.929.63zM6 15c-.397 0-.772-.238-.929-.629-.205-.513.044-1.095.557-1.3 4.612-1.844 6.523-4.602 6.542-4.629.308-.456.929-.577 1.387-.27.457.308.581.925.275 1.383-.089.133-2.232 3.283-7.46 5.374C6.25 14.977 6.124 15 6 15z" fill="#664500" />
    <path fill="#5DADEC" d="M24 16h4v19l-4-.046V16zM8 35l4-.046V16H8v19z" />
    <path
      fill="#664500"
      d="M14.999 18c-.15 0-.303-.034-.446-.105-3.512-1.756-7.07-.018-7.105 0-.495.249-1.095.046-1.342-.447-.247-.494-.047-1.095.447-1.342.182-.09 4.498-2.197 8.895 0 .494.247.694.848.447 1.342-.176.35-.529.552-.896.552zm14 0c-.15 0-.303-.034-.446-.105-3.513-1.756-7.07-.018-7.105 0-.494.248-1.094.047-1.342-.447-.247-.494-.047-1.095.447-1.342.182-.09 4.501-2.196 8.895 0 .494.247.694.848.447 1.342-.176.35-.529.552-.896.552z"
    />
    <ellipse fill="#5DADEC" cx="18" cy="34" rx="18" ry="2" />
    <ellipse fill="#E75A70" cx="18" cy="27" rx="3" ry="2" />
  </svg>
);

/** 7. ANGRY - Mặt Đỏ Phẫn Nộ (Mày Cau Giận Dữ, Không Robot, Chuẩn Nghệ Sĩ) */
export const IconReactionAngry: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path fill="#DA2F47" d="M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18" />
    <path
      fill="#292F33"
      d="M25.485 29.879C25.44 29.7 24.317 25.5 18 25.5c-6.318 0-7.44 4.2-7.485 4.379-.055.217.043.442.237.554.195.109.439.079.6-.077.019-.019 1.954-1.856 6.648-1.856s6.63 1.837 6.648 1.855c.096.095.224.145.352.145.084 0 .169-.021.246-.064.196-.112.294-.339.239-.557zm-9.778-12.586C12.452 14.038 7.221 14 7 14c-.552 0-.999.447-.999.998-.001.552.446 1 .998 1.002.029 0 1.925.022 3.983.737-.593.64-.982 1.634-.982 2.763 0 1.934 1.119 3.5 2.5 3.5s2.5-1.566 2.5-3.5c0-.174-.019-.34-.037-.507.013 0 .025.007.037.007.256 0 .512-.098.707-.293.391-.391.391-1.023 0-1.414zM29 14c-.221 0-5.451.038-8.707 3.293-.391.391-.391 1.023 0 1.414.195.195.451.293.707.293.013 0 .024-.007.036-.007-.016.167-.036.333-.036.507 0 1.934 1.119 3.5 2.5 3.5s2.5-1.566 2.5-3.5c0-1.129-.389-2.123-.982-2.763 2.058-.715 3.954-.737 3.984-.737.551-.002.998-.45.997-1.002-.001-.551-.447-.998-.999-.998z"
    />
  </svg>
);

/** 8. DISLIKE - Huy hiệu Xám Khói Nút Không Thích Đảo Ngược */
export const IconReactionDislike: React.FC<SvgIconProps> = ({ size = 28, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="18" cy="18" r="18" fill="#475569" />
    <g transform="rotate(180 18 18)">
      <path
        fill="#FFFFFF"
        d="M10 17.5h3.5v10.5H10zm16.5 1.5c0-.8-.7-1.5-1.5-1.5h-5.2l.8-3.8.02-.3c0-.4-.2-.8-.4-1.1L18.7 11 13.9 15.8c-.4.4-.6.9-.6 1.4v8.8c0 1.1.9 2 2 2h7c.8 0 1.5-.5 1.8-1.2l2.6-6.1c.1-.2.2-.4.2-.7v-2.5z"
      />
    </g>
  </svg>
);

/** Unified Dynamic SVG Reaction Component */
export const TrekReactionSvg: React.FC<{
  name: ReactionType | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, size = 28, className, style }) => {
  switch (name) {
    case 'like':
      return <IconReactionLike size={size} className={className} style={style} />;
    case 'love':
      return <IconReactionLove size={size} className={className} style={style} />;
    case 'haha':
      return <IconReactionHaha size={size} className={className} style={style} />;
    case 'wow':
      return <IconReactionWow size={size} className={className} style={style} />;
    case 'buon':
    case 'sad':
      return <IconReactionBuon size={size} className={className} style={style} />;
    case 'huhu':
      return <IconReactionHuhu size={size} className={className} style={style} />;
    case 'angry':
      return <IconReactionAngry size={size} className={className} style={style} />;
    case 'dislike':
      return <IconReactionDislike size={size} className={className} style={style} />;
    default:
      return <IconReactionLike size={size} className={className} style={style} />;
  }
};
