/**
 * Personal Branding header fonts (public/fonts, licenses in public/fonts/FONT-LICENSES.txt), grouped for the picker.
 * Each has <Name>-Medium.ttf (tagline) and <Name>-Bold.ttf (name), except SINGLE_WEIGHT fonts, which only have -Bold.
 * Generated from Google Fonts; to add one, drop its two files in public/fonts and list it here.
 */
/** Fonts every device already has: never fetched from public/fonts. */
export const SYSTEM_FONTS = new Set<string>(["Arial"]);

export const FONT_GROUPS: { group: string; fonts: string[] }[] = [
  // Arial is built into every computer and PDF (drawn as Helvetica in PDFs), so it has no file here.
  { group: "Clean", fonts: ["Arial", "Poppins", "Montserrat", "Inter", "Roboto", "Open Sans", "Lato", "Raleway", "Nunito", "Work Sans", "DM Sans", "Outfit", "Manrope", "Space Grotesk", "Sora", "Urbanist", "Plus Jakarta Sans", "Archivo", "Barlow", "Rubik", "Kanit", "Josefin Sans", "Quicksand", "Exo 2", "Lexend", "Red Hat Display", "Figtree", "Mulish", "Syne", "Unbounded", "Chakra Petch", "Comfortaa", "Fredoka", "Titillium Web", "Ubuntu", "Prompt", "Saira"] },
  { group: "Bold & condensed", fonts: ["Oswald", "Anton", "Bebas Neue", "Archivo Black", "Teko", "Staatliches", "Big Shoulders Display", "Barlow Condensed", "Fjalla One", "Alfa Slab One", "Russo One", "Black Ops One", "Bungee", "Bangers", "Passion One", "Squada One", "Righteous", "Audiowide", "Orbitron", "Monoton", "Michroma", "Press Start 2P", "Rubik Mono One"] },
  { group: "Classic serif", fonts: ["Playfair Display", "Roboto Slab", "Merriweather", "Lora", "Libre Baskerville", "Cormorant Garamond", "EB Garamond", "Cinzel", "DM Serif Display", "Abril Fatface", "Bodoni Moda", "Crimson Pro", "Zilla Slab", "Arvo", "Prata", "Yeseva One", "Marcellus", "Cormorant", "Bitter", "Noto Serif", "Spectral", "Fraunces", "Rozha One", "Ultra"] },
  { group: "Script & hand-drawn", fonts: ["Pacifico", "Lobster", "Dancing Script", "Great Vibes", "Satisfy", "Kaushan Script", "Caveat", "Permanent Marker", "Rock Salt", "Shadows Into Light", "Sacramento", "Allura", "Parisienne", "Yellowtail", "Marck Script", "Courgette", "Cookie", "Mr Dafoe", "Homemade Apple", "Gloria Hallelujah", "Amatic SC", "Indie Flower", "Reenie Beanie", "Covered By Your Grace"] },
  { group: "Edgy & gothic", fonts: ["UnifrakturMaguntia", "Pirata One", "Metal Mania", "New Rocker", "Grenze Gotisch", "Germania One", "Creepster", "Nosifer", "Eater", "Special Elite", "Rye", "Sancreek", "Vast Shadow", "Faster One", "Wallpoet", "Bungee Shade", "Frijole"] },
];

/** Fonts that come in one weight: the same file draws the name and the tagline. */
export const SINGLE_WEIGHT = new Set<string>(["Anton", "Bebas Neue", "Archivo Black", "Staatliches", "Fjalla One", "Alfa Slab One", "Russo One", "Black Ops One", "Bungee", "Bangers", "Squada One", "Righteous", "Audiowide", "Monoton", "Michroma", "Press Start 2P", "Rubik Mono One", "DM Serif Display", "Abril Fatface", "Prata", "Yeseva One", "Marcellus", "Rozha One", "Ultra", "Pacifico", "Lobster", "Great Vibes", "Satisfy", "Kaushan Script", "Permanent Marker", "Rock Salt", "Shadows Into Light", "Sacramento", "Allura", "Parisienne", "Yellowtail", "Marck Script", "Courgette", "Cookie", "Mr Dafoe", "Homemade Apple", "Gloria Hallelujah", "Indie Flower", "Reenie Beanie", "Covered By Your Grace", "UnifrakturMaguntia", "Pirata One", "Metal Mania", "New Rocker", "Germania One", "Creepster", "Nosifer", "Eater", "Special Elite", "Rye", "Sancreek", "Vast Shadow", "Faster One", "Wallpoet", "Bungee Shade", "Frijole"]);
