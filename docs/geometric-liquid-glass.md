# Geometric Liquid Glass

`src/geometric-liquid-glass.css` è il layer visuale finale per spostare ANDRYXify da un liquid glass morbido/blob a un linguaggio più geometrico, premium e controllato.

## Obiettivo

- Meno pillole casuali.
- Più griglia.
- Più coerenza fra desktop, mobile browser e PWA.
- Più percezione da prodotto reale.
- Mantenere glow, vetro e identità ANDRYXify senza effetto “gelatina”.

## Token

Il file introduce token `--geo-*`:

- raggi: `--geo-radius-*`
- spacing: `--geo-space-*`
- superfici: `--geo-surface`, `--geo-control`, `--geo-nav`
- bordi: `--geo-border`, `--geo-border-hot`
- ombre: `--geo-shadow-card`, `--geo-shadow-float`
- layout: `--geo-grid-max`

## Utility class

Sono disponibili utility per componenti nuovi o refactor futuri:

```txt
.geo-shell
.geo-card / .glass-card-geo
.geo-button / .btn-geo
.geo-button-primary / .btn-geo-primary
.topbar-geo
.bottom-nav-geo
.ikigai-panel-geo
```

## Componenti normalizzati

Il layer corregge globalmente:

- hero/home intro
- topbar mobile
- brand chip
- avatar/profile trigger
- card/pannelli/post
- bottoni/chip/tab
- navbar desktop
- bottom navbar mobile
- Ikigai panel/input/suggestions
- menu profilo
- SOCIALify layout

## Regola pratica

Da ora, nuove sezioni dovrebbero usare:

- `geo-shell` per contenitori centrati
- `geo-card` per card/pannelli
- `geo-button` o `geo-button-primary` per azioni

In questo modo il sito resta geometrico e non torna a una somma di blob scollegati.
