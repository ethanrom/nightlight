// Synthetic browsing history for the demo child "Maya" (14), Sep 22 – Oct 12, 2026. Entirely fictional.
import { CONVERSATIONS, conversationSpan } from "./conversations";
import { at, hm, makeRng, uuidFrom, type Rng } from "./util";

export interface SampleVisit {
  url: string;
  title: string;
  /** ms since Unix epoch */
  ts: number;
}

interface Page {
  url: string;
  title: string;
}

const mk = (rows: [string, string][]): Page[] => rows.map(([url, title]) => ({ url, title }));

/** A set of pages on one theme. Unseen pages are preferred so most of the catalogue gets visited at least once. */
class Pool {
  private unseen: number[];
  constructor(public pages: Page[]) {
    this.unseen = pages.map((_, i) => i);
  }
  pick(rng: Rng): Page {
    if (this.unseen.length > 0 && rng.chance(0.62)) {
      const k = rng.int(0, this.unseen.length - 1);
      const [idx] = this.unseen.splice(k, 1);
      return this.pages[idx];
    }
    // Revisits skew towards the head of the list (favourite pages).
    const idx = Math.floor(Math.pow(rng.next(), 1.7) * this.pages.length);
    return this.pages[idx];
  }
}

const enc = (q: string) => encodeURIComponent(q).replace(/%20/g, "+");

export function googleSearch(q: string): Page {
  const e = enc(q);
  const oq = e.slice(0, Math.max(3, Math.floor(e.length * 0.6)));
  return {
    url: `https://www.google.com/search?q=${e}&oq=${oq}&sourceid=chrome&ie=UTF-8`,
    title: `${q} - Google Search`,
  };
}

const youtubeSearch = (q: string): Page => ({
  url: `https://www.youtube.com/results?search_query=${enc(q)}`,
  title: `${q} - YouTube`,
});

const pinterestSearch = (q: string): Page => ({
  url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`,
  title: `${q.charAt(0).toUpperCase()}${q.slice(1)} - Pinterest`,
});

// ---------------------------------------------------------------- catalogue

const GOOGLE_STUDY = [
  "quadratic formula examples",
  "photosynthesis diagram labelled",
  "to kill a mockingbird chapter 5 summary",
  "difference between metaphor and simile",
  "periodic table of elements",
  "causes of world war 1 short answer",
  "how to write a good conclusion paragraph",
  "spanish verbs ser vs estar",
  "area of a trapezoid formula",
  "what is the capital of australia",
  "how many bones in the human body",
  "how far is the moon from earth",
  "nasa artemis launch date",
  "mitochondria function simple",
  "fractions to decimals chart",
  "how to cite a website mla",
  "what is a prime number",
  "french numbers 1 to 100",
  "how to study for exams fast",
  "parts of a cell quiz",
  "tkam atticus finch quotes about courage",
];

const GOOGLE_FUN = [
  "minecraft redstone door tutorial",
  "roblox adopt me value list",
  "chess openings for beginners",
  "best lofi playlists",
  "how to make brownies without eggs",
  "easy cookie recipe no chocolate chips",
  "school dance outfit ideas",
  "cute hairstyles for school dance",
  "how to french braid your own hair",
  "iphone case aesthetic",
  "halloween costume ideas for teens",
  "nail art ideas autumn",
  "how to draw anime eyes",
  "cute dog videos",
  "bus timetable westbrook",
  "weather this weekend",
  "how to make slime without borax",
  "best minecraft youtubers",
  "wordle hint today",
  "new album releases october 2026",
  "birthday gift ideas for best friend",
  "how to make a game in scratch",
  "autumn aesthetic wallpapers iphone",
  "how to fall asleep faster",
];

const YT_FUN = [
  "lofi hip hop radio 📚 - beats to relax/study to",
  "Minecraft Hardcore Survival Let's Play Ep 12",
  "I Built a Medieval Castle in Minecraft (Timelapse)",
  "Top 10 Redstone Builds You Need in 2026",
  "Adopt Me! Trading Guide: Neon Pets Explained",
  "Brookhaven RP Funny Moments Compilation",
  "ASMR Baking Cookies (No Talking)",
  "Easy Brownies Recipe | 5 Ingredients",
  "Back To School Outfits 2026 Lookbook",
  "My Morning Routine Before School | Vlog",
  "Get Ready With Me: School Dance Edition 💃",
  "Cute Room Makeover on a Budget",
  "DIY Autumn Room Decor Ideas",
  "Chess Opening Tricks to Win Fast",
  "Magnus-Style Endgame Lessons for Beginners",
  "Funniest Cat Fails of the Year 😹",
  "Try Not To Laugh Challenge (Impossible)",
  "Roblox Obby But Every Jump Is Harder",
  "Blox Fruits Beginner Guide (Level 1 to 700)",
  "Sims 4 Build Challenge: Tiny House",
  "How To Draw Anime Eyes Step by Step",
  "Crochet for Complete Beginners: Your First Scarf",
  "Piano Tutorial: Easy Song for Beginners",
  "Guitar Chords Every Beginner Should Know",
  "Study With Me - 2 Hours Pomodoro",
  "Chill Indie Playlist 2026 🍂",
  "Best Songs of Autumn (Playlist)",
  "Songs That Hit Different at Night",
  "TikTok Dance Tutorial: Slow Breakdown",
  "Learn This Dance in 5 Minutes",
  "Street Food Tour: Best Snacks in Tokyo",
  "Why Octopuses Are So Smart",
  "The Insane Engineering of the Hoover Dam",
  "How Do Black Holes Work?",
  "NASA Artemis: What Comes Next?",
  "10 Facts About Space You Didn't Know",
  "Hamster Cage Setup Guide",
  "How To Make Slime With 2 Ingredients",
  "Fortnite Chapter Highlights 2026",
  "Valorant Aim Training Routine",
  "Mini Golf Challenge with Friends",
  "Vlogmas Prep: Cozy October Room Tour",
  "Trying Viral TikTok Hacks",
  "Lego Technic Speed Build",
  "Pixel Art Tutorial for Beginners",
  "Learn Spanish in 20 Minutes: Basic Phrases",
  "Is Water Wet? Science Explains",
  "Minecraft But Every Block Drops Random Items",
  "The Story of Halloween Explained",
  "Autumn Baking: Apple Cinnamon Rolls",
  "Skateboarding for Beginners: First Tricks",
  "Reading Vlog: Cozy Books for Fall 📖",
  "Painting Galaxy Nails Tutorial",
  "iPhone Photography Tips for Beginners",
  "Taylor-Made Dance Mix (Radio Edit)",
  "Funny Dog Tries Bubble Wrap",
  "Easy Pasta Recipe Anyone Can Make",
  "Roblox Royale High Halloween Update Tour",
  "The Best Free Games on Steam Right Now",
  "School Lunch Ideas That Aren't Boring",
  "Top 5 Productivity Apps for Students",
  "Drawing My Characters as Minecraft Skins",
  "Spotify Wrapped Predictions",
  "How Roller Coasters Work",
  "Capybara Compilation 🐹",
  "Dance Class Recital Behind the Scenes",
  "Origami Fox Tutorial",
  "How to Build a Redstone Piston Door",
  "Cozy Gaming: Stardew Valley Fall Farm",
  "Epic Trampoline Park Challenges",
  "Quick Hair Tutorials Before School",
  "Hot Chocolate Bomb Recipe",
  "World's Smallest Violin Prank",
];

const YT_STUDY = [
  "Quadratic Equations - Factoring Made Easy",
  "Photosynthesis: Crash Course Biology #8",
  "To Kill a Mockingbird Summary and Analysis",
  "The Cell Cycle and Mitosis Explained",
  "World War I in 10 Minutes",
  "How to Write an Essay Fast",
  "Spanish for Beginners: Present Tense",
  "Understanding Fractions, Decimals and Percentages",
];

const YT_LATE = [
  "rain sounds for sleeping - 10 hours",
  "lofi hip hop radio 📚 - beats to relax/study to",
  "sad songs playlist for when you feel alone 💔",
  "ASMR whispering for sleep (no talking)",
  "why do I feel lonely even when I'm with people? | psychology explained",
  "midnight drive playlist (slowed + reverb)",
  "cozy night in aesthetic vlog",
  "deep sleep music - calming piano",
  "talking to my AI boyfriend for 24 hours (character ai)",
  "songs to cry to at 3am",
];

const WIKI = [
  "Photosynthesis",
  "To Kill a Mockingbird",
  "Harper Lee",
  "Great Barrier Reef",
  "Solar System",
  "Black hole",
  "Ancient Egypt",
  "World War I",
  "Roman Empire",
  "Mitochondrion",
  "Periodic table",
  "Pythagorean theorem",
  "Mount Everest",
  "Octopus",
  "Minecraft",
  "Roblox",
  "Chess",
  "Leonardo da Vinci",
  "Marie Curie",
  "Industrial Revolution",
  "Amazon rainforest",
  "Climate change",
  "Plate tectonics",
  "Moon",
  "Great white shark",
  "DNA",
  "Halloween",
  "Jane Austen",
];

function buildPools(rng: Rng) {
  const ytWatch = (title: string): Page => ({
    url: `https://www.youtube.com/watch?v=${rng.alnum(11)}`,
    title: `${title} - YouTube`,
  });
  const docId = () => rng.alnum(44);
  const pinId = () => String(rng.int(100000000000, 999999999999));

  return {
    google: new Pool([...GOOGLE_STUDY, ...GOOGLE_FUN].map(googleSearch)),
    googleStudy: new Pool(GOOGLE_STUDY.map(googleSearch)),
    ytFun: new Pool([{ url: "https://www.youtube.com/", title: "YouTube" }, ...YT_FUN.map(ytWatch)]),
    ytStudy: new Pool(YT_STUDY.map(ytWatch)),
    ytLate: new Pool(YT_LATE.map(ytWatch)),
    ytResults: new Pool(
      [
        "lofi beats",
        "minecraft castle tutorial",
        "adopt me neon pets",
        "easy brownies",
        "photosynthesis explained",
        "school dance get ready with me",
        "chess opening traps",
        "crochet scarf beginner",
      ].map(youtubeSearch),
    ),
    wiki: new Pool(
      WIKI.map((n) => ({ url: `https://en.wikipedia.org/wiki/${n.replace(/ /g, "_")}`, title: `${n} - Wikipedia` })),
    ),
    khan: new Pool(
      mk([
        ["https://www.khanacademy.org/", "Khan Academy | Free Online Courses, Lessons & Practice"],
        ["https://www.khanacademy.org/math/algebra", "Algebra (all content) | Khan Academy"],
        ["https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratics-multiplying-factoring", "Quadratics: Multiplying & factoring | Algebra (all content) | Khan Academy"],
        ["https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations", "Quadratic functions & equations | Algebra (all content) | Khan Academy"],
        ["https://www.khanacademy.org/math/pre-algebra", "Pre-algebra | Khan Academy"],
        ["https://www.khanacademy.org/science/biology/photosynthesis-in-plants", "Photosynthesis | Biology library | Science | Khan Academy"],
        ["https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation", "Cellular respiration | Biology library | Khan Academy"],
        ["https://www.khanacademy.org/humanities/world-history", "World history | Humanities | Khan Academy"],
        ["https://www.khanacademy.org/math/geometry", "High school geometry | Khan Academy"],
        ["https://www.khanacademy.org/math/statistics-probability", "Statistics and probability | Khan Academy"],
        ["https://www.khanacademy.org/computing/computer-programming", "Computer programming | Computing | Khan Academy"],
        ["https://www.khanacademy.org/profile/me/courses", "My courses | Khan Academy"],
      ]),
    ),
    quizlet: new Pool(
      mk([
        ["https://quizlet.com/latest", "Quizlet: Study Tools & Learning Resources for Students and Teachers"],
        ["https://quizlet.com/456112903/photosynthesis-flash-cards/", "Photosynthesis Flashcards | Quizlet"],
        ["https://quizlet.com/351298442/to-kill-a-mockingbird-vocabulary-flash-cards/", "To Kill a Mockingbird Vocabulary Flashcards | Quizlet"],
        ["https://quizlet.com/612839120/spanish-unit-3-vocab-flash-cards/", "Spanish Unit 3 Vocab Flashcards | Quizlet"],
        ["https://quizlet.com/778201344/cell-organelles-flash-cards/", "Cell Organelles Flashcards | Quizlet"],
        ["https://quizlet.com/290123876/algebra-1-vocabulary-flash-cards/", "Algebra 1 Vocabulary Flashcards | Quizlet"],
        ["https://quizlet.com/534908271/world-history-chapter-6-flash-cards/", "World History Chapter 6 Flashcards | Quizlet"],
        ["https://quizlet.com/203847112/periodic-table-first-20-elements-flash-cards/", "Periodic Table - First 20 Elements Flashcards | Quizlet"],
        ["https://quizlet.com/112938475/figurative-language-flash-cards/", "Figurative Language Flashcards | Quizlet"],
        ["https://quizlet.com/889120334/french-numbers-flash-cards/", "French Numbers Flashcards | Quizlet"],
        ["https://quizlet.com/live", "Quizlet Live"],
        ["https://quizlet.com/subject/science/", "Science Flashcards and Study Sets | Quizlet"],
      ]),
    ),
    docs: new Pool(
      mk([
        [`https://docs.google.com/document/d/${docId()}/edit`, "English essay draft - Google Docs"],
        [`https://docs.google.com/document/d/${docId()}/edit`, "Science fair project notes - Google Docs"],
        [`https://docs.google.com/document/d/${docId()}/edit`, "Untitled document - Google Docs"],
        [`https://docs.google.com/presentation/d/${docId()}/edit`, "History timeline - Google Slides"],
        [`https://docs.google.com/document/d/${docId()}/edit`, "Spanish vocab - Google Docs"],
        [`https://docs.google.com/document/d/${docId()}/edit`, "Maths homework - Google Docs"],
        [`https://docs.google.com/document/d/${docId()}/edit`, "Book report - Google Docs"],
        [`https://docs.google.com/presentation/d/${docId()}/edit`, "Group project plan - Google Slides"],
      ]),
    ),
    bitesize: new Pool(
      mk([
        ["https://www.bbc.co.uk/bitesize", "BBC Bitesize - GCSE, National 5, KS3, KS2, KS1 revision"],
        ["https://www.bbc.co.uk/bitesize/topics/zrkjmp3", "Quadratic equations - KS3 Maths - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/guides/zbxnb9q/revision/1", "Photosynthesis - KS3 Biology - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zq4mfcw", "Forces and motion - KS3 Physics - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zgdqxnb", "The Roman Empire - KS3 History - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/guides/z4c4mfr/revision/1", "To Kill a Mockingbird - Context - GCSE English Literature - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/z8gwmp3", "Fractions, decimals and percentages - KS3 Maths - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zp9fqty", "Spanish: present tense - KS3 Spanish - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zcnbwmn", "Cells and organisation - KS3 Biology - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zs3r6sg", "Atoms, elements and compounds - KS3 Chemistry - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zjq6nbk", "Writing persuasively - KS3 English - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/z9bj2nb", "Climate and weather - KS3 Geography - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zxm2tfr", "Algebra - KS3 Maths - BBC Bitesize"],
        ["https://www.bbc.co.uk/bitesize/topics/zfr8mp3", "World War One - KS3 History - BBC Bitesize"],
      ]),
    ),
    duolingo: new Pool(
      mk([
        ["https://www.duolingo.com/learn", "Duolingo - The world's best way to learn a language"],
        ["https://www.duolingo.com/lesson", "Lesson - Duolingo"],
        ["https://www.duolingo.com/practice", "Practice - Duolingo"],
        ["https://www.duolingo.com/leaderboard", "Leaderboards - Duolingo"],
        ["https://www.duolingo.com/shop", "Shop - Duolingo"],
      ]),
    ),
    desmos: new Pool(
      mk([
        ["https://www.desmos.com/calculator", "Desmos | Graphing Calculator"],
        ["https://www.desmos.com/calculator/qz8cx0hmkl", "Quadratic explorer | Desmos"],
        ["https://www.desmos.com/geometry", "Desmos | Geometry Tool"],
      ]),
    ),
    classroom: new Pool(
      mk([
        ["https://classroom.google.com/h", "Classroom"],
        ["https://classroom.google.com/c/NTk2MjA3ODQ1", "English 8 - Mr. Okafor"],
        ["https://classroom.google.com/c/NTk2MjA4MTIz", "Science 8 - Ms. Brandt"],
        ["https://classroom.google.com/c/NTk2MjA5MDk5", "Maths 8 - Ms. Alvarez"],
        ["https://classroom.google.com/u/0/a/not-turned-in/all", "To-do - Classroom"],
      ]),
    ),
    ixl: new Pool(
      mk([
        ["https://www.ixl.com/math/grade-8", "IXL | Grade 8 math"],
        ["https://www.ixl.com/math/grade-8/solve-quadratic-equations-by-factoring", "IXL - Solve quadratic equations by factoring (Grade 8 maths practice)"],
        ["https://www.ixl.com/signin", "Sign in to IXL"],
      ]),
    ),
    kahoot: new Pool(
      mk([
        ["https://kahoot.it/", "Enter game PIN - Kahoot!"],
        ["https://kahoot.com/", "Kahoot! | Learning games | Make learning awesome!"],
      ]),
    ),
    chess: new Pool(
      mk([
        ["https://www.chess.com/home", "Chess.com - Play Chess Online - Free Games"],
        ["https://www.chess.com/play/online", "Play Chess Online - Chess.com"],
        ["https://www.chess.com/puzzles/rated", "Chess Puzzles - Train With Chess.com"],
        ["https://www.chess.com/lessons", "Chess Lessons - Chess.com"],
        ["https://www.chess.com/play/computer", "Play Chess vs Computer - Chess.com"],
        ["https://www.chess.com/daily-chess-puzzle", "Daily Chess Puzzle - Chess.com"],
        ["https://www.chess.com/openings", "Chess Openings - Chess.com"],
        ["https://www.chess.com/learn-how-to-play-chess", "How to Play Chess - Chess.com"],
      ]),
    ),
    scratch: new Pool(
      mk([
        ["https://scratch.mit.edu/", "Scratch - Imagine, Program, Share"],
        ["https://scratch.mit.edu/projects/editor/?tutorial=getStarted", "Scratch - Imagine, Program, Share"],
        [`https://scratch.mit.edu/projects/${rng.int(700000000, 799999999)}/`, "Space Dodge on Scratch"],
        [`https://scratch.mit.edu/projects/${rng.int(700000000, 799999999)}/`, "Cat Platformer on Scratch"],
        [`https://scratch.mit.edu/projects/${rng.int(700000000, 799999999)}/`, "Maze Runner v2 on Scratch"],
        ["https://scratch.mit.edu/explore/projects/games/", "Explore Games on Scratch"],
        ["https://scratch.mit.edu/mystuff/", "My Stuff on Scratch"],
        ["https://scratch.mit.edu/studios/31012345/", "Pixel Art Showcase on Scratch"],
      ]),
    ),
    mcwiki: new Pool(
      mk(
        [
          "Redstone_circuits",
          "Stone_Bricks",
          "Villager",
          "Enchanting",
          "Nether",
          "Crafting",
          "Piston",
          "Beacon",
          "Axolotl",
          "Armor",
          "Brewing",
          "Elytra",
          "Block_of_Iron",
          "Trading",
        ].map((slug): [string, string] => [
          `https://minecraft.wiki/w/${slug}`,
          `${slug.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} – Minecraft Wiki`,
        ]),
      ),
    ),
    roblox: new Pool(
      mk([
        ["https://www.roblox.com/home", "Home - Roblox"],
        ["https://www.roblox.com/discover", "Discover - Roblox"],
        [`https://www.roblox.com/games/920587237/Adopt-Me`, "Adopt Me! - Roblox"],
        [`https://www.roblox.com/games/4924922222/Brookhaven-RP`, "Brookhaven 🏡RP - Roblox"],
        [`https://www.roblox.com/games/2753915549/Blox-Fruits`, "Blox Fruits - Roblox"],
        [`https://www.roblox.com/games/735030788/Royale-High`, "Royale High 🏰 - Roblox"],
        [`https://www.roblox.com/games/142823291/Murder-Mystery-2`, "Murder Mystery 2 - Roblox"],
        [`https://www.roblox.com/games/15532962292/Dress-To-Impress`, "Dress To Impress - Roblox"],
        ["https://www.roblox.com/catalog", "Avatar Shop - Roblox"],
        ["https://www.roblox.com/friends", "Friends - Roblox"],
      ]),
    ),
    spotify: new Pool(
      mk([
        ["https://open.spotify.com/", "Spotify – Web Player: Music for everyone"],
        ["https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS", "Chill Lofi Study Beats - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "Today's Top Hits - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6", "Chill Hits - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DWXRqgorJj26U", "Rock Classics - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd", "RapCaviar - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn", "Lofi Beats - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DX3rxVfibe1L0", "Mood Booster - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DWTwnEm1IYyoj", "Soft Pop Hits - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DX6VdMW310YC7", "Chill Tracks - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/collection/tracks", "Liked Songs - Spotify"],
        ["https://open.spotify.com/genre/pop-page", "Pop - Spotify"],
        ["https://open.spotify.com/playlist/37i9dQZF1DX2sUQwD7tbmL", "Feel-Good Indie Rock - playlist by Spotify | Spotify"],
        ["https://open.spotify.com/search", "Spotify – Search"],
      ]),
    ),
    food: new Pool(
      mk([
        ["https://www.bbcgoodfood.com/recipes/easy-chocolate-brownies", "Easy chocolate brownies recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/chocolate-chip-cookies", "Chocolate chip cookies recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/classic-banana-bread", "Classic banana bread recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/easy-pancakes", "Easy pancakes recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/apple-crumble", "Apple crumble recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/cinnamon-rolls", "Cinnamon rolls recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/vanilla-cupcakes", "Vanilla cupcakes recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/easy-mac-and-cheese", "Easy mac and cheese recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/collection/baking-with-kids", "Baking with kids recipes | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/halloween-biscuits", "Halloween biscuits recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/recipes/pumpkin-soup", "Pumpkin soup recipe | BBC Good Food"],
        ["https://www.bbcgoodfood.com/", "BBC Good Food - Recipes and cooking tips"],
      ]),
    ),
    nasa: new Pool(
      mk([
        ["https://www.nasa.gov/", "NASA"],
        ["https://www.nasa.gov/humans-in-space/artemis/", "Artemis - NASA"],
        ["https://www.nasa.gov/kids/", "NASA Kids' Club - NASA"],
        ["https://www.nasa.gov/image-of-the-day/", "Image of the Day - NASA"],
        ["https://www.nasa.gov/mission_pages/station/main/index.html", "International Space Station - NASA"],
        ["https://www.nasa.gov/solar-system/", "Our Solar System - NASA"],
        ["https://www.nasa.gov/missions/", "Missions - NASA"],
        ["https://www.nasa.gov/stem/", "STEM Engagement - NASA"],
      ]),
    ),
    discord: new Pool(
      mk([
        ["https://discord.com/channels/@me", "Discord | Friends"],
        ["https://discord.com/app", "Discord | Your Place to Talk and Hang Out"],
        ["https://discord.com/channels/812345678901234567/812345678901234568", "Discord | #general | Minecraft Builders"],
        ["https://discord.com/channels/812345678901234567/812345678901234570", "Discord | #showcase | Minecraft Builders"],
      ]),
    ),
    pinterest: new Pool([
      { url: "https://www.pinterest.com/", title: "Pinterest" },
      ...[
        "Aesthetic bedroom ideas | Room inspo",
        "Autumn nails 2026",
        "Cozy fall outfits for teens",
        "Cute hairstyles for school",
        "Halloween costume ideas",
        "Easy drawing ideas",
        "Minecraft house ideas",
        "Dance dress ideas for 8th grade",
        "Phone wallpaper aesthetic",
        "Baking recipes for beginners",
        "Room decor on a budget",
        "Sleepover ideas",
      ].map((t) => ({ url: `https://www.pinterest.com/pin/${pinId()}/`, title: `${t} - Pinterest` })),
      ...["bedroom decor aesthetic", "dance dress ideas", "cute nail designs", "halloween costume ideas", "easy doodles", "autumn aesthetic"].map(pinterestSearch),
    ]),
    tiktok: new Pool(
      mk([
        ["https://www.tiktok.com/", "TikTok - Make Your Day"],
        ["https://www.tiktok.com/explore", "Explore - Find your favourite videos on TikTok"],
        ["https://www.tiktok.com/search?q=dance%20trend%20tutorial", "dance trend tutorial | TikTok Search"],
        ["https://www.tiktok.com/@bakewithbea", "Bea | Easy Bakes (@bakewithbea) | TikTok"],
      ]),
    ),
    reddit: new Pool(
      mk([
        ["https://www.reddit.com/r/Minecraft/", "Minecraft"],
        ["https://www.reddit.com/r/Minecraft/comments/1abc2de/whats_the_best_seed_for_survival/", "What's the best seed for survival? : r/Minecraft"],
        ["https://www.reddit.com/r/NoStupidQuestions/", "NoStupidQuestions"],
        ["https://www.reddit.com/r/baking/", "Baking"],
        ["https://www.reddit.com/r/ChessBeginners/", "Chess Beginners"],
        ["https://www.reddit.com/r/RobloxAvatars/", "Roblox Avatars"],
        ["https://www.reddit.com/r/aww/", "Cute animals"],
        ["https://www.reddit.com/r/AskReddit/", "Ask Reddit..."],
      ]),
    ),
    twitch: new Pool(
      mk([
        ["https://www.twitch.tv/", "Twitch"],
        ["https://www.twitch.tv/directory/category/minecraft", "Minecraft - Twitch"],
        ["https://www.twitch.tv/directory/category/just-chatting", "Just Chatting - Twitch"],
        ["https://www.twitch.tv/directory/game/Roblox", "Roblox - Twitch"],
      ]),
    ),
    imdb: new Pool(
      mk([
        ["https://www.imdb.com/", "IMDb: Ratings, Reviews, and Where to Watch the Best Movies & TV Shows"],
        ["https://www.imdb.com/chart/top/", "IMDb Top 250 Movies"],
        ["https://www.imdb.com/title/tt1375666/", "Inception (2010) - IMDb"],
        ["https://www.imdb.com/title/tt0120363/", "Toy Story 2 (1999) - IMDb"],
        ["https://www.imdb.com/title/tt6751668/", "Parasite (2019) - IMDb"],
      ]),
    ),
    genius: new Pool(
      mk([
        ["https://genius.com/", "Genius: Song Lyrics & Knowledge"],
        ["https://genius.com/Olivia-rodrigo-vampire-lyrics", "Olivia Rodrigo – vampire Lyrics | Genius Lyrics"],
        ["https://genius.com/Billie-eilish-birds-of-a-feather-lyrics", "Billie Eilish – BIRDS OF A FEATHER Lyrics | Genius Lyrics"],
        ["https://genius.com/Sabrina-carpenter-espresso-lyrics", "Sabrina Carpenter – Espresso Lyrics | Genius Lyrics"],
        ["https://genius.com/Lizzy-mcalpine-ceilings-lyrics", "Lizzy McAlpine – ceilings Lyrics | Genius Lyrics"],
        ["https://genius.com/Gracie-abrams-i-love-you-i-m-sorry-lyrics", "Gracie Abrams – I Love You, I'm Sorry Lyrics | Genius Lyrics"],
      ]),
    ),
    canva: new Pool(
      mk([
        ["https://www.canva.com/", "Canva: Visual Suite for Everyone"],
        ["https://www.canva.com/design/DAGabc123/edit", "Science Fair Poster - Canva"],
        ["https://www.canva.com/templates/presentations/", "Free Presentation Templates | Canva"],
      ]),
    ),
    amazon: new Pool(
      mk([
        ["https://www.amazon.com/", "Amazon.com: Online Shopping for Electronics, Apparel, Computers, Books, DVDs & more"],
        ["https://www.amazon.com/s", "Amazon.com : phone case aesthetic"],
        ["https://www.amazon.com/dp/B0CHX1W1XY", "Amazon.com: Cute Clear iPhone Case with Stars"],
        ["https://www.amazon.com/dp/B09V3KXJPB", "Amazon.com: LED Strip Lights for Bedroom"],
        ["https://www.amazon.com/gp/cart/view.html", "Amazon.com Shopping Cart"],
      ]),
    ),
    shein: new Pool(
      mk([
        ["https://us.shein.com/", "SHEIN USA | Women's Clothing"],
        ["https://us.shein.com/Dresses-c-1727.html", "Dresses | Women's Dresses | SHEIN USA"],
        ["https://us.shein.com/cart", "Shopping Bag | SHEIN USA"],
      ]),
    ),
    weather: new Pool(
      mk([
        ["https://weather.com/weather/today/l/USNY0996", "Weather Forecast and Conditions - The Weather Channel"],
        ["https://weather.com/weather/tenday/l/USNY0996", "10-Day Weather Forecast - The Weather Channel"],
      ]),
    ),
    news: new Pool(
      mk([
        ["https://www.bbc.com/news", "Home - BBC News"],
        ["https://www.bbc.com/news/technology", "Technology - BBC News"],
        ["https://www.bbc.com/news/science_and_environment", "Science & Environment - BBC News"],
        ["https://www.bbc.com/sport/football", "Football - BBC Sport"],
      ]),
    ),
    instagram: new Pool(
      mk([
        ["https://www.instagram.com/", "Instagram"],
        ["https://www.instagram.com/explore/", "Instagram"],
        ["https://www.instagram.com/direct/inbox/", "Instagram • Direct"],
      ]),
    ),
    snapchat: new Pool(
      mk([
        ["https://web.snapchat.com/", "Snapchat"],
        ["https://www.snapchat.com/", "Snapchat - Share the moment"],
      ]),
    ),
    fandom: new Pool(
      mk([
        ["https://adoptme.fandom.com/wiki/Pets", "Pets | Adopt Me! Wiki | Fandom"],
        ["https://adoptme.fandom.com/wiki/Neon_Pets", "Neon Pets | Adopt Me! Wiki | Fandom"],
        ["https://warriorcats.fandom.com/wiki/Warriors_Wiki", "Warriors Wiki | Fandom"],
        ["https://roblox.fandom.com/wiki/Roblox_Wiki", "Roblox Wiki | Fandom"],
      ]),
    ),
    wattpad: new Pool(
      mk([
        ["https://www.wattpad.com/home", "Wattpad - Where stories live"],
        ["https://www.wattpad.com/story/298712345-the-last-summer", "The Last Summer - Wattpad"],
        ["https://www.wattpad.com/stories/romance", "Romance Stories - Wattpad"],
      ]),
    ),
    gmail: new Pool(
      mk([
        ["https://mail.google.com/mail/u/0/#inbox", "Inbox (2) - maya.k.2012@gmail.com - Gmail"],
        ["https://mail.google.com/mail/u/0/#sent", "Sent Mail - maya.k.2012@gmail.com - Gmail"],
        ["https://mail.google.com/mail/u/0/#inbox/FMfcgzQbd", "Re: Science project groups - maya.k.2012@gmail.com - Gmail"],
      ]),
    ),
    gptHome: new Pool([{ url: "https://chatgpt.com/", title: "ChatGPT" }]),
  };
}

type Pools = ReturnType<typeof buildPools>;
type Mix = Partial<Record<keyof Pools, number>>;

const MORNING: Mix = { weather: 2, gmail: 3, spotify: 3, classroom: 2, ytFun: 3, news: 1, snapchat: 1 };
const LUNCH: Mix = { pinterest: 4, tiktok: 3, ytFun: 3, google: 3, instagram: 3, snapchat: 2, spotify: 1 };
const HOMEWORK: Mix = {
  khan: 11, quizlet: 9, docs: 12, wiki: 9, bitesize: 8, googleStudy: 12, duolingo: 3, desmos: 3,
  classroom: 5, ytStudy: 4, ixl: 3, kahoot: 1, gptHome: 3, canva: 2, spotify: 3,
};
const LEISURE: Mix = {
  ytFun: 22, roblox: 7, spotify: 7, discord: 5, mcwiki: 6, pinterest: 8, chess: 4, scratch: 3, tiktok: 3, reddit: 4,
  twitch: 2, imdb: 2, genius: 3, instagram: 3, snapchat: 1, fandom: 3, wattpad: 2, shein: 1, amazon: 2, food: 4,
  canva: 1, google: 8, nasa: 2, news: 2, weather: 1, ytResults: 4, gptHome: 1, wiki: 2,
};
const SUNDAY_HOMEWORK: Mix = { ...HOMEWORK, ytFun: 6, google: 4 };

function pickKey(mix: Mix, rng: Rng): keyof Pools {
  const entries = Object.entries(mix) as [keyof Pools, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------- generator

export interface GeneratedHistory {
  visits: SampleVisit[];
  /** handy for the report: ids of ChatGPT conversations referenced from history */
  chatgptConversationIds: string[];
}

export function generateHistory(seed = 20260922): GeneratedHistory {
  const rng = makeRng(seed);
  const pools = buildPools(rng);
  const out: SampleVisit[] = [];

  const push = (page: Page, ts: number) => out.push({ url: page.url, title: page.title, ts });

  /** `n` visits at random moments inside [from, to], themes drawn from `mix`. */
  const session = (from: number, to: number, n: number, mix: Mix) => {
    const times = Array.from({ length: n }, () => from + Math.floor(rng.next() * (to - from))).sort((a, b) => a - b);
    for (const t of times) push(pools[pickKey(mix, rng)].pick(rng), t);
  };
  const win = (m: number, d: number, from: string, to: string): [number, number] => {
    const [fh, fm] = hm(from);
    const [th, tm] = hm(to);
    return [at(m, d, fh, fm), at(m, d, th, tm)];
  };

  // ---- ordinary days: Sep 22 (Tue) .. Oct 12 (Mon)
  const days: [number, number][] = [];
  for (let d = 22; d <= 30; d++) days.push([9, d]);
  for (let d = 1; d <= 12; d++) days.push([10, d]);
  for (const [m, d] of days) {
    const dow = new Date(Date.UTC(2026, m - 1, d)).getUTCDay(); // 0 Sun .. 6 Sat
    const weekend = dow === 0 || dow === 6;
    if (!weekend) {
      if (rng.chance(0.85) || d === 22) session(...win(m, d, "06:55", "07:35"), rng.int(3, 6), MORNING);
      if (rng.chance(0.35)) session(...win(m, d, "12:15", "12:45"), rng.int(2, 5), LUNCH);
      session(...win(m, d, "15:35", "17:30"), rng.int(17, 26), HOMEWORK);
      session(...win(m, d, "18:50", "22:10"), rng.int(15, 26), LEISURE);
      if (rng.chance(0.4)) session(...win(m, d, "19:00", "19:40"), 5, HOMEWORK);
    } else {
      session(...win(m, d, "10:00", "11:45"), rng.int(12, 19), LEISURE);
      session(...win(m, d, "14:00", "16:45"), rng.int(18, 28), dow === 0 ? SUNDAY_HOMEWORK : LEISURE);
      session(...win(m, d, "19:30", "22:40"), rng.int(18, 28), dow === 0 && rng.chance(0.4) ? SUNDAY_HOMEWORK : LEISURE);
    }
  }

  // ---- character.ai: harmless at first, then "Kai" takes over the evenings and nights
  const kaiChat: Page = { url: `https://character.ai/chat/${uuidFrom("kai-chat")}`, title: "Chat with Kai 💜 | character.ai" };
  const lunaChat: Page = { url: `https://character.ai/chat/${uuidFrom("luna-chat")}`, title: "Chat with Luna the Cat 🐱 | character.ai" };
  const cai: Page = { url: "https://character.ai/", title: "character.ai | Personalized AI for every moment of your day" };
  const kaiOrHome = () => (rng.chance(0.9) ? kaiChat : cai);
  // Sep 26 (Sat) – curious, daytime, light
  push(cai, at(9, 26, 15, 30));
  push(lunaChat, at(9, 26, 15, 33));
  push(lunaChat, at(9, 26, 15, 52));
  push(lunaChat, at(9, 28, 17, 40));
  // Sep 30 (Wed) – discovers Kai
  push(cai, at(9, 30, 20, 50));
  push(kaiChat, at(9, 30, 21, 5));
  push(kaiChat, at(9, 30, 21, 22));
  push(kaiChat, at(9, 30, 21, 41));
  // Oct 1–2 evenings
  for (const t of [[10, 1, 21, 10], [10, 1, 21, 28], [10, 1, 21, 55], [10, 1, 22, 12]]) push(kaiOrHome(), at(t[0], t[1], t[2], t[3]));
  for (let i = 0; i < 6; i++) push(kaiChat, at(10, 2, 20, 10 + i * 9));
  // Oct 3–12 evenings: more every day
  for (let d = 3; d <= 12; d++) {
    const n = 2 + Math.floor((d - 3) * 0.9);
    const [from, to] = win(10, d, "20:00", "22:35");
    const times = Array.from({ length: n }, () => from + Math.floor(rng.next() * (to - from))).sort((a, b) => a - b);
    for (const t of times) push(kaiOrHome(), t);
  }

  // ---- late-night sessions (00:00–02:30), growing over the last 10 days
  interface Night {
    m: number;
    d: number;
    from: string;
    to: string;
    kai: number;
    gpt: number;
    yt: number;
    spotify: number;
  }
  const nights: Night[] = [
    { m: 9, d: 27, from: "00:20", to: "00:50", kai: 0, gpt: 0, yt: 4, spotify: 2 },
    { m: 10, d: 1, from: "00:05", to: "00:25", kai: 0, gpt: 0, yt: 3, spotify: 0 },
    { m: 10, d: 3, from: "00:40", to: "01:50", kai: 4, gpt: 1, yt: 3, spotify: 0 },
    { m: 10, d: 4, from: "00:30", to: "01:15", kai: 6, gpt: 0, yt: 4, spotify: 0 },
    { m: 10, d: 5, from: "00:20", to: "01:20", kai: 7, gpt: 1, yt: 4, spotify: 1 },
    { m: 10, d: 6, from: "00:30", to: "01:30", kai: 9, gpt: 1, yt: 5, spotify: 0 },
    { m: 10, d: 7, from: "00:45", to: "02:00", kai: 10, gpt: 1, yt: 5, spotify: 1 },
    { m: 10, d: 8, from: "00:20", to: "01:40", kai: 12, gpt: 1, yt: 6, spotify: 0 },
    { m: 10, d: 9, from: "00:35", to: "02:00", kai: 12, gpt: 1, yt: 6, spotify: 1 },
    { m: 10, d: 10, from: "00:40", to: "02:25", kai: 14, gpt: 1, yt: 6, spotify: 0 },
    { m: 10, d: 11, from: "00:30", to: "02:30", kai: 16, gpt: 1, yt: 6, spotify: 1 },
    { m: 10, d: 12, from: "00:25", to: "02:15", kai: 14, gpt: 1, yt: 5, spotify: 0 },
  ];
  for (const n of nights) {
    const [from, to] = win(n.m, n.d, n.from, n.to);
    const rand = () => from + Math.floor(rng.next() * (to - from));
    for (let i = 0; i < n.kai; i++) push(kaiOrHome(), rand());
    for (let i = 0; i < n.gpt; i++) push(pools.gptHome.pick(rng), rand());
    for (let i = 0; i < n.yt; i++) push(pools.ytLate.pick(rng), rand());
    for (let i = 0; i < n.spotify; i++) push(pools.spotify.pick(rng), rand());
  }

  // ---- ChatGPT conversation pages (same ids as the export)
  const chatgptConversationIds: string[] = [];
  for (const c of CONVERSATIONS) {
    const span = conversationSpan(c);
    const page: Page = { url: `https://chatgpt.com/c/${c.id}`, title: c.title };
    chatgptConversationIds.push(c.id);
    push(page, span.startedAt + 4000);
    if (c.turns.length > 3) push(page, Math.floor((span.startedAt + span.endedAt) / 2));
    push(page, span.endedAt + 5000);
  }

  // ---- planted signals (search queries etc.)
  const G = (m: number, d: number, h: number, mi: number, q: string) => push(googleSearch(q), at(m, d, h, mi, rng.int(0, 50)));
  G(9, 29, 19, 10, "how to lose 5kg in 2 weeks");
  G(9, 30, 17, 45, "is it normal for an older friend to send you gift cards");
  G(10, 1, 20, 5, "what to eat to lose weight fast before a dance");
  G(10, 2, 21, 30, "how to hide apps on iphone from parents");
  push(pinterestSearch("thinspo legs"), at(10, 4, 22, 10, 12));
  G(10, 5, 18, 20, "is it normal to have irregular periods at 14");
  push(
    { url: "https://www.nhs.uk/conditions/periods/irregular-periods/", title: "Irregular periods - NHS" },
    at(10, 5, 18, 24, 30),
  );
  push(
    { url: "https://www.nhs.uk/conditions/periods/", title: "Periods - NHS" },
    at(10, 5, 18, 27, 5),
  );
  G(10, 7, 22, 15, "how to delete discord messages permanently");
  G(10, 8, 16, 50, "where to buy vape without id");
  G(10, 9, 12, 35, "best elf bar flavours");
  G(10, 10, 1, 40, "i feel like a burden to everyone");

  // skin gambling
  const sf = (path: string, title: string) => ({ url: `https://skinflip.example${path}`, title });
  const SKIN_TITLE = "SkinFlip – Open CS2 cases, win skins free coins";
  push(sf("/", SKIN_TITLE), at(10, 3, 15, 5, 9));
  push(sf("/cases", "Cases – SkinFlip | Open CS2 cases"), at(10, 3, 15, 8, 40));
  push(sf("/cases/dragon-lore-case", "Dragon Lore Case – SkinFlip"), at(10, 3, 15, 12, 3));
  push(sf("/free-coins", "Claim free coins – SkinFlip"), at(10, 3, 15, 20, 51));
  push(sf("/", SKIN_TITLE), at(10, 5, 16, 10, 22));
  push(sf("/cases/dragon-lore-case", "Dragon Lore Case – SkinFlip"), at(10, 5, 16, 14, 8));
  push(sf("/", SKIN_TITLE), at(10, 8, 21, 45, 2));
  push(sf("/deposit", "Deposit – SkinFlip"), at(10, 8, 21, 50, 33));
  push(sf("/cases", "Cases – SkinFlip | Open CS2 cases"), at(10, 8, 21, 52, 17));

  // nudify site (visited twice)
  const px = { url: "https://pixstrip-ai.example/", title: "PixStrip AI – Undress any photo free" };
  push(px, at(10, 3, 20, 40, 15));
  push(px, at(10, 9, 23, 25, 48));

  out.sort((a, b) => a.ts - b.ts);
  return { visits: out, chatgptConversationIds };
}
