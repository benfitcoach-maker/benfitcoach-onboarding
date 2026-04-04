export const MESSAGE_TEMPLATES = [
  {
    id: 'relance',
    title: 'Relance client inactif',
    category: 'retention',
    fr: `Salut [PRENOM],

J'espere que tu vas bien ! Ca fait un moment qu'on n'a pas echange et je voulais prendre de tes nouvelles.

Je sais que la vie peut etre chargee, et c'est tout a fait normal d'avoir des periodes ou l'entrainement passe au second plan. L'important, c'est de ne pas laisser ca devenir permanent.

On pourrait faire un petit point ensemble cette semaine ? Meme 10 minutes suffiraient pour recaler les choses et adapter ton programme a ta situation actuelle.

Je suis la pour toi, pas de jugement — juste du soutien.

A tres vite,
Benoit`,
    en: `Hey [PRENOM],

Hope you're doing well! It's been a while since we last connected and I wanted to check in on you.

I know life can get busy, and it's completely normal to have periods where training takes a back seat. The key is not letting it become permanent.

Could we do a quick catch-up this week? Even 10 minutes would be enough to realign things and adapt your program to your current situation.

I'm here for you, no judgment — just support.

Talk soon,
Benoit`,
  },
  {
    id: 'milestone',
    title: 'Felicitations milestone',
    category: 'motivation',
    fr: `[PRENOM], je voulais te feliciter !

Tu viens de franchir un cap important dans ton parcours, et ca merite d'etre souligne. Les resultats que tu obtiens sont le fruit direct de ta regularite et de ton engagement.

Ce qui m'impressionne le plus, c'est ta constance. Beaucoup de gens commencent fort puis abandonnent — toi, tu continues a progresser semaine apres semaine.

Continue sur cette lancee. Le meilleur est encore a venir.

Fier de toi,
Benoit`,
    en: `[PRENOM], I wanted to congratulate you!

You've just hit an important milestone in your journey, and that deserves to be recognized. The results you're getting are a direct product of your consistency and commitment.

What impresses me most is your constancy. Many people start strong then give up — you keep progressing week after week.

Keep up the momentum. The best is yet to come.

Proud of you,
Benoit`,
  },
  {
    id: 'checkin',
    title: 'Rappel check-in',
    category: 'suivi',
    fr: `Hey [PRENOM],

C'est l'heure de notre check-in ! J'aimerais savoir comment ca se passe de ton cote :

- Comment te sens-tu physiquement cette semaine ?
- As-tu pu suivre le programme comme prevu ?
- Y a-t-il des exercices qui t'ont pose probleme ?
- Comment va ta nutrition / ton sommeil ?

N'hesite pas a etre honnete, c'est comme ca qu'on avance ensemble. Meme un petit message rapide me suffit pour ajuster ce qu'il faut.

A toi !
Benoit`,
    en: `Hey [PRENOM],

It's check-in time! I'd love to know how things are going on your end:

- How are you feeling physically this week?
- Were you able to follow the program as planned?
- Were there any exercises that gave you trouble?
- How's your nutrition / sleep going?

Don't hesitate to be honest, that's how we move forward together. Even a quick message is enough for me to adjust what's needed.

Over to you!
Benoit`,
  },
  {
    id: 'upsell',
    title: 'Proposition upsell',
    category: 'business',
    fr: `[PRENOM],

En voyant tes progres ces derniers mois, je me dis qu'on pourrait aller encore plus loin ensemble.

Tu as deja prouve que tu es capable de t'engager et de tenir sur la duree. Maintenant, imagine ce qu'on pourrait accomplir avec un suivi plus rapproche : des ajustements en temps reel, un plan nutrition personnalise, et un acces direct pour tes questions.

J'ai une formule qui correspondrait parfaitement a ton niveau actuel et tes objectifs. On en parle lors de notre prochain echange ?

Aucune pression, juste une opportunite que je voulais te presenter.

A bientot,
Benoit`,
    en: `[PRENOM],

Seeing your progress over the past months, I think we could take things even further together.

You've already proven you can commit and stay consistent over time. Now imagine what we could accomplish with closer support: real-time adjustments, a personalized nutrition plan, and direct access for your questions.

I have a plan that would perfectly match your current level and goals. Shall we discuss it during our next check-in?

No pressure at all, just an opportunity I wanted to share with you.

Talk soon,
Benoit`,
  },
  {
    id: 'anniversaire',
    title: 'Anniversaire d\'inscription',
    category: 'retention',
    fr: `[PRENOM],

Ca fait deja un an (ou X mois) qu'on travaille ensemble, et je voulais marquer le coup !

Quand je regarde d'ou tu es parti(e) et ou tu en es aujourd'hui, la transformation est impressionnante. Pas seulement physiquement, mais aussi dans ton mindset et tes habitudes.

Merci de me faire confiance dans ce parcours. C'est un privilege de t'accompagner et de voir ta progression au quotidien.

Voici a la prochaine etape !

Avec gratitude,
Benoit`,
    en: `[PRENOM],

It's already been a year (or X months) since we started working together, and I wanted to mark the occasion!

When I look at where you started and where you are today, the transformation is impressive. Not just physically, but also in your mindset and habits.

Thank you for trusting me on this journey. It's a privilege to support you and see your progress every day.

Here's to the next chapter!

With gratitude,
Benoit`,
  },
  {
    id: 'bienvenue-rapide',
    title: 'Bienvenue rapide (SMS/WhatsApp)',
    category: 'onboarding',
    fr: `Bienvenue [PRENOM] ! C'est Benoit de Benfitcoach. Ravi de t'avoir dans l'equipe ! Je prepare ton programme personnalise, tu le recevras sous 48h. En attendant, n'hesite pas si tu as la moindre question. On va faire du bon travail ensemble !`,
    en: `Welcome [PRENOM]! This is Benoit from Benfitcoach. Thrilled to have you on board! I'm preparing your personalized program, you'll receive it within 48h. In the meantime, don't hesitate if you have any questions. We're going to do great work together!`,
  },
  {
    id: 'absence',
    title: 'Absence prolongee (> 3 semaines)',
    category: 'retention',
    fr: `[PRENOM],

Je ne vais pas tourner autour du pot : ca fait un moment que je n'ai pas de nouvelles et ca me preoccupe un peu.

Je ne sais pas ce qui se passe de ton cote — peut-etre un coup de mou, un imprévu, ou juste la vie qui s'impose. Quoi qu'il en soit, je suis la.

Si tu veux reprendre, on peut repartir doucement avec un programme allege. Si tu as besoin d'une pause officielle, pas de souci non plus.

Le plus important pour moi, c'est de savoir que tu vas bien.

Un signe de vie ?
Benoit`,
    en: `[PRENOM],

I'll be straightforward: it's been a while since I've heard from you and I'm a bit concerned.

I don't know what's going on your end — maybe a rough patch, something unexpected, or just life getting in the way. Whatever it is, I'm here.

If you want to restart, we can ease back in with a lighter program. If you need an official break, that's totally fine too.

What matters most to me is knowing you're okay.

A sign of life?
Benoit`,
  },
  {
    id: 'motivation-lundi',
    title: 'Motivation lundi',
    category: 'motivation',
    fr: `[PRENOM], nouvelle semaine, nouvelles opportunites 💪 Tu as 3 seances devant toi cette semaine. Concentre-toi sur une chose : etre regulier. On ne vise pas la perfection, on vise la constance. C'est parti. Benoit`,
    en: `[PRENOM], new week, new opportunities 💪 You've got 3 sessions ahead of you this week. Focus on one thing: showing up. We're not chasing perfection, we're building consistency. Let's go. Benoit`,
  },
  {
    id: 'bravo-resultats',
    title: 'Bravo resultats',
    category: 'motivation',
    fr: `[PRENOM], je viens de regarder ton check-in et franchement bravo 🔥 Les chiffres parlent d'eux-memes. Continue exactement comme ca — ce que tu fais marche. On en reparle a la prochaine visio. Benoit`,
    en: `[PRENOM], just reviewed your check-in and I have to say — well done 🔥 The numbers speak for themselves. Keep doing exactly what you're doing — it's working. We'll discuss at our next session. Benoit`,
  },
  {
    id: 'plateau',
    title: 'Pas de panique plateau',
    category: 'motivation',
    fr: `[PRENOM], je vois que les resultats ont ralenti cette semaine. C'est 100% normal — ca arrive a tout le monde apres quelques semaines. Ca ne veut pas dire que ca ne marche pas. Ton corps s'adapte et les resultats vont repartir. On ajuste le programme si besoin. Fais confiance au process. Benoit`,
    en: `[PRENOM], I see the results have slowed down this week. This is 100% normal — it happens to everyone after a few weeks. It doesn't mean it's not working. Your body is adapting and results will pick up again. We'll adjust the program if needed. Trust the process. Benoit`,
  },
  {
    id: 'rappel-nutrition',
    title: 'Rappel nutrition',
    category: 'nutrition',
    fr: `[PRENOM], petit rappel : ta nutrition compte autant que tes seances 🥗 Cette semaine, concentre-toi sur un seul objectif : manger une source de proteines a chaque repas. Pas besoin d'etre parfait sur tout, juste ca. Benoit`,
    en: `[PRENOM], quick reminder: your nutrition matters as much as your workouts 🥗 This week, focus on one goal: eat a protein source at every meal. You don't need to be perfect at everything, just this. Benoit`,
  },
  {
    id: 'weekend-nutrition',
    title: 'Weekend nutrition',
    category: 'nutrition',
    fr: `[PRENOM], le weekend approche 🍽️ Rappelle-toi : un bon weekend ne veut pas dire parfait. Si tu manges au restaurant, choisis une option avec des proteines et des legumes. Profite sans culpabiliser, et reprends lundi. L'equilibre, c'est la cle. Benoit`,
    en: `[PRENOM], weekend's coming 🍽️ Remember: a good weekend doesn't mean a perfect one. If you eat out, go for an option with protein and vegetables. Enjoy without guilt, and get back on track Monday. Balance is key. Benoit`,
  },
  {
    id: 'checkin-manquant',
    title: 'Check-in manquant',
    category: 'engagement',
    fr: `[PRENOM], je n'ai pas recu ton check-in cette semaine 📋 C'est important pour moi de suivre ta progression. Ca prend 2 minutes — remplis-le quand tu peux aujourd'hui. Merci ! Benoit`,
    en: `[PRENOM], I haven't received your check-in this week 📋 It's important for me to track your progress. It takes 2 minutes — fill it out when you can today. Thanks! Benoit`,
  },
  {
    id: 'retour-absence',
    title: 'Retour apres absence',
    category: 'engagement',
    fr: `[PRENOM], ca fait un moment qu'on ne s'est pas parle. Pas de jugement — la vie, c'est comme ca. Mais je suis la quand tu es pret(e) a reprendre. Un message suffit pour relancer la machine. Benoit`,
    en: `[PRENOM], it's been a while since we last connected. No judgment — life happens. But I'm here whenever you're ready to get back on track. One message is all it takes. Benoit`,
  },
  {
    id: 'anniversaire-3-mois',
    title: 'Anniversaire 3 mois',
    category: 'engagement',
    fr: `[PRENOM], 3 mois de coaching ensemble ! 🎯 Prends 2 minutes pour comparer ou tu en es aujourd'hui vs le jour 1. Le chemin parcouru est impressionnant. On continue — le meilleur est devant toi. Benoit`,
    en: `[PRENOM], 3 months of coaching together! 🎯 Take 2 minutes to compare where you are today vs day 1. The progress you've made is impressive. Let's keep going — the best is ahead. Benoit`,
  },
  {
    id: 'anniversaire-6-mois',
    title: 'Anniversaire 6 mois',
    category: 'engagement',
    fr: `[PRENOM], 6 mois ! 🏆 Tu fais partie des clients qui tiennent sur la duree, et c'est ca qui fait la vraie difference. Tes resultats sont le fruit de ta regularite. Fier de bosser avec toi. Benoit`,
    en: `[PRENOM], 6 months! 🏆 You're one of the clients who stick with it long-term, and that's what makes the real difference. Your results are the product of your consistency. Proud to work with you. Benoit`,
  },
  {
    id: 'proposition-visio',
    title: 'Proposition visio (upsell)',
    category: 'upsell',
    fr: `[PRENOM], je vois que tu es regulier et motive — c'est top 💪 Avec un suivi plus rapproche (ajustements + 2 visio/mois), on pourrait vraiment accelerer tes resultats. Tu veux qu'on en parle ? Benoit`,
    en: `[PRENOM], I can see you're consistent and motivated — that's great 💪 With closer coaching (regular adjustments + 2 video calls/month), we could really accelerate your results. Want to discuss? Benoit`,
  },
  {
    id: 'proposition-intensif',
    title: 'Proposition intensif (upsell)',
    category: 'upsell',
    fr: `[PRENOM], ta progression est solide. Avec le coaching Intensif (4 visio/mois + reponse prioritaire + ajustements hebdomadaires), on pourrait passer au niveau superieur. C'est l'accompagnement ideal pour quelqu'un d'aussi engage que toi. On en parle a la prochaine visio ? Benoit`,
    en: `[PRENOM], your progress is solid. With Ultimate coaching (4 video calls/month + priority response + weekly adjustments), we could take it to the next level. It's the ideal plan for someone as committed as you. Shall we discuss at our next call? Benoit`,
  },
];
