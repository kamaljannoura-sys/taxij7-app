# Site web taxij7rivesud.com — nouvelle version

Fichiers à téléverser à la racine de l'hébergement (même endroit que l'ancien `index.html`) :

| Fichier | Rôle |
|---|---|
| `index.html` | Accueil |
| `a-propos-de-nous.html` | À propos |
| `nous-contacter.html` | Contact (le formulaire envoie toujours à `contactengine.php`) |
| `faq.html` | Questions fréquentes |
| `style.css` | **Nouveau**, design commun à toutes les pages |
| `site.js` | **Nouveau**, menu mobile et suivi des clics « Appeler » dans Google Tag Manager |

Les images (`img/...`), `contactengine.php`, les pages de villes (`taxi-*.html`) et la page
boost/déverrouillage ne changent pas : laissez-les en place.

Gardez une copie de vos anciens fichiers avant de remplacer.

## Dans Google Tag Manager (GTM-NPRTMN78)
`site.js` envoie les événements `clic_appel` et `clic_courriel` dans le dataLayer.
Créez un déclencheur « Événement personnalisé » sur `clic_appel` et reliez-le à une
conversion GA4 / Google Ads pour compter les appels générés par le site.
