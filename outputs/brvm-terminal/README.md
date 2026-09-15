# SK-TERMINAL

Terminal financier local en français : interface sombre, tableaux denses, ligne de commande et panneaux inspirés des stations de marché professionnelles. Application indépendante, sans affiliation avec Bloomberg.

## Démarrer

Node.js 22 ou supérieur recommandé. Installer les dépendances avec `npm install` avant le premier démarrage.

```powershell
cd "C:\Users\betos\Documents\Codex\2026-09-10\je-2\outputs\brvm-terminal"
npm start
```

Ouvrir http://127.0.0.1:4173. Le serveur écoute uniquement sur votre ordinateur. Arrêter avec Ctrl+C. Le port peut être changé avec la variable `PORT`.

L’ouverture directe d’`index.html` permet de consulter l’instantané hors connexion ; les actualités nécessitent le serveur local. Les favoris et positions sont propres à l’origine du navigateur : conserver la même adresse et le même port.

## Fonctions disponibles

- **Marchés** : indices, cotations, filtre par symbole ou nom connu, tri, favoris persistants et carte des variations sur les valeurs ayant une date commune.
- **Graphiques** : courbes, bougies OHLC, volumes lorsqu’ils sont fournis, MM20, survol des observations, horizons 1 mois à historique complet et agrégation journalière à annuelle.
- **Comparateur** : deux instruments normalisés en base 100 à leur première date commune dans la fenêtre.
- **Actualités** : recherche NewsAPI.org, français/anglais/toutes langues, tri par date/pertinence/popularité, source et heure UTC, liens vers les articles. Jusqu’à 40 articles par recherche, cache serveur de 15 minutes, erreurs et quotas affichés.
- **Devises** : conversion et historique des taux entre XOF, EUR, USD, GBP, NGN et GHS.
- **Portefeuille** : positions manuelles, quantité, prix de revient et plus-value latente aux dernières observations disponibles. Stockage local uniquement.
- **Alertes** : seuil supérieur/inférieur, vérification à l’ouverture et lors de l’actualisation. Pas de service en arrière-plan quand la page est fermée.
- **Export CSV** : historique du symbole actif selon la périodicité sélectionnée. Le bouton exporte les cours, même depuis un autre module.

## Commandes

**Africanews** : le module RSS lit https://fr.africanews.com/feed/ avec filtre textuel, dates UTC et liens vers les articles. Cache serveur de 10 minutes. Le bouton « Recharger le flux » relit le flux via ce cache.

**Pays / Africa API** : ajouter `AFRICA_API_KEY` dans `.env.local` côté serveur pour charger les profils pays, dont le Kenya. La clé est envoyée uniquement à `https://api.africa-api.com` dans l’en-tête Bearer. Sans clé, un message de configuration remplace les données. Les indicateurs affichent leur année, unité et source ; cache d’une heure.

### Raccourcis clavier

- `Alt+1` à `Alt+9` : Marchés, Graphiques, Comparateur, Actualités, Devises, Portefeuille, Alertes, Africanews, Pays.
- `Ctrl+K` (ou `Cmd+K`) : ligne de commande.
- `Alt+R` : actualiser le module courant.
- `Alt+E` : exporter les cours dans Marchés, Graphiques ou Comparateur.
- `Alt+S` : ajouter ou retirer le symbole actif des favoris.
- `F1` ou `?` : aide ; `Échap` : fermer la fenêtre d’aide.

La navigation est suspendue pendant la saisie et dans les fenêtres modales. Les chiffres utilisent aussi leur position physique pour les claviers AZERTY.

Les commandes `RSS` et `ECO` ouvrent respectivement Africanews et Pays.

| Commande | Action |
| --- | --- |
| `SNTS` ou `SNTS GP` | Graphique Sonatel |
| `SNTS DES` | Fiche valeur |
| `SNTS HP` | 100 dernières observations OHLCV |
| `MON`, `GP`, `COMP` | Marchés, graphique, comparaison |
| `N` ou `NEWS` | Actualités |
| `FX`, `PORT`, `ALRT` | Devises, portefeuille, alertes |
| `HELP` / F1 | Aide |
| Ctrl+K | Activer la ligne de commande |

## Données et calculs

Source : https://github.com/Fredysessie/brvm-data-public

L’instantané `data.js` contient 66 historiques : 48 symboles d’actions, y compris des historiques anciens, et 18 indices. Il s’agit des répertoires effectivement disponibles, pas d’une garantie de cotation actuelle. La métadonnée du dépôt mentionne aussi BBGC, dont le répertoire était absent lors de la récupération. Les dernières dates sont affichées par instrument ; SVOC, par exemple, s’arrête en 2019. Aucun cours simulé.

Les historiques d’indices ont un volume vide. Ce champ reste manquant et s’affiche « — » ; les cours restent exploitables. Les lignes invalides sont ignorées, les dates triées et les doublons dédupliqués. Les barres hebdomadaires commencent le lundi ; ouverture initiale, extrema, dernière clôture et somme des volumes constituent chaque agrégation. Un volume agrégé est manquant si une de ses composantes est manquante.

La variation de séance compare les deux dernières observations du fichier quotidien, qui peuvent être espacées de plusieurs jours. Les graphiques utilisent les prix tels que fournis : ajustements de dividendes et opérations sur titres non documentés. La comparaison n’est donc pas une mesure de rendement total. Les conversions utilisent la dernière date du JSON de la monnaie source, sans frais ni marge de change.

**Actualiser** relit les CSV quotidiens et les six JSON de devises depuis les URL fournies. La vérification se répète toutes les 15 minutes tant que la page reste ouverte. Les séries antérieures sont conservées si un téléchargement échoue ou renvoie un historique plus ancien. Les actualisations sont en mémoire ; après rechargement, l’instantané fourni est utilisé jusqu’à la prochaine actualisation. Les CSV hebdomadaires à annuels de la source sont pris en charge par la fonction d’accès mais les graphiques agrègent localement les séries quotidiennes pour rester utilisables hors connexion.

## NewsAPI et clé

La clé fournie est configurée localement dans `.env.local`, lu uniquement par le serveur. Elle n’est pas incluse dans les fichiers publics ni dans l’archive de distribution. Elle peut être remplacée par la variable d’environnement `NEWS_API_KEY`.

Pour une nouvelle installation : copier `.env.example` vers `.env.local` puis renseigner la clé. Redémarrer le serveur après modification.

Le serveur appelle exclusivement `https://newsapi.org/v2/everything`, avec la clé dans l’en-tête `X-Api-Key`. Le navigateur appelle `/api/news` sur le serveur local. Le serveur ne sert qu’une liste explicite de fichiers publics ; `.env.local` et le code serveur sont inaccessibles par HTTP. Les titres et résumés sont échappés avant affichage, les liens limités aux protocoles HTTP(S).

Documentation : https://newsapi.org/docs/endpoints/everything et https://newsapi.org/docs/authentication

La couverture, la profondeur d’historique, le délai et les quotas dépendent de l’abonnement NewsAPI. Les articles ne sont pas un flux Bloomberg.

## Périmètre

Cette application réalise les fonctions rendues possibles par ces sources. Elle ne reproduit pas l’intégralité des services Bloomberg : carnet d’ordres, transactions tick par tick, données fondamentales, obligations, dérivés, messagerie et exécution d’ordres exigent d’autres données et services. Le portefeuille n’est pas connecté à un courtier.

## Vérification

```powershell
npm test
```

Tests des CSV, variations, agrégations, comparaisons, conversions FX, moyennes mobiles et exploitation de l’ensemble de l’instantané.

Architecture : `index.html`, `styles.css`, `app.js` (modules et graphiques Canvas), `core.js` (calculs), `news.js` (actualités), `server.cjs` (serveur et proxy NewsAPI), `data.js` (instantané public).


## Connexion Neon ajoutée

Le bouton DB exécute une vérification SQL en lecture seule. DATABASE_URL est lue côté serveur depuis .env.local dans ce dossier, ou depuis .env.local à la racine du projet. Les positions et favoris restent stockés dans le navigateur. La liaison de la branche production et le déploiement Neon attendent encore une session CLI valide. Consulter le fichier ETAT-NEON.md du dossier outputs pour le détail.

Commande de vérification : npm run check:db.

