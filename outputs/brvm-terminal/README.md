# SK-TERMINAL

Terminal financier local en français : interface sombre, tableaux denses, ligne de commande et panneaux inspirés des stations de marché professionnelles. Application indépendante, sans affiliation avec Bloomberg.

## Démarrer

Node.js 22 ou supérieur recommandé. Installer les dépendances avec `npm install` avant le premier démarrage.

```powershell
cd outputs/brvm-terminal
npm install
npm start
```

Ouvrir http://127.0.0.1:4173. Le serveur écoute uniquement sur votre ordinateur. Arrêter avec Ctrl+C. Le port peut être changé avec la variable `PORT`.

L’ouverture directe d’`index.html` permet de consulter l’instantané hors connexion ; les actualités nécessitent le serveur local. Les favoris et positions sont propres à l’origine du navigateur : conserver la même adresse et le même port.

## Fonctions disponibles

- **Marchés** : indices, cotations, filtre par symbole ou nom connu, tri, favoris persistants et carte des variations sur les valeurs ayant une date commune.
- **Graphiques** : courbes, bougies OHLC, volumes lorsqu’ils sont fournis, MM20, survol des observations, horizons 1 mois à historique complet et agrégation journalière à annuelle.
- **Comparateur** : deux instruments normalisés en base 100 à leur première date commune dans la fenêtre.
- **Actualités** : trois sources au choix, toutes avec éditeur, heure UTC et lien vers l’article.
  - *Google Actualités* (par défaut, **sans clé**) : flux RSS public de Google, éditions Sénégal, Côte d’Ivoire, France, Nigeria, Royaume-Uni, États-Unis, période 24 h / 7 j / 30 j. Jusqu’à 60 articles, cache 15 min.
  - *Presse africaine* (**sans clé**) : flux RSS officiels de la BRVM et de la BCEAO, Financial Afrik, Jeune Afrique, Le Monde Afrique et Africanews, fusionnés et filtrables (`BRVM OR UEMOA`). Cache 10 min.
  - *NewsAPI.org* (clé `NEWS_API_KEY`) : recherche plein texte, langue et tri.
- **Macro** (`MACRO`, `Alt+0`) : régimes de croissance, d’inflation, de marché et de conditions financières, probabilité de récession US à 6 mois, sentiment 0–100, 14 indicateurs (taux US, courbe, inflation, chômage, EUR/USD, Brent, dollar, taux 10 ans zone euro…) avec percentile 10 ans et z-score, historique cliquable, « ce qui bouge » et calendrier des publications. Source : API gratuite et sans clé [MacroRadar](https://www.macroradar.io/developers), cache 1 h.
- **Devises** : conversion et historique des taux entre XOF, EUR, USD, GBP, NGN et GHS.
- **Portefeuille** : positions manuelles, quantité, prix de revient et plus-value latente aux dernières observations disponibles. Stockage local uniquement.
- **Alertes** : seuil supérieur/inférieur, vérification à l’ouverture et lors de l’actualisation. Pas de service en arrière-plan quand la page est fermée.
- **Export CSV** : historique du symbole actif selon la périodicité sélectionnée. Le bouton exporte les cours, même depuis un autre module.

## Commandes

**Africanews** : le module RSS lit https://fr.africanews.com/feed/ avec filtre textuel, dates UTC et liens vers les articles. Cache serveur de 10 minutes. Le bouton « Recharger le flux » relit le flux via ce cache.

**Pays / Africa API · Banque mondiale** : sans clé, la fiche pays utilise l’API ouverte de la Banque mondiale (population, PIB, PIB/hab., croissance, inflation, chômage, solde courant, IDE). Ajouter `AFRICA_API_KEY` dans `.env.local` côté serveur pour utiliser Africa API à la place. La clé est envoyée uniquement à `https://api.africa-api.com` dans l’en-tête Bearer. Sans clé, un message de configuration remplace les données. Les indicateurs affichent leur année, unité et source ; cache d’une heure.

### Raccourcis clavier

- `Alt+1` à `Alt+9` puis `Alt+0` : Marchés, Graphiques, Comparateur, Actualités, Devises, Portefeuille, Alertes, Africanews, Pays, Macro.
- `Ctrl+K` (ou `Cmd+K`) : ligne de commande.
- `Alt+R` : actualiser le module courant.
- `Alt+E` : exporter les cours dans Marchés, Graphiques ou Comparateur.
- `Alt+S` : ajouter ou retirer le symbole actif des favoris.
- `F1` ou `?` : aide ; `Échap` : fermer la fenêtre d’aide.

La navigation est suspendue pendant la saisie et dans les fenêtres modales. Les chiffres utilisent aussi leur position physique pour les claviers AZERTY.

Les commandes `RSS`, `ECO` et `MACRO` ouvrent respectivement Africanews, Pays et Macro.

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

Sources :

- Cours : https://github.com/harzat/brvm-data-public (BRVMetrics), mis à jour chaque soir de séance. L’ancienne source `Fredysessie/brvm-data-public` a été supprimée de GitHub (404) ; son historique jusqu’au 9 septembre 2026 reste dans l’instantané.
- Devises : https://github.com/fawazahmed0/exchange-api (fixings quotidiens, sans clé). L’euro → XOF reste à 655,957.

L’instantané `data.js` contient 67 historiques : 49 symboles d’actions, dont Bridge Bank Group CI (BBGC, introduite en septembre 2026), et 18 indices. Les dernières dates sont affichées par instrument ; SVOC, par exemple, s’arrête en 2019 et n’existe plus dans la source. Aucun cours simulé.

Mettre l’instantané à jour (environ 30 secondes) :

```powershell
npm run update:data
```

**Qualité de la nouvelle source.** La clôture et le volume correspondent exactement à l’ancienne source sur les séances communes. En revanche, ouverture, plus haut et plus bas ne sont pas fiables pour les actions. L’historique antérieur au 10 septembre 2026 garde donc l’OHLC d’origine, et les séances suivantes utilisent l’enveloppe cohérente des valeurs publiées. Les bougies récentes sont indicatives.

**Divisions du nominal.** La source ne les ajuste pas (Sonatel 1:10 le 26 octobre 2026, Onatel BF 1:2 en 2018). La BRVM plafonnant la variation quotidienne à ±7,5 %, un rapport de clôtures proche d’un ratio usuel (2, 3, 4, 5, 10…) d’une séance à l’autre est traité comme une division : les prix antérieurs sont divisés et les volumes multipliés. La fiche valeur indique l’ajustement appliqué. Les positions du portefeuille saisies avant une division doivent être corrigées à la main (quantité × ratio, prix de revient ÷ ratio).

Les historiques d’indices ont un volume vide. Ce champ reste manquant et s’affiche « — » ; les cours restent exploitables. Les lignes invalides sont ignorées, les dates triées et les doublons dédupliqués. Les barres hebdomadaires commencent le lundi ; ouverture initiale, extrema, dernière clôture et somme des volumes constituent chaque agrégation. Un volume agrégé est manquant si une de ses composantes est manquante.

La variation de séance compare les deux dernières observations du fichier quotidien, qui peuvent être espacées de plusieurs jours. Les graphiques utilisent les prix ajustés des divisions du nominal, mais pas des dividendes. La comparaison n’est donc pas une mesure de rendement total. Les conversions utilisent la dernière date du JSON de la monnaie source, sans frais ni marge de change.

**Actualiser** relit les CSV quotidiens et le dernier fixing des six devises. L’actualisation est automatique à l’ouverture si l’instantané a plus d’un jour, puis toutes les 15 minutes tant que la page reste ouverte. Les nouvelles séances sont ajoutées à l’historique existant, puis les divisions sont ajustées. Les séries antérieures sont conservées si un téléchargement échoue ou renvoie un historique plus ancien. Les actualisations sont en mémoire ; après rechargement, l’instantané fourni est utilisé jusqu’à la prochaine actualisation. Les graphiques agrègent localement les séries quotidiennes (hebdomadaire à annuel) pour rester utilisables hors connexion.

## Sources gratuites : conditions d’utilisation

| Source | Clé | Conditions |
| --- | --- | --- |
| Google Actualités RSS | non | Flux fourni « pour un lecteur de flux personnel, usage non commercial ». Activé par défaut en local, **désactivé par défaut sur Vercel** (`GOOGLE_NEWS_RSS=on` pour forcer un usage strictement personnel). Le terminal n’affiche que titre, éditeur, date et le lien Google qui redirige vers l’article ; aucune page n’est aspirée. |
| Flux RSS éditeurs (BRVM, BCEAO, Financial Afrik, Jeune Afrique, Le Monde, Africanews) | non | Flux publiés par les éditeurs pour la syndication : titres, résumés et lien vers l’article d’origine, source affichée. |
| MacroRadar | non | Gratuit avec attribution (lien affiché dans le module). Séries US publiques ; 10 séries privées (S&P 500, VIX…) renvoient HTTP 451 et ne sont pas redistribuées. Cache 1 h côté serveur. |
| Banque mondiale | non | Données ouvertes CC BY 4.0. API parfois lente (jusqu’à 25 s). |
| BRVMetrics (cours BRVM) | non | Mis à disposition « pour l’analyse personnelle, la formation et la vérification » ; données propriété de BRVM, SikaFinance et RicheBourse. Pour un usage commercial, voir ces sources. |
| exchange-api (devises) | non | Gratuit, sans limite annoncée, servi par jsDelivr. |

Alternative à Google Actualités pour un usage commercial ou public : l’API DOC 2.0 de [GDELT](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) (gratuite, liens directs, une requête toutes les 5 s).

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

Architecture : `index.html`, `styles.css`, `app.js` (modules et graphiques Canvas), `core.js` (calculs, lecture des CSV, ajustement des divisions), `update-snapshot.cjs` (mise à jour de l’instantané), `news.js` (actualités multi-sources), `macro.js` (module Macro), `server.cjs` (serveur et proxy NewsAPI), `sources.cjs` (Google Actualités, presse RSS, MacroRadar, Banque mondiale), `data.js` (instantané public).


## Connexion Neon ajoutée

Le bouton DB exécute une vérification SQL en lecture seule. DATABASE_URL est lue côté serveur depuis .env.local dans ce dossier, ou depuis .env.local à la racine du projet. Les positions et favoris restent stockés dans le navigateur. La liaison de la branche production et le déploiement Neon attendent encore une session CLI valide. Consulter le fichier ETAT-NEON.md du dossier outputs pour le détail.

Commande de vérification : npm run check:db.

