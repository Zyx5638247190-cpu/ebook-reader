interface DragonMascotProps {
  className?: string
  mood?: 'happy' | 'sleepy'
}

export function DragonMascot({ className = '', mood = 'happy' }: DragonMascotProps) {
  return (
    <svg
      viewBox="0 0 240 220"
      role="img"
      aria-label="奶龙"
      className={`mascot ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="120" cy="203" rx="64" ry="10" fill="#E9D9AE" opacity="0.55" />

      {/* 尾巴 */}
      <path
        d="M168 158 C198 166 214 144 203 121"
        fill="none"
        stroke="#FFCA28"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M198 131 C210 128 214 112 204 105 C196 100 188 108 191 117 Z"
        fill="#F9A825"
      />

      {/* 身体与手脚 */}
      <ellipse cx="120" cy="152" rx="57" ry="45" fill="#FFD54F" stroke="#F0B02A" strokeWidth="3" />
      <ellipse cx="120" cy="160" rx="33" ry="30" fill="#FFF4C9" />
      <ellipse cx="92" cy="192" rx="18" ry="9" fill="#FFCA28" stroke="#F0B02A" strokeWidth="2.5" />
      <ellipse cx="148" cy="192" rx="18" ry="9" fill="#FFCA28" stroke="#F0B02A" strokeWidth="2.5" />
      <ellipse cx="66" cy="150" rx="13" ry="18" fill="#FFD54F" stroke="#F0B02A" strokeWidth="2.5" />
      <ellipse cx="174" cy="150" rx="13" ry="18" fill="#FFD54F" stroke="#F0B02A" strokeWidth="2.5" />

      {/* 犄角 */}
      <path d="M79 50 C68 30 78 14 94 12 C92 28 97 38 106 45 Z" fill="#F9A825" />
      <path d="M161 50 C172 30 162 14 146 12 C148 28 143 38 134 45 Z" fill="#F9A825" />

      {/* 头 */}
      <circle cx="120" cy="93" r="55" fill="#FFE082" stroke="#F0B02A" strokeWidth="3" />

      {/* 腮红 */}
      <ellipse cx="79" cy="106" rx="10" ry="6" fill="#FF9E80" opacity="0.55" />
      <ellipse cx="161" cy="106" rx="10" ry="6" fill="#FF9E80" opacity="0.55" />

      {mood === 'sleepy' ? (
        <>
          <path
            d="M90 93 Q100 84 110 93"
            fill="none"
            stroke="#3A3226"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M130 93 Q140 84 150 93"
            fill="none"
            stroke="#3A3226"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <ellipse cx="120" cy="112" rx="7" ry="5" fill="#3A3226" opacity="0.82" />
        </>
      ) : (
        <>
          <ellipse cx="99" cy="93" rx="8" ry="10" fill="#3A3226" />
          <ellipse cx="141" cy="93" rx="8" ry="10" fill="#3A3226" />
          <circle cx="101.8" cy="89.5" r="2.6" fill="#FFFFFF" />
          <circle cx="143.8" cy="89.5" r="2.6" fill="#FFFFFF" />
          <path
            d="M110 110 Q120 120 130 110"
            fill="none"
            stroke="#3A3226"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}
