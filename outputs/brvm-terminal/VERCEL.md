# Déployer SK-TERMINAL sur Vercel

Le projet est préparé pour des fichiers statiques et une fonction Node.js regroupant les routes API. Aucun serveur permanent n’est nécessaire sur Vercel.

1. Importer le dépôt GitHub dans Vercel. Si le dépôt contient tout l’espace de travail, choisir `outputs/brvm-terminal` comme **Root Directory**. Si le dépôt contient directement le terminal, garder la racine.
2. Choisir **Other** comme framework. Le fichier `vercel.json` définit la commande `npm run build` et le dossier public `dist`.
3. Dans **Settings → Environment Variables**, ajouter `AFRICA_API_KEY`, `NEWS_API_KEY` et `DATABASE_URL`, en recopiant leurs valeurs privées depuis les fichiers `.env.local` locaux. Ne pas utiliser de préfixe public. Activer les environnements souhaités (Production et éventuellement Preview).
4. Déployer ou redéployer après toute modification des variables.
5. Vérifier les onglets Africanews et Pays ainsi que le bouton DB sur l’URL Vercel.

Les fichiers `.env.local` sont exclus des envois CLI et du dossier public. L’archive ne contient aucune clé. Les caches mémoire sont propres à chaque instance et disparaissent lors des redémarrages. Les favoris et le portefeuille restent dans le navigateur et ne sont pas transférés automatiquement depuis localhost.

NewsAPI doit autoriser l’utilisation en production selon votre abonnement. Le flux RSS Africanews fonctionne indépendamment de NewsAPI.

Documentation : https://vercel.com/docs/functions/runtimes/node-js

Cette configuration ne constitue pas un déploiement : une connexion au compte Vercel et l’import du projet restent nécessaires.
