// Icônes Mieru : 24 px, trait 1,75, extrémités rondes, couleur = currentColor.
const PATHS = {
  accueil: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  kakeibo: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /><path d="M9 8h6" /></>,
  kizuna: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M11 20c0-3 2.5-5 5-5s5 2 5 5" /></>,
  reclamation: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h4" /></>,
  alerte: <><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></>,
  reseau: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  retour: <path d="M15 5l-7 7 7 7" />,
  suite: <path d="M9 5l7 7-7 7" />,
  partager: <><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
  cadenas: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M20 16l-5-5-8 8" /></>,
  son: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></>,
  micro: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></>,
  texte: <><path d="M4 7V5h10v2" /><path d="M9 5v14" /><path d="M7 19h4" /><path d="M14 12v-1h6v1" /><path d="M17 11v8" /><path d="M16 19h2" /></>,
  simulateur:<><rect x="4" y="5" width="16" height="10" rx="2" /><path d="M7 19c1-1 2-1 3 0s2 1 3 0 2-1 3 0" /><path d="M8 10h8" /></>,
};

export default function Icon({ nom, taille = 24, ...rest }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {PATHS[nom]}
    </svg>
  );
}
