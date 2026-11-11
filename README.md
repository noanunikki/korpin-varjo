# Korpin Varjo

Selaimessa pelattava keskiaikainen parkour- ja hiiviskelypeli (Three.js). Oma originaalipeli, ei kopioi mitään olemassa olevaa peliä.

**Pelaa:** https://noanunikki.github.io/korpin-varjo/

## Ohjaimet
| Näppäin | Toiminto |
|---|---|
| WASD, hiiri / nuolet | liiku, kamera |
| Shift (pidä) | vapaa juoksu: kiipeä, hyppää, seinäjuoksu |
| Välilyönti | hyppy (pidä = korkeampi), tartu reunaan ilmassa |
| C | kyyristy · juostessa liuku · seinällä pudota |
| M | musiikki päälle/pois |
| Tab / I | reppu, varusteet ja taidot |
| R | vaihda pää- ja toista asetta |
| E arkulla | avaa arkku (pudotukset poimitaan kävelemällä päälle) |
| E | salamurha / synkronoi / piiloudu heinään |
| Hiiri vasen / oikea | isku / torjunta |
| Q (pidä) | Korpin katse |

## Kampanja (8 tehtävää)
1. Kiipeä katedraalin kellotorniin ja synkronoi kartta.
2. Katokisa: lennä seitsemän renkaan läpi kattojen yli.
3. Salamurhaa kapteeni Aldric torilla.
4. Synkronoi länsilaidan kellotorni.
5. Salamurhaa verokuvernööri Maren kattotasolla.
6. Salamurhaa piispa Corvane katedraalin edustalla.
7. Salamurhaa sotamarsalkka Hesk pohjoismuurin tornin huipulla.
8. Pakene portin viereiseen piilopaikkaan.

## Varusteet ja eteneminen
- **Harvinaisuudet:** tavallinen, hieno, harvinainen, eeppinen, legendaarinen — satunnaiset ominaisuudet (perkit) harvinaisuuden mukaan.
- **Aseet:** miekka, kirves (raskas, horjuttaa), keihäs (pitkä ulottuvuus), tikari (nopea, kriittinen). Kaksi asetta, vaihto R:llä.
- **Panssari ja talismaani:** puolustus, näkyvyys, kiipeämisnopeus, putoamisvahinko ym.
- **Saalis:** 16 arkkua (katoilla, torneissa, kaduilla), vartijoiden pudotukset ja kohteiden legendaariset aseet.
- **Parantaminen ja myynti:** hopealla ja raudalla, jopa +5.
- **Taso 1–20 ja taitopuu:** Korppi (parkour), Soturi (taistelu), Salamurhaaja (hiiviskely). 11 taitoa.

Lisäksi 12 kerättävää Korpin sulkaa. Täysi synkronointi: älä jää kertaakaan kiinni.

Heinäkärryt pehmentävät pudotuksen: kokeile uskon loikkaa tornin lankulta.

## Ajaminen paikallisesti
```bash
python3 -m http.server 8765
```
Avaa sitten http://localhost:8765
