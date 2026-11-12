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
| N | koko kartta ja pikamatka synkronoituihin torneihin |
| Tab / I | reppu, varusteet ja taidot |
| R | vaihda pää- ja toista asetta |
| E arkulla | avaa arkku (pudotukset poimitaan kävelemällä päälle) |
| E | salamurha / synkronoi / piiloudu heinään |
| Hiiri vasen / oikea | isku / torjunta |
| Q (pidä) | Korpin katse |

## Kartta: Pohjanranta
Iso avoin maailma (noin 600 × 600 m) maastoineen: kukkuloita, metsää, järvi, tiet ja vuoristoreunat.
- **Tuulimylly** keskellä (aloitus), maatila ja piilopaikka
- **Hallavuori** lounaassa: muurien ympäröimä kaupunki torilla, katedraalilla ja kellotornilla
- **Kalastajakylä** kaakossa: hirsitaloja, laitureita, pitkätalo ja vartiotorni
- **Korpilinna** pohjoisessa: linnoitus ja korkea torni
- **Rosvoleiri** luoteessa ja **rauniot** kukkulalla koillisessa
- Torneista voi synkronoida pisteen ja matkustaa sinne kartalta (N)

## Kampanja (9 tehtävää)
1. Kiipeä tuulimyllyn huipulle ja synkronoi kartta.
2. Matka Hallavuoren kaupunkiin.
3. Katokisa: lennä seitsemän renkaan läpi kattojen yli.
4. Salamurhaa kapteeni Aldric torilla.
5. Synkronoi kaupungin kellotorni.
6. Salamurhaa piispa Corvane katedraalin edustalla.
7. Salamurhaa verokuvernööri Maren kalastajakylän pitkätalon katolla.
8. Salamurhaa sotamarsalkka Hesk Korpilinnan tornin huipulla.
9. Pakene takaisin tuulimyllylle.

## Varusteet ja eteneminen
- **Harvinaisuudet:** tavallinen, hieno, harvinainen, eeppinen, legendaarinen — satunnaiset ominaisuudet (perkit) harvinaisuuden mukaan.
- **Aseet:** miekka, kirves (raskas, horjuttaa), keihäs (pitkä ulottuvuus), tikari (nopea, kriittinen). Kaksi asetta, vaihto R:llä.
- **Panssari ja talismaani:** puolustus, näkyvyys, kiipeämisnopeus, putoamisvahinko ym.
- **Saalis:** 24 arkkua (katoilla, torneissa, leirissä, raunioissa ja erämaassa), vartijoiden pudotukset ja kohteiden legendaariset aseet.
- **Parantaminen ja myynti:** hopealla ja raudalla, jopa +5.
- **Taso 1–20 ja taitopuu:** Korppi (parkour), Soturi (taistelu), Salamurhaaja (hiiviskely). 11 taitoa.

Lisäksi 14 kerättävää Korpin sulkaa (myös kukkuloiden huipuilla). Täysi synkronointi: älä jää kertaakaan kiinni.

Heinäkärryt pehmentävät pudotuksen: kokeile uskon loikkaa tornin lankulta.

## Ajaminen paikallisesti
```bash
python3 -m http.server 8765
```
Avaa sitten http://localhost:8765
