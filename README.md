# Plateforme centrale — Restaurants universitaires

Pilotage des réservations de repas des Restaurants Universitaires (RU).  
**L’étudiant n’installe rien** : il commande par USSD, paie, reçoit un code par SMS, puis retire des **jetons physiques** déjà sur place.

Cette version est un **MVP en mode TEST**. USSD, paiement et SMS sont simulés.  
**Aucune intégration Orange / Orange Money / SMS opérateur n’est fonctionnelle** — les adaptateurs existent, mais restent volontairement vides jusqu’aux spécifications officielles.

## Parcours

```
Étudiant → USSD → ville/RU (1re fois) → midi/soir → plat du jour → quantité
        → paiement simulé → SMS avec code → arrivée au RU
        → saisie du code sur la tablette → jetons remis
```

Chaque RU connecté sur sa tablette **ne voit que ses propres commandes**.

## Menus du jour

Chaque restaurant a un emploi du temps : généralement **4 plats au midi** et **4 plats au soir**.  
Le dashboard affiche le **nombre de plats à préparer par recette**, pas seulement le nombre d’étudiants (2 plats commandés = 2).

Pas d’impression : après validation du code, l’agent remet les jetons physiques.

## Lancer le MVP

Prérequis : Node.js 20+.

```bash
npm install
npm run dev
```

- Tablette / admin : http://localhost:5173
- Simulateur étudiant : http://localhost:5173/simulateur
- API : http://localhost:3001/api/health

### Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Agent RU UJKZ (Ouagadougou) | `ujkz@ru.bf` | `Agent1234!` |
| Agent RU Ouaga 2 | `oua2@ru.bf` | `Agent1234!` |
| Admin central | `admin@ru.bf` | `Admin1234!` |

Pour vérifier l’isolation : réservez via le simulateur (ville 1 = Ouagadougou, RU 1 = UJKZ), puis connectez-vous en `oua2@ru.bf` — le code doit être refusé.

## Architecture

```
client/   React + Vite + Tailwind + PWA (tablette)
server/   Express + TypeScript
          SQLite (schéma prêt pour PostgreSQL)
          integrations/ussd|payment|sms  — abstractions + stubs opérateurs
```

Base SQLite locale : `server/data/ru.db` (créée et peuplée au premier démarrage).

## Tests

```bash
npm test
```
