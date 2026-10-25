export function Icon({ name, size = 18 }: { name: 'arrow' | 'play' | 'pause' | 'skip' | 'reset' | 'close' | 'layers' | 'fire' | 'power' | 'check' | 'info'; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    skip: <path d="m5 5 11 7-11 7ZM19 5v14" />,
    reset: <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    layers: <path d="m12 3 10 6-10 6L2 9ZM2 15l10 6 10-6" />,
    fire: <path d="M13 3c1 6-5 6-3 10 2-1 3-3 3-5 5 3 7 6 5 10-3 6-12 4-12-2 0-4 5-6 7-13Z" />,
    power: <path d="M12 2v10M6 5a9 9 0 1 0 12 0" />,
    check: <path d="m5 12 4 4L19 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.1" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
