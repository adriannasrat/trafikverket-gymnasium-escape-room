import type { GameType } from "../types";

type AdminGameCopy = {
  routeLabel: string;
  timeLabel: string;
  listTitle: string;
  listDescription: string;
  itemLabel: string;
  editorLabel: string;
  addLabel: string;
  indefiniteItem: string;
  definiteItem: string;
  definiteItemCapitalized: string;
  minimumItem: string;
};

export const gameTypeOrder: GameType[] = [
  "Quiz",
  "Matching",
  "TrueFalse",
  "PixelHunt",
  "Sorting",
  "WordAssembly",
  "Hangman",
];

export const gameCatalog: Record<GameType, AdminGameCopy> = {
  Quiz: {
    routeLabel: "Digital trafikledning",
    timeLabel: "TID PER UPPDRAG (SEK)",
    listTitle: "FRÅGOR I SPELET",
    listDescription: "Lägg till textfrågor eller använd en bild som deltagaren ska tolka.",
    itemLabel: "UPPDRAG",
    editorLabel: "FRÅGA / INSTRUKTION",
    addLabel: "Lägg till fråga",
    indefiniteItem: "En ny fråga",
    definiteItem: "frågan",
    definiteItemCapitalized: "Frågan",
    minimumItem: "en fråga",
  },
  Matching: {
    routeLabel: "Säkra vägar",
    timeLabel: "TID FÖR MATCHNING (SEK)",
    listTitle: "SCENARIER I SPELET",
    listDescription: "Varje scenario kopplas till exakt en av riskzonerna ovan.",
    itemLabel: "SCENARIO",
    editorLabel: "SCENARIO / HÄNDELSE",
    addLabel: "Lägg till scenario",
    indefiniteItem: "Ett nytt scenario",
    definiteItem: "scenariot",
    definiteItemCapitalized: "Scenariot",
    minimumItem: "ett scenario",
  },
  TrueFalse: {
    routeLabel: "Digital säkerhet",
    timeLabel: "TID PER UPPDRAG (SEK)",
    listTitle: "PÅSTÅENDEN I SPELET",
    listDescription: "Deltagaren avgör om varje påstående är sant eller falskt.",
    itemLabel: "PÅSTÅENDE",
    editorLabel: "PÅSTÅENDE",
    addLabel: "Lägg till påstående",
    indefiniteItem: "Ett nytt påstående",
    definiteItem: "påståendet",
    definiteItemCapitalized: "Påståendet",
    minimumItem: "ett påstående",
  },
  PixelHunt: {
    routeLabel: "Pixeljakten",
    timeLabel: "TID PER BILD (SEK)",
    listTitle: "BILDER I SPELET",
    listDescription: "Bilden visas pixlad. Varje klick gör den skarpare men lägger till 5 sekunder på totaltiden.",
    itemLabel: "BILDFRÅGA",
    editorLabel: "FRÅGA OM BILDEN",
    addLabel: "Lägg till bildfråga",
    indefiniteItem: "En ny bildfråga",
    definiteItem: "bildfrågan",
    definiteItemCapitalized: "Bildfrågan",
    minimumItem: "en bildfråga",
  },
  Sorting: {
    routeLabel: "Sortera rätt",
    timeLabel: "TID PER SORTERING (SEK)",
    listTitle: "SORTERINGSRUNDOR I SPELET",
    listDescription: "Varje kort kopplas till ett område. Kort utan målkategori ska lämnas kvar som bluffkort.",
    itemLabel: "SORTERING",
    editorLabel: "INSTRUKTION TILL SORTERINGEN",
    addLabel: "Lägg till sortering",
    indefiniteItem: "En ny sorteringsrunda",
    definiteItem: "sorteringsrundan",
    definiteItemCapitalized: "Sorteringsrundan",
    minimumItem: "en sorteringsrunda",
  },
  WordAssembly: {
    routeLabel: "Bilda ordet",
    timeLabel: "TID PER ORD (SEK)",
    listTitle: "ORD I SPELET",
    listDescription: "Varje uppdrag består av orddelar. Ordningen från vänster till höger är det rätta sammansatta ordet.",
    itemLabel: "ORD",
    editorLabel: "INSTRUKTION TILL ORDET",
    addLabel: "Lägg till ord",
    indefiniteItem: "Ett nytt ord",
    definiteItem: "ordet",
    definiteItemCapitalized: "Ordet",
    minimumItem: "ett ord",
  },
  Hangman: {
    routeLabel: "Signalordet",
    timeLabel: "TID PER SIGNALORD (SEK)",
    listTitle: "SIGNALORD I SPELET",
    listDescription: "Skriv en ledtråd och ett hemligt ord. Spelaren ser bara ledtråden och gissar en bokstav i taget.",
    itemLabel: "SIGNALORD",
    editorLabel: "LEDTRÅD TILL ORDET",
    addLabel: "Lägg till signalord",
    indefiniteItem: "Ett nytt signalord",
    definiteItem: "signalordet",
    definiteItemCapitalized: "Signalordet",
    minimumItem: "ett signalord",
  },
};

export function getAdminGameCopy(type: GameType): AdminGameCopy {
  return gameCatalog[type];
}
