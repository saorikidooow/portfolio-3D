# AI_CONTEXT — référence centrale pour les assistants IA

> Ce fichier est destiné à une IA (Claude, ChatGPT, etc.) qui reprend ce projet.
> Lisez-le en entier avant toute modification. Il décrit l'architecture, les
> conventions, les invariants à respecter et les procédures (modification, test,
> publication). Langue du projet : **français** (interface, commentaires, documentation).

## 1. Le projet en une phrase

Un **portfolio artistique immersif** : une galerie d'art classique en 3D (Three.js,
JavaScript vanilla, modules ES, aucun outil de build) visitable à la première personne,
dont **tout le contenu éditable** (œuvres, textes, couleurs, liens) vit dans
**`content/site.json`**, modifiable via une **interface d'administration statique**
(`admin/`) qui publie directement sur **GitHub Pages** via l'API GitHub.

## 2. Principes non négociables

1. **Site 100 % statique.** Pas de serveur, pas de base de données, pas de build, pas de
   `npm install` requis pour faire tourner le site. Il doit rester hébergeable tel quel sur
   GitHub Pages (racine du dépôt, branche `main`).
2. **Aucune dépendance CDN pour le code.** Three.js 0.169.0 et JSZip 3.10.1 sont copiés dans
   `vendor/`. Les imports `three` et `three/addons/…` passent par la carte d'import
   (`<script type="importmap">`) de `index.html`. Seules les polices Google Fonts sont
   externes (repli automatique sur Georgia/Arial si indisponibles).
3. **Chemins relatifs uniquement** (`js/…`, `../js/…`, `content/site.json`), jamais `/…` :
   le site est servi sous `https://<compte>.github.io/<dépôt>/`.
4. **Respect de la casse** des noms de fichiers (GitHub Pages est sous Linux).
5. **`content/site.json` est la source unique de vérité du contenu.** Ne jamais coder en dur
   un texte, une couleur ou une œuvre dans le JS. Tout nouveau champ doit être ajouté :
   (a) dans `normalizeContent()` de `js/content.js` avec une valeur par défaut,
   (b) dans `content/site.schema.json`, (c) dans l'interface `admin/admin.js` si l'utilisateur
   doit pouvoir le modifier, (d) dans la documentation.
6. **Rétrocompatibilité** : un `site.json` ancien ou incomplet ne doit jamais casser le site
   (`normalizeContent` complète tout).
7. **Le jeton GitHub** ne quitte jamais le navigateur de l'utilisateur, sauf vers
   `api.github.com`. Ne jamais l'écrire dans un fichier du dépôt.
8. **Mobile obligatoire** : toute nouvelle interface doit être utilisable au doigt
   (cibles ≥ 44 px, champs à 16 px pour éviter le zoom iOS, `env(safe-area-inset-*)`).

## 3. Arborescence et rôle des fichiers

```
index.html            Page publique : écrans (chargement, accueil, pause, fiche), carte d'import
style.css             Styles du site public (variables CSS --gold/--ink/--cream pilotées par le thème)
main.js               Orchestrateur : charge le contenu, construit la scène, lumières, boucle,
                      états (loading → welcome → touring ⇄ paused / modal), interactions
content/
  site.json           ★ CONTENU : textes, liens, thème, œuvres
  site.schema.json    Schéma JSON du contenu (documentation formelle + validation éditeur)
js/
  content.js          Modèle de contenu : constantes (STYLES, FRAMES…), THEME_PRESETS,
                      normalizeContent(), serializeContent(), loadContent(), resolveAsset()
  layout.js           Dimensions (DIM) et plan 2D des murs (WALLS) — sans Three.js
  museum.js           Architecture 3D (murs, corniches, verrière, portes, chaises) + collisions
  paintings.js        Accrochage : toile, cadres, ombre de contact, cartels, textures d'œuvres
  painter.js          Peintures procédurales (Canvas 2D) + visuel « affiche » — sans Three.js
  materials.js        Matériaux PBR (teintes issues de theme)
  textures.js         Textures procédurales (plâtre, bois, parquet, ciel, halos)
  controls.js         Déplacement 1re personne, souris/pointer lock, tactile, collisions
  ui.js               Interface HTML (textes, liens, fiche d'œuvre, survol)
  utils.js            Outils Three.js (fusion de géométries « Batch », UV monde)
  random.js           Outils sans dépendance (aléatoire déterministe, bruit, couleurs)
  store.js            Brouillon de l'admin dans IndexedDB (partagé avec le mode aperçu)
  github.js           Publication via l'API GitHub (un commit par publication)
  config.js           Réglages techniques (vitesse, hauteur des yeux, textures photo optionnelles)
admin/
  index.html, admin.css, admin.js   Interface d'administration (« Atelier »), mobile d'abord
assets/
  artworks/           Images des œuvres (ajoutées par l'admin : <slug>-<horodatage>.jpg)
  documents/          PDF et documents liés aux œuvres
  textures/           Photos de matériaux optionnelles (voir config.js)
  icon.svg            Icône du site
vendor/               Three.js (build + modules examples/jsm utilisés) et JSZip — NE PAS MODIFIER
tools/check.mjs       Vérification complète du projet (node tools/check.mjs)
docs/                 Documentation (technique, propriétaire, déploiement)
demarrer-mac.command  Lancement local (double-clic) — serveur Python sur le port 8765
demarrer-windows.bat  Idem sous Windows
.nojekyll             Désactive Jekyll sur GitHub Pages (obligatoire, ne pas supprimer)
```

Graphe d'import (simplifié) :

```
main.js ─┬─ js/content.js ── js/store.js
         ├─ js/materials.js ── js/textures.js ── js/random.js
         ├─ js/museum.js ── js/layout.js, js/utils.js (three, BufferGeometryUtils)
         ├─ js/paintings.js ── js/painter.js (random.js), js/content.js
         ├─ js/controls.js ── js/config.js
         └─ js/ui.js ── js/content.js
admin/admin.js ── js/content.js, js/layout.js, js/painter.js, js/store.js, js/github.js
                  (l'admin n'importe PAS Three.js : garder painter/layout/content/random sans Three)
```

## 4. Flux de données

1. `main.js` lit `?apercu` dans l'URL → `loadContent({ preview })`.
   - Sans `?apercu` : `fetch('content/site.json', { cache: 'no-store' })`.
   - Avec `?apercu` : lit le brouillon IndexedDB (`galerie-admin` / `kv` / `draft`) =
     `{ content, files: { chemin: Blob }, baseText, savedAt }`. Les fichiers du brouillon
     sont résolus en `blob:` par `resolveAsset()`.
2. `normalizeContent()` complète/valide → `ui.applyContent()` (textes `data-text="clé"`,
   liens `data-links`, variables CSS) → `createMaterials(renderer, theme)` →
   `buildMuseum()` → `hangArtworks()` (une texture par œuvre) → lumières → capture
   d'environnement (reflets) → compilation → écran d'accueil.
3. Interaction : `controller.onPick(ndc)` → raycast sur les toiles/cadres →
   `activateArtwork()` : fiche (`ui.openModal`) ou ouverture directe (`clickAction`).
4. Admin : édition en mémoire → `saveDraft()` (IndexedDB, 400 ms après chaque frappe) →
   « Aperçu » = `index.html?apercu` → « Publier » = `GitHubRepo.commitFiles()`
   (`content/site.json` + fichiers du brouillon encore utilisés) en **un commit**
   → GitHub Pages se redéploie (1–2 min) → brouillon effacé.
   Détection de conflit : si le `site.json` distant diffère de `baseText` (version au début
   du brouillon), confirmation demandée avant d'écraser.

## 5. Modèle de contenu (résumé — détail : `content/site.schema.json`)

| Clé | Rôle |
| --- | --- |
| `site.*` | Textes publics (`name`, `tagline`, `eyebrow`, `welcomeText`, `enterLabel`, `pauseTitle`, `resumeLabel`, `backLabel`, `hoverHint`, `linkLabel`, `documentLabel`, `inscription`, `metaDescription`). Dans le HTML : `data-text="<clé>"`. |
| `links[]` | `{ label, url }` affichés sur l'accueil et la pause (`https:`, `mailto:`, `tel:`). |
| `theme` | `walls, trim, wood, floor, gilt, accent, ink, background` (hex `#rrggbb`), `exposure`, `sunlight`, `preset`. Préréglages dans `THEME_PRESETS` (content.js). |
| `artworks[]` | Une entrée par œuvre (voir ci-dessous). |

Œuvre : `id` (unique), `title`, `artist`, `year`, `technique`, `dimensions` (vide = auto),
`description`, `visual` (`image` \| `generated` \| `poster`), `image` (chemin ou URL),
`style` + `seed` (peinture générée), `link {url,label}`, `document {url,label}`,
`clickAction` (`details` \| `link` \| `document`), `wall` (`left` \| `right` \| `end` \|
`back` \| `entrance`), `u`, `y`, `width`, `height` (mètres), `frame` (`gilt` \| `wood` \|
`black`), `label` (`right` \| `below` \| `none`).

**Coordonnées** : `u` = position du centre le long du mur, `y` = hauteur du centre.
Grands murs : `u` = distance depuis l'entrée (0 → 42). Pilastres à u = 3, 9, 15, 21, 27,
33, 39 (largeur 0,86 m) ; travées centrées en 6, 12, 18, 24, 30, 36 ; porte sur le mur
droit (u ≈ 4,5 → 7,5). Soubassement jusqu'à 1,15 m ; haut des cadres ≤ 5,45 m
(grands murs). Mur du fond : 8 m, arche au centre (u ≈ 2,6 → 5,4). Toutes ces valeurs
viennent de `js/layout.js` (`DIM`, `WALLS`) : **ne pas dupliquer**, importer.

## 6. Recettes de modifications courantes

- **Ajouter un texte public** : ajouter la clé dans `DEFAULT_SITE` (content.js), dans
  `site.schema.json`, dans `TEXT_FIELDS` (admin.js), puis l'élément HTML avec
  `data-text="clé"`.
- **Ajouter un préréglage de couleurs** : une entrée dans `THEME_PRESETS` (content.js).
  L'admin l'affiche automatiquement.
- **Ajouter un champ d'œuvre** : `defaultArtwork()` + `normalizeArtwork()` (content.js),
  schéma, éditeur `openEditor()` (admin.js), usage dans `ui.openModal` / `paintings.js`.
- **Nouveau style de peinture générée** : objet `{ stroke, draw(ctx,w,h,r,c) }` dans
  `STYLES` (painter.js) + libellé dans `STYLES` (content.js).
- **Changer l'architecture** (longueur, pilastres…) : `DIM` dans `layout.js`. Puis vérifier
  `WALLS` (même fichier), relancer `node tools/check.mjs` (détecte les œuvres qui
  débordent) et contrôler visuellement.
- **Remplacer une texture procédurale par une photo** : `TEXTURE_OVERRIDES` (config.js).
- **Vitesse / hauteur des yeux** : `MUSEUM` (config.js).

## 7. Performance (à préserver)

- Géométries statiques fusionnées par matériau (`Batch` dans utils.js) → ~150 appels de rendu.
- Ombres calculées **une seule fois** (`shadowMap.autoUpdate = false`) : si vous ajoutez un
  objet après le chargement, mettez `renderer.shadowMap.needsUpdate = true`.
- Reflets : capture `CubeCamera` unique au chargement.
- Qualité adaptative (`QUALITY` dans main.js) : GTAO + résolution 1,5× → réduites
  automatiquement si < 38 i/s. Mobile : niveau 0 d'office.
- Boucle de rendu suspendue quand la fiche d'œuvre est ouverte.

## 8. Tester

```bash
python3 -m http.server 8765      # puis http://localhost:8765 et http://localhost:8765/admin/
node tools/check.mjs             # fichiers, liens, casse, contenu, placements (sortie 1 si erreur)
```

Liste de contrôle manuelle : accueil → « Entrer » ; marcher (ZQSD/WASD), collisions ;
survol d'une toile (cadre légèrement éclairé + légende) ; clic → fiche avec boutons
lien/document ; Échap → pause. Admin : modifier une œuvre, ajouter une image, « Aperçu »,
puis publication (ou export ZIP). Mobile : outils de développement en 375×812.
Console de débogage : `window.__galerie` (site), `window.__admin` (admin).

## 9. Publication / Git (procédure à respecter)

Le site est servi par GitHub Pages depuis **la racine de la branche `main`**. Toute
modification poussée sur `main` est en ligne en 1 à 2 minutes. Détail complet :
`docs/DEPLOIEMENT-GITHUB-PAGES.md`.

```bash
git pull                                  # récupérer les modifications faites via l'admin !
# … modifications …
node tools/check.mjs                      # doit afficher « ✓ Aucune erreur »
git add -A
git commit -m "Description claire de la modification"
git push
```

⚠ L'interface d'administration commite elle-même sur `main`. **Toujours `git pull` avant
de travailler**, sinon le push sera refusé ; en cas de conflit sur `content/site.json`,
conserver la version la plus récente du contenu (celle de l'admin) sauf demande contraire.
Messages de commit en français, à l'impératif ou descriptifs.

## 10. Pistes d'évolution identifiées

- Audio d'ambiance / audioguide par œuvre (champ `audio` + lecteur dans la fiche).
- Vidéo dans la fiche (champ `video`, lien YouTube/Vimeo intégré).
- Plusieurs salles (étendre `layout.js` : liste de salles, portes ouvrantes).
- Traduction (champ `site.lang` + jeux de textes par langue).
- Miniature PDF (pdf.js) pour le visuel des documents.
- Mode visite guidée (parcours automatique de la caméra d'œuvre en œuvre).
- Authentification admin plus simple (application OAuth GitHub + petit proxy) si un
  hébergement serveur devient possible.

## 11. Pièges connus

- Ouvrir `index.html` en double-cliquant (`file://`) ne fonctionne pas (modules ES) :
  utiliser un serveur local (scripts `demarrer-*`).
- GitHub Pages met en cache ~10 min : le site force `cache: 'no-store'` sur `site.json`,
  mais images et JS peuvent rester en cache → rechargement forcé.
- Les images hébergées sur d'autres sites peuvent être refusées (CORS) : l'œuvre
  retombe alors sur la peinture générée. Préférer des fichiers dans `assets/artworks/`.
- Taille conseillée des fichiers ajoutés : images ≤ 2000 px (l'admin redimensionne),
  documents ≤ 25 Mo (limite imposée par l'admin).
- `vendor/` : ne pas « mettre à jour » Three.js sans tester (APIs GTAOPass, RectAreaLight,
  NeutralToneMapping, `scene.environmentIntensity` utilisées).
