# Galerie de la Verrière — portfolio artistique en 3D

Une galerie d'art classique (grande verrière, murs blancs, soubassements en bois, parquet)
entièrement en 3D, que l'on visite librement au clavier, à la souris ou au doigt. Chaque
œuvre s'ouvre sur une fiche (image grand format, titre, artiste, année, description, lien,
document). Le contenu se modifie sans coder, depuis une interface d'administration
utilisable sur téléphone, et le site s'héberge gratuitement sur GitHub Pages.

## Par où commencer ?

| Vous êtes… | Lisez |
| --- | --- |
| **Propriétaire du site** (modifier les œuvres, textes, couleurs) | [`docs/GUIDE-PROPRIETAIRE.md`](docs/GUIDE-PROPRIETAIRE.md) |
| **Mise en ligne** (GitHub Pages, procédure Git) | [`docs/DEPLOIEMENT-GITHUB-PAGES.md`](docs/DEPLOIEMENT-GITHUB-PAGES.md) |
| **Développeur** | [`docs/TECHNIQUE.md`](docs/TECHNIQUE.md) |
| **Une IA** (Claude, ChatGPT…) chargée de faire évoluer le projet | [`AI_CONTEXT.md`](AI_CONTEXT.md) ← à lire en premier |

## Démarrage rapide

- **Voir le site sur son ordinateur** : double-cliquez sur `demarrer-mac.command` (Mac) ou
  `demarrer-windows.bat` (Windows). Ou, dans un terminal :

  ```bash
  python3 -m http.server 8765
  ```

  puis ouvrez <http://localhost:8765> (galerie) et <http://localhost:8765/admin/> (Atelier).
- **Mettre en ligne** : suivez [`docs/DEPLOIEMENT-GITHUB-PAGES.md`](docs/DEPLOIEMENT-GITHUB-PAGES.md)
  (10 minutes, sans ligne de commande possible).
- **Vérifier le projet** : `node tools/check.mjs`.

## Ce que contient ce dossier

```
index.html, style.css, main.js   le site public (galerie 3D)
admin/                           l'Atelier : interface d'administration
content/site.json                ★ tout le contenu (œuvres, textes, couleurs, liens)
content/site.schema.json         description formelle du contenu
js/                              modules du site (architecture 3D, œuvres, contrôles…)
assets/                          images des œuvres, documents, icône, textures optionnelles
vendor/                          bibliothèques incluses (Three.js, JSZip) — aucun CDN requis
docs/                            documentation
tools/check.mjs                  vérification avant publication
demarrer-mac.command / demarrer-windows.bat   lancement local en un double-clic
AI_CONTEXT.md                    référence pour les assistants IA
CHANGELOG.md                     historique des versions
```

## Commandes de visite

| Action | Ordinateur | Téléphone / tablette |
| --- | --- | --- |
| Se déplacer | Z Q S D (AZERTY) · W A S D (QWERTY) · ↑ ↓ | Pouce sur la moitié gauche (joystick) |
| Regarder | Souris · ← → | Glisser sur la moitié droite |
| Découvrir une œuvre | Viser et cliquer | Toucher l'œuvre |
| Marcher plus vite | Maj | — |
| Menu / pause | Échap | Bouton ☰ |

## Points forts techniques

Three.js (modules ES, sans build), architecture modélisée objet par objet, matériaux PBR et
textures procédurales, ombres et reflets précalculés, occlusion ambiante, qualité adaptative,
collisions, accessibilité clavier, interface responsive, publication GitHub en un commit.
