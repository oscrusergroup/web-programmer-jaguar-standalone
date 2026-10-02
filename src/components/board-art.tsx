export function BoardArt({ active }: { active: boolean }) {
  return <svg viewBox="0 0 530 350" className="board-art" role="img" aria-label="Illustration of an Arduino Mega 2560 board">
    <defs>
      <linearGradient id="pcb" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#277b86"/><stop offset="1" stopColor="#135362"/></linearGradient>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eef3f4"/><stop offset=".45" stopColor="#a9b9c2"/><stop offset="1" stopColor="#e3eaed"/></linearGradient>
      <filter id="shadow" x="-30%" y="-40%" width="170%" height="200%"><feDropShadow dx="0" dy="19" stdDeviation="15" floodColor="#193b47" floodOpacity=".16"/></filter>
    </defs>
    <g transform="translate(53 46) rotate(-8 220 125)" filter="url(#shadow)">
      <path d="M25 8h375l18 18v221l-18 18H25Q12 265 12 252V21Q12 8 25 8" fill="#103f4b"/>
      <path d="M25 3h375l18 18v221l-18 18H25Q12 260 12 247V16Q12 3 25 3" fill="url(#pcb)" stroke="#3f8e98" strokeWidth="2"/>
      <g fill="none" stroke="#63adad" strokeWidth="1" opacity=".35">
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${165+i*5} 42v${22+i*3}l${30-i*2} 30v30M${160+i*5} 222v-${25+i*3}l${33-i*2} -30v-24`}/>)}
        <path d="M74 54h65l30 30M75 62h60l30 30M75 70h56l30 30M75 177h65l25-25M76 185h60l25-25M286 121h55l35-35M286 132h63l26-26M284 148h65l26 26M110 214h33l30-30"/>
      </g>
      {[ [29,20], [393,25], [29,243], [395,240] ].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="7" fill="#bdd4d5"/><circle cx={x} cy={y} r="3.8" fill="#edf2f3"/></g>)}
      <g transform="translate(90 20)"><rect width="260" height="22" rx="2" fill="#13232a"/>{Array.from({length: 30},(_,i)=><rect key={i} x={5+i*8.4} y="6" width="4.8" height="8" fill="#566168"/>)}<rect y="-2" width="260" height="5" fill="#34474d"/></g>
      <g transform="translate(92 224)"><rect width="260" height="22" rx="2" fill="#13232a"/>{Array.from({length: 30},(_,i)=><rect key={i} x={5+i*8.4} y="6" width="4.8" height="8" fill="#566168"/>)}<rect y="-2" width="260" height="5" fill="#34474d"/></g>
      <g transform="translate(377 64)"><rect width="24" height="146" rx="2" fill="#13232a"/>{Array.from({length:16},(_,i)=><g key={i} fill="#677279"><rect x="4" y={5+i*8.5} width="5" height="4.5"/><rect x="15" y={5+i*8.5} width="5" height="4.5"/></g>)}</g>
      <g transform="translate(187 88)">
        {Array.from({length:16},(_,i)=><g key={i} fill="#b6c5ca"><rect x={3+i*4.4} y="-8" width="2.4" height="10"/><rect x={3+i*4.4} y="75" width="2.4" height="10"/><rect x="-8" y={3+i*4.4} width="10" height="2.4"/><rect x="75" y={3+i*4.4} width="10" height="2.4"/></g>)}
        <rect width="77" height="77" rx="3" fill="#182930" stroke="#495e63"/>
        <circle cx="8" cy="8" r="2" fill="#677a7e"/>
        <text x="38" y="31" textAnchor="middle" fill="#8b9c9f" fontSize="9" fontFamily="monospace">ATMEL</text>
        <text x="38" y="46" textAnchor="middle" fill="#8b9c9f" fontSize="7" fontFamily="monospace">ATMEGA2560</text>
        <text x="38" y="60" textAnchor="middle" fill="#60767b" fontSize="6" fontFamily="monospace">16AU</text>
      </g>
      <g transform="translate(-4 67)"><rect width="71" height="65" rx="3" fill="#829aa6"/><rect y="-4" width="71" height="62" rx="3" fill="url(#metal)" stroke="#c7d6dc"/><path d="M0 6h22v45H0" fill="#56717e"/><rect x="-2" y="12" width="21" height="33" rx="2" fill="#263c48"/><rect x="2" y="17" width="12" height="23" fill="#b5c4cc"/><path d="M33 7h24v6H33m0 30h24v6H33" stroke="#8ca1ab" fill="none"/></g>
      <g transform="translate(14 174)"><rect y="3" width="60" height="41" rx="4" fill="#15252e"/><rect width="60" height="37" rx="4" fill="#263742"/><ellipse cx="7" cy="18" rx="10" ry="16" fill="#111f27"/><ellipse cx="5" cy="18" rx="5" ry="8" fill="#72878c"/></g>
      <rect x="101" y="92" width="33" height="33" rx="2" fill="#23353d"/>
      <g fill="#b7c8cb">{Array.from({length:7},(_,i)=><g key={i}><rect x={102+i*4.4} y="86" width="2" height="6"/><rect x={102+i*4.4} y="125" width="2" height="6"/></g>)}</g>
      <rect x="98" y="151" width="31" height="11" rx="5" fill="url(#metal)"/>
      <g transform="translate(49 36)"><rect width="23" height="21" fill="#c6ced0"/><circle cx="11.5" cy="10.5" r="7" fill="#87575d"/><circle cx="11.5" cy="10.5" r="4" fill="#d39a9d"/></g>
      <g fill="#d8cfb7">{[ [147,67], [153,183], [304,86], [317,154], [300,181], [84,144] ].map(([x,y],i)=><g key={i}><rect x={x} y={y} width="13" height="6"/><rect x={x} y={y} width="3" height="6" fill="#b9c8c9"/><rect x={x+10} y={y} width="3" height="6" fill="#b9c8c9"/></g>)}</g>
      <circle cx="341" cy="195" r="3.5" fill={active ? "#a6edb0" : "#b3a760"}/>
      <text x="293" y="76" fill="#c4e3e2" fontSize="20" fontWeight="700" fontFamily="Arial,sans-serif">MEGA</text>
      <text x="294" y="94" fill="#afd1d2" fontSize="10" letterSpacing="3" fontFamily="Arial,sans-serif">2560</text>
      <text x="146" y="211" fill="#abd1d2" fontSize="7" fontFamily="monospace">POWER</text>
      <text x="277" y="211" fill="#abd1d2" fontSize="7" fontFamily="monospace">ANALOG IN</text>
      <text x="165" y="56" fill="#abd1d2" fontSize="7" fontFamily="monospace">DIGITAL (PWM ~)</text>
      <text x="336" y="199" textAnchor="end" fill="#afd1d2" fontSize="7" fontFamily="monospace">ON</text>
    </g>
  </svg>;
}
