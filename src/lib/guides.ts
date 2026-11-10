/**
 * Blueprints (step-by-step business guides) and home recording cheat sheets, shown in Contracts & Blueprints →
 * Blueprints for Catalog Management. Plain reading material: general information, not legal, tax or financial advice.
 */
export type GuideStep = { title: string; text: string };
/** One section of a guide's pamphlet: the long-form read behind the steps (founder, 2026-11-06). */
export type GuideSection = { heading: string; body: string; /** Short bullet points under the body, printed in order. */ points?: string[] };
export type Guide = {
  id: string; kind: "Blueprint" | "Cheat sheet"; title: string; summary: string; steps: GuideStep[]; checklist?: string[];
  /**
   * Which numbered step each checklist item proves, by position: `stepOf[2] = 4` means the third item finishes step 5.
   * Without it an item follows the step at its own position, which is right for most blueprints. Once every item that
   * points at a step is ticked, that step crosses out in the list above (founder, 2026-11-06).
   */
  stepOf?: number[];
  /**
   * A pamphlet, for the guides that need more than a paragraph per step (founder, 2026-11-06): the detail sits below the
   * steps on screen and in the downloaded PDF, so the numbered steps stay the quick read.
   */
  pamphlet?: GuideSection[];
};

/**
 * Where one checklist item is actually done, so a blueprint reads as a to-do list you can work from instead of notes you
 * then have to hunt down (founder, 2026-11-06). A link is optional: no link means the step happens outside the app, like
 * joining a PRO.
 */
export type GuideLink = {
  /** The tooltip and screen-reader words, e.g. "Open My Catalog". */
  label: string;
  /** The screen that finishes the item; "blueprint" opens another guide in the same section. */
  where: "catalog" | "health" | "splits" | "profile" | "blueprint";
  /** The guide to open when `where` is "blueprint". */
  guideId?: string;
};

const s = (title: string, text: string): GuideStep => ({ title, text });

export const BLUEPRINT_GUIDES: Guide[] = [
  {
    id: "music-business-startup", kind: "Blueprint", title: "Independent Music Business Startup",
    summary: "Set up your music career as a real business: name, accounts, money and paperwork.",
    steps: [
      s("Pick your business name", "Use your artist name or a company name. Search it on streaming services, social media and your state's business registry to make sure nobody else is using it."),
      s("Choose a business type", "Many artists start as a sole proprietor. An LLC separates your personal and business money and limits your personal risk. Ask an accountant which fits you."),
      s("Get your tax ID", "In the US, an EIN from the IRS is free. You'll use it for bank accounts, distributors and royalty payments instead of your Social Security number."),
      s("Open a business bank account", "Keep every music dollar in and out of one account. It makes taxes, splits and proof of income simple."),
      s("Join the organizations that pay you", "Join a PRO as a writer, register with The MLC and SoundExchange. See the Royalty Registration blueprint."),
      s("Set up your catalog", "Add every song to My Catalog with writers, splits and codes, so registrations and exports are one click later."),
      s("Get it in writing", "Use a contract every time someone works on your music: producers, features, videographers, managers. Start from Contracts in this section."),
      s("Track money monthly", "Once a month, record income and expenses, save receipts and set aside a share for taxes (often 25–30% if you're self-employed)."),
    ],      checklist: ["Name checked", "Business type chosen", "EIN or tax ID", "Business bank account", "PRO, MLC, SoundExchange", "Catalog up to date", "Contracts for every collaborator", "Monthly money check"],
  },
  {
    id: "embed-defaults", kind: "Blueprint", title: "Set Your Embed Defaults",
    summary: "Fill your details in once, so every master you embed starts with your credits already in place. PRO affiliations, IPI numbers, splits and registration details stay in your catalog: they are never written into your music files.",
    steps: [
      s("Artist, label and contact", "Open Profile → Edit profile. These are the same three steps setup asks for the first time you sign in, and you can change any of them whenever your details do. Your primary artist or stage name is what every embed credits. Add your label name if you release under one, the contact email you want inside the file, and who usually produces, if that's always the same person."),
      s("Release details", "Pick your primary genre (and a secondary one if you use one), the language you usually record in, the country it's usually recorded in, your usual release type, and whether your songs are usually Explicit. Each song can still change these."),
      s("Registration answers", "Say whether your songs usually use a sample and whether they're usually written for film, TV, stage or an ad. Those are the two questions BMI asks, so answering them once saves the same answer on every song."),
      s("Master and copyright lines", "Set the share of the master you usually own and how you hold it, then your © (composition) and ℗ (sound recording) lines: the year, then the owner's name."),
      s("Add your regulars", "List the session players, backup vocalists and engineers who are on most of your songs, so neighbouring-rights registration has them ready."),
    ],
    checklist: ["Artist name and label", "Contact email to embed", "Genre, language and recorded-in", "Usual release type and Explicit", "Samples and written-for answered", "Master share and basis", "© and ℗ lines", "Regular performers and crew"],
    stepOf: [0, 0, 1, 1, 2, 3, 3, 4],
  },
  {
    id: "catalog-defaults", kind: "Blueprint", title: "Build Your Catalog Defaults",
    summary: "Your writer, publisher and registration details, filled in once, so every song, split sheet and export starts complete.",
    steps: [
      s("Add your legal name", "Legal name is what registration uses, on every song and every agency file. It can be added later if you haven't registered with a PRO yet."),
      s("List every writer with a role", "Author, Composer or Author/Composer. Author/Composer counts as both, and a song is only ready to register when it has an author (or is Instrumental) and a composer."),
      s("Add each writer's PRO and IPI", "Pick their PRO from the worldwide list and add their IPI name number. Both are needed to register a song, so leave them blank until a writer has them rather than guessing."),
      s("Make the default shares add to 100%", "A new song's split sheet starts from these shares, and it has to total exactly 100% before a song can be registered."),
      s("Say how publishing works for you", "Tick Self-published if you have no publisher, or list each publisher with its PRO, share and HFA number. A BMI writer with no publishing company has its own box, because BMI pays both halves."),
      s("Save, watch the meter, then check one song", "Save your defaults and watch the profile meter fill: the bar at the top counts the details that carry over to every song. It's a guide, not a gate, so nothing here holds back saving or embedding. Then open a song in My Catalog and confirm the details arrived with it. Anything you type on the song itself stays as you wrote it."),
    ],
    checklist: ["Legal name added", "Every writer has a role", "PRO on every writer", "IPI on every writer", "Writer shares total 100%", "Publisher or Self-published", "Publisher details and HFA", "Checked on a song"],
    stepOf: [0, 1, 2, 2, 3, 4, 4, 5],
  },
  {
    id: "record-label", kind: "Blueprint", title: "Start and Operate an Independent Record Label",
    summary: "Release your own music, or other artists', under a label name you control.",
    steps: [
      s("Decide what the label does", "Your own releases only, or signing other artists? A label for yourself mainly needs a name, a distributor and a system. Signing others needs contracts, money and time."),
      s("Form the business", "An LLC is common for labels. Register the name, get a tax ID and a separate bank account (see the Startup blueprint)."),
      s("Choose a distributor", "Pick one that lets you add a label name, gives you ISRC and UPC codes, and pays you clearly. Compare their fees and percentage."),
      s("Use clear artist deals", "For other artists, start with a license (the artist keeps ownership, you release for a set term) or label services. See the Independent Label License and Label Services contracts."),
      s("Own your codes and metadata", "Register as the recording owner with SoundExchange. Keep ISRCs, UPCs, credits and splits in My Catalog for every release."),
      s("Plan each release", "Set a release date 4–6 weeks out, deliver to the distributor, pitch to editorial playlists, prepare artwork, videos and posts. See the Release and Distribution blueprint."),
      s("Account to your artists", "Send statements at least twice a year showing income, costs and what's owed. Clear statements are what keep artists with a label."),
    ],
    checklist: ["Label purpose decided", "Business formed", "Distributor with label name", "Artist contracts", "SoundExchange as owner", "Release plan template", "Statement schedule"],
  },
  {
    id: "publishing-company", kind: "Blueprint", title: "Start and Operate a Music Publishing Company",
    summary: "Collect the publisher's share of your songwriting royalties yourself.",
    steps: [
      s("Know the two halves", "Songwriting income has a writer's share and a publisher's share. Without a publisher, some of the publisher's share can go uncollected."),
      s("Pick a publisher name", "Your PRO checks that the name isn't taken. Have two or three choices ready."),
      s("Register the publisher with your PRO", "Join as a publisher with the same PRO you're a writer with. Some PROs charge a one-time fee for publishers."),
      s("Get the publisher's IPI", "Your PRO gives the publisher its own IPI number. Add it to your publisher details in My Catalog."),
      s("Register every song", "List the song with you as writer and your company as publisher, with the right shares. In My Catalog, check that the song is Ready to register."),
      s("Collect mechanicals", "Register the publisher with The MLC for US streaming mechanicals."),
      s("Consider an administrator", "Collecting worldwide is hard. A publishing administrator collects for a percentage while you keep ownership (see the Publishing Administration contract)."),
    ],
    checklist: ["Writer and publisher halves", "Publisher name approved", "PRO publisher account", "Publisher IPI saved", "Songs registered with shares", "The MLC", "Administrator decision"],
    stepOf: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "production-business", kind: "Blueprint", title: "Build a Music Production Business",
    summary: "Turn beats and production into steady income: leases, exclusives, custom work and credits.",
    steps: [
      s("Decide how you sell", "Leases (non-exclusive) for volume, exclusives and buyouts for higher prices, and custom production for clients. Set clear prices for each."),
      s("Use a contract for every sale", "Use the Non-Exclusive Lease, Exclusive License, Beat Buyout and Producer Agreement contracts in this section, so every sale says what's included."),
      s("Protect your writer share", "Producers usually own a share of the song. Make sure it's on every split sheet and registered with your PRO."),
      s("Keep your files organized", "Name projects consistently and keep stems, tagged previews and project files backed up in two places."),
      s("Register your work", "Join a PRO as a writer, add your songs and credits to My Catalog, and claim producer credits on streaming services where you can."),
      s("Build repeat clients", "Deliver on time, communicate clearly and follow up after releases. Most production income comes from repeat artists."),
    ],
    checklist: ["Price list", "Contracts ready", "Writer share on split sheets", "PRO writer account", "Backups in two places", "Catalog credits", "Client follow-up"],
    stepOf: [0, 1, 2, 4, 3, 4, 5],
  },
  {
    id: "royalty-registration", kind: "Blueprint", title: "Music Royalty Registration and Collection",
    summary: "Register every song and recording so every royalty finds you.",
    steps: [
      s("Join a PRO as a writer", "ASCAP, BMI or your country's society (the worldwide list is in My Catalog). PROs collect performance royalties when your songs are played, streamed or performed."),
      s("Save your IPI number", "Your PRO gives you an IPI name number. Add it to your writer details in My Catalog; every registration needs it."),
      s("Set up publishing", "Either register your own publishing company (see the Publishing Company blueprint) or use an administrator, so the publisher's share is collected too."),
      s("Register each song with your PRO", "In My Catalog, a song marked Ready to register has every writer, role and split it needs. Register it with your PRO using those details."),
      s("Register with The MLC", "The MLC collects US streaming mechanical royalties. Register as a self-administered publisher or through your administrator."),
      s("Register the recording with SoundExchange", "SoundExchange pays the recording owner and artists when recordings play on digital radio. Register each recording with its ISRC."),
      s("Check statements every quarter", "Compare what you're paid with what you released. Use the Royalty Health Hub to spot songs that aren't fully registered."),
    ],
    checklist: ["PRO writer account", "IPI saved in My Catalog", "Publishing set up", "Songs registered with PRO", "The MLC", "SoundExchange", "Quarterly check"],
    pamphlet: [
      { heading: "Join a PRO as a writer",
        body: "The PRO is where your performance money starts, and the account is yours personally, not the artist page's. Pick the society for your territory (ASCAP, BMI or SESAC in the U.S., PRS in the U.K., GEMA in Germany, SOCAN in Canada, APRA AMCOS in Australia) and apply online as a writer under your legal name.",
        points: [
          "Fill in the legal name on your ID, your address, and the tax details the society asks for. A stage name is not a legal name.",
          "You get a writer account and an IPI name number. Every later registration uses that number, so save it.",
          "Register each song once it is finished and the splits are settled, then keep the title and writers identical everywhere.",
          "Add your IPI to your writer details in My Catalog, so a registration sheet carries it without retyping.",
        ] },
      { heading: "Register with The MLC",
        body: "The MLC pays the U.S. streaming mechanical for the composition. Register as a self-administered publisher if you have no publisher, or as a publisher administrator if you handle other writers too. It is a separate account from the PRO and does not replace it.",
        points: [
          "Create the account at themlc.com and take the self-administered publisher path, or add yourself as a publisher inside an existing administrator account.",
          "Add the songs you wrote, with every writer's legal name, IPI and share, exactly as the PRO has them.",
          "Give each recording its ISRC, because the MLC matches streams to the composition through it.",
          "Read the catalogue after upload: a writer listed as their own publisher with a placeholder IPI is the error to fix in the portal.",
        ] },
      { heading: "Register with SoundExchange",
        body: "SoundExchange pays the recording, so this account belongs to whoever owns the master and to the performers on it. If you wrote the song but did not perform on the record and do not own the master, skip this one.",
        points: [
          "Create an account as an artist, a rights owner, or both if you did both jobs.",
          "Register each recording with its ISRC and the release's UPC, then claim the tracks already linked to your name.",
          "Add the featured artists and session players where they are known, because their shares come out of the same recording.",
          "Check the unclaimed list every few months: a track that is registered but unclaimed pays nobody.",
        ] },
      { heading: "The order that saves you rework",
        body: "Each account needs something the one before it gives you, so the order matters more than the date: the PRO issues the IPI, The MLC consumes it, and SoundExchange works from the ISRC and UPC that arrive with the release.",
        points: [
          "1. PRO first, because the IPI it issues is used by The MLC and on your registration sheets.",
          "2. The MLC next, because it wants that IPI and the same writer splits.",
          "3. SoundExchange last, because it works from ISRCs and the UPC your distributor issues at delivery.",
          "4. Then come back to My Catalog and fill in anything the three accounts returned, so the next registration is one click.",
        ] },
    ],
  },
  {
    id: "copyright-protection", kind: "Blueprint", title: "Copyright and Intellectual Property Protection",
    summary: "Prove you own your music and art, know exactly what a composition and a master are, and know what to do if someone uses it without permission. The pamphlet below goes into the detail behind every step.",
    steps: [
      s("Know what's protected", "Two copyrights live in every release, and they are owned and licensed separately. The composition is the song itself: the lyrics and the melody, owned by whoever wrote them (usually split between writers or their publisher). The sound recording is that specific performance and mix, owned by whoever paid for and made the master (often the artist or label). Registering one does not register the other, a sync license covers only the composition while a master use license covers only the recording, and your artist name and logo sit outside copyright as trademarks. The pamphlet explains both works line by line."),
      s("Keep proof as you create", "Save dated drafts, voice memos, session files and split sheets. Use the AI Protection Hub to create time-stamped proof of your files."),
      s("Register important works", "In the US, registering with the Copyright Office is needed before you can sue, and gives you stronger remedies. Register finished songs and recordings that matter."),
      s("Put ownership in writing", "Paying someone doesn't automatically give you the copyright. Use contracts that say who owns what (see Copyright Assignment and the production contracts)."),
      s("Clear what you use", "Samples, beats, photos, fonts and footage need permission. Use the Sample Clearance and license contracts."),
      s("If someone copies you", "Save evidence, then send a takedown notice to the platform. If it's serious, talk to a music attorney before contacting them."),
    ],
    checklist: ["Song and recording understood", "Proof of creation saved", "Key works registered", "Ownership in writing", "Everything used is cleared", "Takedown process known"],
    stepOf: [0, 1, 2, 3, 4, 5],
    pamphlet: [
      { heading: "What a composition is, exactly",
        body: "The composition is the song itself, before anyone performs it: the lyrics as written plus the music (melody, chords, harmony, bass line, hook and structure). It exists from the moment you fix it down in some form, and it belongs to the people who wrote it, not to whoever recorded it.",
        points: [
          "📱 The \"Phone Memo\" rule: you don't need a fancy studio or a lawyer to protect your song. The exact second you record a hummed melody or a lyric into your phone, it is legally copyrighted to you.",
          "🤝 You own the whole pie together: if you write the lyrics and your friend writes the guitar chords, you don't just own the words and they don't just own the guitar. Legally, you both own a percentage of the entire combined song.",
          "🎤 Topliners are songwriters: if a producer gives you an instrumental track and you write the words and vocal melody to go on top of it, you didn't just \"help\". You co-wrote the composition and are legally entitled to your name on the song's paperwork (called a split sheet).",
          "🎹 Beats vs. songs: in modern music, the track/beat maker and the melody/lyric writer usually split the songwriting ownership 50/50, regardless of who spent more time on it.",
        ] },
      { heading: "What the master is, exactly",
        body: "The master, short for master recording, is one specific recording of that composition: the performance you can hear, the instruments, the room, the mix, the final master and the file itself, meaning the MP3 or WAV you press play on and listen to. Record the same song again with a different arrangement, or have another artist cover it, and you have a different master with its own copyright. The master is normally owned by whoever paid for and organised the session, which is why a producer who charges a flat fee and hands you the files is not automatically a co-owner, and why a label that fronts the studio time usually ends up owning the recording unless the contract says otherwise. The master copyright covers that recording only: someone can own the song and not your recording, or own your recording and none of the song." },
      { heading: "Mechanicals through The MLC, performances through your PRO",
        body: "Two different kinds of money come out of the same stream, and two different organisations collect them: The MLC collects your \"streaming print\" money, and your PRO collects your \"airplay\" money. You cannot pick one. To collect 100% of your songwriting money from streams, register the song with both.",
        points: [
          "📀 Mechanicals through The MLC: every time your song is streamed (Spotify, Apple Music) or bought as a download, a mechanical royalty is generated, a digital reproduction fee for the right to \"print\" and play your song on a listener's device.",
          "🏛️ The MLC (Mechanical Licensing Collective) is the organisation the U.S. government designated to collect that streaming money from the platforms and pay it directly to songwriters and publishers.",
          "📻 Performance through your PRO: every time your song is played publicly, a performance royalty is generated, because your song is being broadcast out into the world.",
          "🎯 Your PRO (Performance Rights Organisation: ASCAP, BMI or SESAC in the U.S.) monitors those public spaces, collects the licence fees and splits the money between the songwriter and the publisher.",
          "📍 Where performance money comes from: radio stations, TV shows and commercials, cafés, restaurants and bars, live concert venues, and internet radio like Pandora.",
          "🧠 The simple rules: streams and downloads = The MLC. Public broadcasts and airplay = your PRO.",
        ] },
      { heading: "SoundExchange pays the recording, not the song",
        body: "SoundExchange has absolutely nothing to do with songwriter royalties. It pays you for the recording, not the lyrics or the melody. If you only wrote the song and did not sing or play an instrument on the final track, SoundExchange owes you nothing: you sign up only if you performed on it or you own the audio file. It collects money from non-interactive digital radio only, meaning platforms where the listener picks a genre or a station but cannot hit play on a specific track or build a custom playlist. That is why on-demand Spotify and Apple Music plays are not SoundExchange money, and why a songwriter who never performed on the record cannot collect from it.",
        points: [
          "📡 Satellite and internet radio: 🛰️ SiriusXM satellite radio, 📻 the free radio version of Pandora, 🌐 iHeartRadio's digital stations and cable TV music channels are the money, not on-demand streaming.",
          "👑 50% to the master owner: the person or label who paid to record the song.",
          "🎤 45% to the featured artist: the main singer or band whose name is on the track.",
          "🥁 5% to the session players: a fund for the background musicians and studio drummers who played on the session.",
          "⚖️ The cheat sheet: songwriter royalties (PRO and The MLC) pay you for the intellectual property, your brain wrote the words and music. SoundExchange royalties pay you for the physical recording, your voice sang it, your hands played it, or your bank account paid for the studio time.",
          "🤔 The check before you sign up: did you sing or perform on the track you are getting ready to release, or did you only write the lyrics and melody for another artist? That answer decides whether SoundExchange applies to you.",
        ] },
      { heading: "The four places SoundExchange collects, and the two it never does",
        body: "SoundExchange only collects from non-interactive digital radio: services that play a station or a channel at you instead of letting you choose the exact next track. There are four categories, and knowing them tells you where your recording is earning and, just as usefully, where it is not. The exclusions matter as much as the list, because that money already reaches you through your distributor.",
        points: [
          "🛰️ Satellite radio: every music channel on SiriusXM.",
          "🌐 Internet radio and webcasters: the thousands of customised or algorithmic radio tiers where you can't pick the exact next song, including Pandora's free radio tiers, iHeartRadio streams, Live365, and even the \"Station\" or \"Radio\" modes on platforms like Amazon Music.",
          "📺 Cable TV music channels: the background music channels high up the TV guide, like Music Choice or Stingray, pay SoundExchange when they play your recording.",
          "📡 Online broadcast simulcasts: when a traditional AM/FM station takes its live over-the-air broadcast and streams it over the internet or an app, that digital web stream has to pay SoundExchange.",
          "🚫 Major platforms it excludes: SoundExchange never collects your master royalties from interactive, on-demand streaming where a user clicks a specific song to play it immediately. Spotify, Apple Music, Tidal, Amazon Music on demand and YouTube Music pay your digital distributor (DistroKid, TuneCore, CD Baby) directly, and the distributor passes 100% of that master royalty to you.",
          "❌ Terrestrial AM/FM radio is excluded too: traditional over-the-air car radio in the United States legally pays no master recording royalty at all, so SoundExchange cannot collect from it.",
        ] },
      { heading: "How they all work together",
        body: "Every track has two separate sides of ownership, and each side uses completely different companies to collect your money. The composition side pays the people who wrote the lyrics, melody and chords. The master side pays the people who performed on or paid for the actual audio file, and SoundExchange lives entirely on that side.",
        points: [
          "🎼 Composition side (the songwriters): your PRO collects your performance royalties wherever the song is broadcast to the public (radio, TV, venues, restaurants and streaming platforms), and The MLC collects your mechanical royalties wherever the song is reproduced digitally (every interactive stream on Spotify and Apple Music, and every download).",
          "🎙️ Master side (the recording): SoundExchange collects digital performance royalties for the recording on non-interactive platforms where a listener cannot pick the exact next song (SiriusXM, Pandora Radio, cable TV music channels and AM/FM web streams), and your distributor collects your standard streaming royalties on interactive platforms where a user clicks play on a specific track (Spotify, Apple Music, Tidal).",
          "⚖️ The takeaway: if you are an independent singer-songwriter who wrote, recorded and released a track yourself, you must register with your PRO, The MLC and SoundExchange to collect 100% of your money. Each one pays a different share, and skipping one leaves that share behind.",
        ] },
      { heading: "What copyright does not cover",
        body: "Copyright protects the expression, not the idea, and not a genre. A title, a chord progression, a drum pattern, a groove, a subject or a two-word hook are not protected on their own: another writer can make a song about the same thing over the same four chords. Your artist name, your logo and the name of your label are trademarks, protected by using them in business and by registering them, not by copyright. Your voice, your face and your likeness are covered by right-of-publicity rules that differ by state, not by copyright. A beat you bought a lease for is licensed to you, not owned by you, so read the lease before you claim the composition, and check whether it allows the release you are planning." },
      { heading: "The \"poor man's copyright\" myth",
        body: "Mailing yourself a copy, or uploading a private video, proves a date at best and is not a registration. In the US, registering with the Copyright Office is what lets you sue for infringement and what opens up statutory damages and attorney's fees for a timely claim, and it is done online, separately for the song and for the recording, or together for a release. A timestamp from the AI Protection Hub is evidence that a file existed in that exact form on that date, which is genuinely useful in a dispute, but it is not a government registration and it does not replace one. Keep the session files, the stems, the dated drafts and the split sheets too: they show how the song came together, which a hash on its own cannot." },
      { heading: "If someone uses your work",
        body: "Screenshot or download the post with its address and the date, note the account, and save your own proof of ownership before you contact anyone. Platforms run a notice-and-takedown process and most keep the form in their help centre: that is usually the fastest way to get a post removed, and a knowingly false claim can come back on you, so be accurate about which work and which right. A cover version released by someone else is normally allowed with a mechanical licence for the composition, but that licence never gives them your master. A sample, a remix or a beat built on your recording needs your permission, and if they use your song as well, the writer's. For anything earning real money, or anything involving a label, talk to a music attorney before you negotiate: a badly worded demand can cost more than the use did." },
    ],
  },
  {
    id: "release-distribution", kind: "Blueprint", title: "Independent Music Release and Distribution",
    summary: "Release a song the right way, from final master to release day.",
    steps: [
      s("Finish the master and artwork", "A mastered WAV and a 3000×3000 cover with no blurry text, website addresses or logos you don't own."),
      s("Embed and catalog it", "Use Embed Metadata in My Catalog to tag the master with credits, and save the song with writers and splits."),
      s("Sign the paperwork", "Split sheets for every writer, and contracts with the producer, features and anyone else who worked on it."),
      s("Deliver 4–6 weeks early", "Upload to your distributor at least 4 weeks before release, so you can pitch to editorial playlists and set up pre-saves."),
      s("Pitch and prepare", "Pitch the song to streaming editors through your artist profiles, line up content (short videos, behind the scenes), and plan posts for release week."),
      s("Register it", "Register the song with your PRO and The MLC and the recording with SoundExchange as soon as you have the ISRC (see the Royalty Registration blueprint)."),
      s("Release week and after", "Post daily, share to stories, thank playlist adds, and check your numbers after 7 and 28 days to plan the next one."),
    ],
    checklist: ["Master and artwork", "Metadata embedded", "Split sheets and contracts signed", "Delivered 4+ weeks early", "Editorial pitch", "Registered", "Release-week content"],
    pamphlet: [
      { heading: "Why the runway is four weeks",
        body: "A release is a set of deadlines stacked on each other: the distributor checks the audio, the artwork and the metadata before it passes anything on, the platform checks it again, and the editorial pitch has its own cut-off that falls before release day. Deliver late and the song still comes out, but it comes out unpitched, without a pre-save link, and often on the wrong artist profile because nobody had time to check the spelling. The four weeks are not for the platform's benefit; they are the window in which you can still fix something without moving the date.",
        points: [
          "Deliver first, then promote: a pre-save link only exists once the release is in the system, so the order is delivery, then links, then posts.",
          "Leave room for one rejection. Artwork that carries a logo you do not own, a price, a website address or a streaming-service icon is routinely refused, and a fix restarts the clock.",
          "Pitch in the same window, with the story rather than the genre: what the song is about, where it was recorded and who played on it.",
          "Do not move the date to fix a detail. Move the detail to fit the date, or push the whole release once, on purpose, early.",
        ] },
      { heading: "The metadata is the release",
        body: "Two identifiers travel with a release and everything downstream depends on them. The ISRC identifies this one recording, and the UPC identifies the release as a product. Your distributor issues them, they never change, and they are what The MLC, SoundExchange, your PRO and every royalty statement use to find the money again. The rest of the metadata, the writer legal names, the splits, the explicit flag, the artist name exactly as it appears on the profile, is what decides whether the money reaches the right people on the first pass.",
        points: [
          "ISRC per recording, UPC per release: re-record the song and it needs a new ISRC, because it is a new recording of the same composition.",
          "Spell the artist name and the title exactly as you want them forever. A typo becomes a separate artist page with its own, empty, history.",
          "Put the writer legal names and splits in before delivery, not after: the distributor passes them to the collection societies, and a late correction is a support ticket, not an edit.",
          "Keep the WAV you delivered and its ISRC together in your catalog, so the version you sent is the version you can play back later.",
        ] },
      { heading: "The paperwork comes before the upload",
        body: "A distributor delivers a file; it does not decide who owns it. That is settled by the split sheet every writer signed, the producer agreement and the feature agreement, and by whatever the contract says about the master. Doing this before delivery is not admin for its own sake: the splits you type into the release are supposed to match the sheet, and if they do not, the person who is short will find out a year later from a statement, not from you.",
        points: [
          "One signed split sheet per song, with every writer's legal name, role and percentage, adding to exactly 100.",
          "Check the producer agreement for who owns the master and whether the beat was leased or bought outright, because a lease has limits on releases and platforms.",
          "Clear samples before the release, not after it charts. A takedown costs the release, the playlist adds and the pitch history.",
          "Treat anyone who worked on the record, a session player, a featured artist, an engineer, as a conversation about credit and money now rather than a favour later.",
        ] },
      { heading: "Release week, and the two numbers after it",
        body: "Release week is a small set of repeatable actions rather than a big launch: post the song, not the cover, tell the story behind it, answer every comment, and thank the people who added it to something. The useful review comes later, at about seven days and again at about twenty-eight, when the first-week spike has settled and you can see whether the song kept listeners or only borrowed them.",
        points: [
          "Look at saves and repeat listens, not only streams: a stream is a click, a save is a decision to come back.",
          "Compare the two dates, not the two songs. Week one is discovery, week four is whether anything held.",
          "Check that the release landed on the right artist profile, with the right artwork and the clean or explicit flag you chose.",
          "Write down what you would do again and what you would cut. The next release starts from that note, not from a blank page.",
        ] },
    ],
  },
  {
    id: "artist-branding", kind: "Blueprint", title: "Artist Branding and Professional Identity",
    summary: "Look and sound like the same artist everywhere.",
    steps: [
      s("Write your one-line story", "Who you are, what your music sounds like and who it's for, in one sentence. Use it in every bio."),
      s("Lock your name and handles", "Use the same artist name and handle on every platform, and claim your artist profiles on streaming services."),
      s("Choose a look", "Pick two or three colors, one or two fonts and a photo style. Use them on covers, posts and merch."),
      s("Get professional photos", "A set of press photos for the year: one portrait, one wide, one live or in-studio (see the Photography contract)."),
      s("Build an electronic press kit", "Bio (short and long), photos, best songs, videos, stats and contact, on one page."),
      s("Stay consistent", "Review your profiles every few months so the bio, photo and links match."),
    ],
    checklist: ["One-line story", "Same name and handles", "Colors and fonts", "Press photos", "Press kit", "Quarterly profile check"],
  },
  {
    id: "marketing-fanbase", kind: "Blueprint", title: "Music Marketing and Fanbase Growth",
    summary: "Grow real fans with a simple plan you can keep up.",
    steps: [
      s("Know your listener", "Who are the 1,000 people most likely to love your music? What do they watch and follow? Aim everything at them."),
      s("Post consistently", "Pick two platforms and post short videos several times a week: the song, the story behind it, the process."),
      s("Collect contacts", "Build an email or text list with a free download, early access or merch discount. You own that list; you don't own followers."),
      s("Work with creators", "Pay or partner with creators to use your song (see the Influencer and UGC contracts). Always label paid posts as ads."),
      s("Never buy fake streams", "Bots and fake streams can get your music removed. If a promoter guarantees streams, walk away."),
      s("Measure and adjust", "Every month, look at what actually brought new listeners and do more of it."),
    ],
    checklist: ["Listener defined", "Two platforms, regular posts", "Email or text list", "Creator partnerships", "No fake streams", "Monthly review"],
  },
  {
    id: "recording-workflow", kind: "Blueprint", title: "Professional Recording, Mixing and Mastering Workflow",
    summary: "Go from demo to release-ready master without losing files or time.",
    steps: [
      s("Prep the song", "Lock the arrangement, tempo and key before the session. Bring lyrics and references."),
      s("Record clean", "24-bit WAV, no clipping, consistent mic distance. See your genre's cheat sheet for setup."),
      s("Name and back up", "Name every track and take clearly, and back up after every session in two places."),
      s("Comp and edit", "Pick the best takes, tune and time-align gently, and export dry, consolidated stems from bar 1."),
      s("Mix with references", "Send the mixer stems, a rough mix and two reference songs. Agree on revisions up front (see the Mixing & Mastering contract)."),
      s("Master and check", "Check the master on phones, earbuds, a car and big speakers. Get a WAV master, an MP3 and an instrumental."),
      s("Embed and file", "Tag the master with Embed Metadata and save every final file with the song in My Catalog."),
    ],
    checklist: ["Arrangement locked", "Clean takes", "Two backups", "Stems exported", "Mix revisions agreed", "Master checked everywhere", "Embedded and filed"],
  },
  {
    id: "booking-touring", kind: "Blueprint", title: "Live Performance Booking and Touring",
    summary: "Book paid shows and plan a run of dates that makes money.",
    steps: [
      s("Build a live set", "A tight 20–30 minute set, rehearsed, with a live video you can send to bookers."),
      s("Start local", "Open for touring acts, play showcases and build a draw. Bookers ask how many tickets you can sell."),
      s("Pitch with a one-pager", "Your press kit, live video, local draw and the date you want, sent 6–8 weeks ahead."),
      s("Get it in writing", "Use the Live Performance Booking Agreement plus your Technical and Hospitality Riders, with a deposit to confirm."),
      s("Budget the run", "Add up travel, lodging, food and band pay against guarantees and merch. Only route dates that cover their costs."),
      s("Settle every night", "Get paid before you leave, keep receipts and record merch sales each show."),
    ],
    checklist: ["Live set and video", "Local draw", "Pitch one-pager", "Booking contract and riders", "Tour budget", "Nightly settlement"],
  },
  {
    id: "sync-licensing", kind: "Blueprint", title: "Sync Licensing and Music Placement",
    summary: "Get your music placed in film, TV, ads and games.",
    steps: [
      s("Control your rights", "Sync needs permission for both the song and the recording. Music you fully own (or can clear quickly) gets placed faster."),
      s("Prepare a sync-ready catalog", "Instrumentals, clean versions and stems for every song, with metadata embedded and splits agreed."),
      s("Tag your music", "Mood, tempo, genre and themes, so supervisors and libraries can find the right song quickly."),
      s("Pitch the right way", "Work with music libraries, sync agents or supervisors. Send a short, targeted list, not your whole catalog."),
      s("License with contracts", "Use the Sync License (song) and Master Use License (recording) together."),
      s("Collect the backend", "Make sure a cue sheet is filed so your PRO pays performance royalties when it airs."),
    ],
    checklist: ["Rights cleared", "Instrumentals and stems", "Tags", "Pitch list", "Sync + master licenses", "Cue sheet filed"],
  },
  {
    id: "finance-funding", kind: "Blueprint", title: "Music Business Financial Management and Funding",
    summary: "Keep your music money organized and find funding for your projects.",
    steps: [
      s("Separate your money", "A business bank account for all music income and expenses."),
      s("Budget every project", "Recording, mixing, artwork, video and marketing, with 10% extra for surprises."),
      s("Track monthly", "Record income and expenses and save receipts every month. Bookkeeping apps make this quick."),
      s("Plan for taxes", "If you're self-employed, set aside a share of income for taxes and ask an accountant about quarterly payments and deductions."),
      s("Look for funding", "Grants and arts councils, sync fees, brand deals, fan funding and pre-sales. Read every advance carefully: it's usually paid back from your royalties."),
      s("Review quarterly", "Check what made money and what didn't, and plan the next quarter's spending."),
    ],
    checklist: ["Business bank account", "Project budgets", "Monthly tracking", "Tax savings", "Funding options", "Quarterly review"],
  },
  {
    id: "systems-automation", kind: "Blueprint", title: "Music Business Systems and Automation",
    summary: "Spend less time on admin with simple, repeatable systems.",
    steps: [
      s("One home for your catalog", "Every song, writer, split and code in My Catalog, so exports and registrations take seconds."),
      s("Folder naming", "One folder per song with the same structure every time: Sessions, Stems, Masters, Artwork, Contracts."),
      s("Templates for repeat work", "Save contract details you reuse (your governing law is remembered) and keep email templates for pitches and bookings."),
      s("Calendar the routine", "Schedule monthly money checks, quarterly royalty checks and release-day tasks."),
      s("Automate posting and backups", "Schedule social posts ahead and set automatic cloud backups for your sessions."),
      s("Review once a year", "Remove tools you don't use and tighten the steps that slow you down."),
    ],
    checklist: ["Catalog complete", "Folder system", "Templates", "Recurring calendar tasks", "Scheduled posts and backups", "Yearly review"],
  },
  {
    id: "career-wealth", kind: "Blueprint", title: "Independent Music Career and Long-Term Wealth",
    summary: "Build income that keeps paying you for years.",
    steps: [
      s("Own your masters and songs", "Ownership is what pays long term. Read every deal for what you give up and for how long."),
      s("Register everything", "Unregistered songs are lost royalties. Keep every release Ready to register in My Catalog."),
      s("Build several income streams", "Streaming, publishing, sync, live, merch, teaching, brand deals and production for others."),
      s("Grow your catalog steadily", "Releasing regularly adds up: each song is another asset that earns."),
      s("Save and invest", "Pay yourself, keep an emergency fund and invest part of what you earn. Talk to a financial advisor."),
      s("Plan for the future", "Write down who inherits your catalog and keep your records organized so it can be managed without you."),
    ],
    checklist: ["Ownership kept", "Everything registered", "Several income streams", "Regular releases", "Savings and investing", "Estate plan"],
  },
  {
    id: "video-production", kind: "Blueprint", title: "Music Video and Visual Production",
    summary: "Plan and shoot a music video on any budget.",
    steps: [
      s("Write a simple treatment", "One page: the idea, the look, the locations and the people. Choose what you can do well, not everything."),
      s("Set the budget", "Crew, locations, wardrobe, hair and makeup, food and editing, plus 10% for surprises."),
      s("Hire with contracts", "Director, crew, editor, location and everyone on camera (see the Visual Production contracts and the Model Release)."),
      s("Plan the shoot day", "A shot list and a schedule with call times. Shoot vertical clips for social media while you're there."),
      s("Edit and approve", "Two rounds of changes, then the final cut, vertical edits and a thumbnail."),
      s("Release and repurpose", "Premiere it, then cut it into short clips for weeks of content."),
    ],
    checklist: ["Treatment", "Budget", "Contracts and releases", "Shot list and schedule", "Final and vertical cuts", "Clip plan"],
  },
  {
    id: "fashion-image", kind: "Blueprint", title: "Artist Fashion, Beauty and Image",
    summary: "Build a signature look for photos, videos and the stage.",
    steps: [
      s("Make a mood board", "Collect 15–20 images of looks that fit your music and brand colors."),
      s("Pick a few signature pieces", "One or two things fans will recognize: a jacket, jewelry, a hairstyle."),
      s("Hire your glam team", "Stylist, hair and makeup with clear contracts for fees, call times and credit."),
      s("Plan looks per project", "Coordinate wardrobe with the cover, the video and the shows for each release."),
      s("Care for borrowed pieces", "Returns, rentals and damage are spelled out in the stylist contract; keep receipts."),
      s("Turn it into merch", "Signature looks can become merch drops (see the Fashion Designer and Merchandise contracts)."),
    ],
    checklist: ["Mood board", "Signature pieces", "Glam team contracts", "Looks per release", "Rental returns", "Merch ideas"],
  },
  {
    id: "brand-partnerships", kind: "Blueprint", title: "Influencer Marketing and Brand Partnerships",
    summary: "Work with creators and brands the right way.",
    steps: [
      s("Find the right fits", "Creators and brands whose audience would actually love your music."),
      s("Make a simple offer", "What you want, what they get, when, and how it's labeled."),
      s("Use a contract", "Influencer, UGC, Sponsorship and Ambassador contracts are in this section, with ad disclosure built in."),
      s("Always disclose", "Paid or gifted posts must be clearly labeled as ads (#ad or the platform's paid-partnership label)."),
      s("Track results", "Ask for screenshots of views and clicks, and compare with your own streaming numbers."),
      s("Keep good partners", "Thank them, share their post and come back for the next release."),
    ],
    checklist: ["Good-fit list", "Clear offer", "Contract", "Ad disclosure", "Results tracked", "Repeat partners"],
  },
  {
    id: "podcast", kind: "Blueprint", title: "Podcast Creation and Monetization",
    summary: "Launch a podcast and make it pay.",
    steps: [
      s("Define the show", "Topic, audience, format and length. A clear idea beats a general one."),
      s("Set up co-hosts and guests", "Sign a Co-Host Agreement before launch and a Guest Release with every guest."),
      s("Record well", "See the Podcast cheat sheet. Each speaker on their own track when you can."),
      s("Publish consistently", "Pick a schedule you can keep, and post clips of every episode."),
      s("Monetize", "Sponsors (see the Podcast Sponsorship contract), memberships, live shows and merch."),
      s("Clear the music", "Use music you own or have licensed for your intro and beds."),
    ],
    checklist: ["Show defined", "Co-host and guest contracts", "Good recording setup", "Schedule", "Sponsors", "Music cleared"],
  },
  {
    id: "live-production", kind: "Blueprint", title: "Live Show and Touring Production",
    summary: "Put on a professional live show, from rehearsals to load-out.",
    steps: [
      s("Design the show", "Set list, transitions, moments and visuals. Rehearse it start to finish."),
      s("Hire the team", "Musical director, band, dancers, sound and lights, each with a contract."),
      s("Send your riders", "Technical and Hospitality Riders go to every venue with the booking contract."),
      s("Advance every show", "A week before, confirm times, stage, sound, parking and settlement with the venue."),
      s("Run the day", "Load-in, soundcheck, doors, set, settlement and load-out, on a written schedule."),
      s("Review after", "What worked, what to cut, and what it cost, before the next show."),
    ],
    checklist: ["Show designed and rehearsed", "Team contracts", "Riders sent", "Show advanced", "Day schedule", "Post-show review"],
  },
  {
    id: "events-experiences", kind: "Blueprint", title: "Independent Music Events and Experiences",
    summary: "Host release parties, listening sessions and fan experiences.",
    steps: [
      s("Pick the goal", "Celebrate a release, meet fans, raise money or get press. The goal shapes the event."),
      s("Budget and venue", "Rent the right size room (see the Venue Rental contract) and set a budget with 10% extra."),
      s("Book vendors and talent", "DJ, photographer, food, staff and guests, each with a contract."),
      s("Sell or RSVP", "Ticketing or a guest list, with VIP or meet-and-greet options if they fit."),
      s("Promote", "Announce 3–4 weeks ahead, remind the week of, and post live on the night."),
      s("Follow up", "Share photos, thank everyone and add attendees to your email list."),
    ],
    checklist: ["Goal", "Venue and budget", "Vendor contracts", "Tickets or RSVP", "Promotion plan", "Follow-up"],
  },
  {
    id: "studio-etiquette", kind: "Blueprint", title: "Studio Etiquette and Recording Best Practices",
    summary: "Run smooth sessions that people want to work with you on again.",
    steps: [
      s("Arrive ready", "Lyrics finished, parts rehearsed, references and the beat or session files ready."),
      s("Be on time", "Studio time is money. Late starts usually still cost the full booking."),
      s("Respect the room", "Limit guests, keep food and drinks away from gear, and follow the engineer's lead."),
      s("Settle splits before you leave", "Fill in a split sheet for every song written that day while everyone is in the room."),
      s("Get your files", "Leave with the raw files and session backup (see the Studio & Engineer contract)."),
      s("Pay and credit people", "Pay on time and credit everyone correctly in your metadata."),
    ],
    checklist: ["Prepared", "On time", "Room respected", "Split sheet signed", "Files received", "Paid and credited"],
  },
  {
    id: "songwriter-placements", kind: "Blueprint", title: "Songwriter Credits and Placements",
    summary: "Land outside cuts and get paid for them: the work catalogued, registered and credited the same way everywhere.",
    steps: [
      s("Catalogue the work without a recording", "A song you wrote for someone else needs no master or ISRC. Add the title, your writers with roles, the splits and publishing, then leave the recording fields blank."),
      s("Settle the splits and sign the sheet", "Agree every writer's share before the artist records. Generate the split sheet from My Catalog, sign it, and send it for the other signatures."),
      s("Register with the PRO and save the ISWC", "Register the work with your PRO under your legal name. The PRO assigns the ISWC; save it on the song so every later lookup can match by code instead of by title."),
      s("Register with The MLC", "The MLC pays the mechanical royalties for streams. Register the work there and keep the confirmation with the song."),
      s("When the artist releases, collect the release credits", "Ask for the credit line the distributor shows, or read it on the release. Type it on the song: the release is the third copy of the same facts."),
      s("Run the credit check and fix what differs", "Open the credit check in the Royalty Health Hub. It compares your catalog, the registration and the release, and opens on the differences. Fix the copy you control first."),
      s("Keep the proof with the song", "Keep the split sheet, the registration confirmations and the release credit line with the song, so a query years later starts from the paperwork rather than a memory."),
    ],
    checklist: ["Work catalogued without a master", "Splits settled and sheet signed", "PRO registration and ISWC saved", "MLC registration", "Release credits added", "Credit check run", "Differences fixed", "Proof kept"],
    stepOf: [0, 1, 2, 3, 4, 5, 5, 6],
  },
  {
    id: "beat-renegotiation", kind: "Blueprint", title: "Beat License Checkups and Renegotiation",
    summary: "Know what your beat licence allows, watch the streams against its cap, and amend it when the point is reached.",
    steps: [
      s("Know what the license allows", "Read the lease or exclusive you signed: the term, the territory, the stream cap, the fee and what happens when the cap is reached. If you don't have it, generate and sign one before the next sale."),
      s("Record the deal on the beat", "Mark the beat sold, link the song made from it, and record the deal type, date, the stream count where it changes and the contract itself. Those four answers are what every later check reads."),
      s("Read the master's numbers on a date", "Take the streams from the distributor's report and enter them with the date. The app never polls a distributor and never estimates a count."),
      s("Compare against the cap", "The check says where the recording stands in one line, in your own numbers. Below the cap there is nothing to do yet; at or past it, the license point has been reached."),
      s("Decide the ask", "Decide what you want: a new cap, a new fee, a new share, or a buyout. The amendment starts from the deal on file and leaves the new terms for you both to agree."),
      s("Sign the amendment", "Generate the Beat License Renegotiation & Amendment from Contracts, attached to the master, prefilled with the original terms. Send it for signature."),
      s("File it and set the next check", "When it's signed, it sits on the master's card with the old terms still readable. Set the next check date on the Working On item; the reminder waits for the new cap."),
    ],
    checklist: ["License terms read", "Deal recorded", "First reading entered", "Position checked", "Ask decided", "Amendment signed", "New terms filed", "Next check dated"],
    stepOf: [0, 1, 2, 3, 4, 5, 6, 6],
  },
];

const SETUP: GuideStep[] = [
  s("Format", "Record WAV at 24-bit, usually 44.1 or 48 kHz, and keep the whole project at one setting."),
  s("Levels", "Set gain so the loudest parts peak around −12 to −6 dBFS. Never clip: distortion can't be undone."),
  s("Mic", "Use a pop filter and start about 6–10 inches from the singer, then adjust for tone and the room."),
  s("Headphones", "Closed-back headphones while recording. A low buffer while tracking, a higher one while mixing."),
  s("Room", "Fix echo and noise first with placement, soft furnishings and mic direction, before reaching for plugins."),
  s("Files", "Record dry even if you monitor with effects. Name tracks and takes, save often and back up in two places."),
];
const CHECKLIST = ["Room and noise checked", "Sample rate and bit depth set", "Headphone mix comfortable", "No clipping on the loudest part", "Reference and guide tracks ready", "Takes named and saved", "Dry files exported and backed up"];
const TROUBLE: GuideStep[] = [
  s("Distortion", "Lower the preamp gain and redo the take; clipped audio can't be fixed reliably."),
  s("Echo or boxy sound", "Move away from walls and corners, and add absorption near reflection points."),
  s("Delay in headphones (latency)", "Use direct monitoring or a smaller buffer, and turn off heavy plugins while recording."),
  s("Pops and harsh S sounds", "Move slightly off-axis, use a pop filter and adjust distance before processing."),
];

const sheet = (id: string, title: string, tips: [string, string][]): Guide => ({
  id, kind: "Cheat sheet", title: `${title} Home Recording`,
  summary: `Quick setup, ${title.toLowerCase()} tips, a session checklist and fixes for common problems.`,
  steps: [...tips.map(([t, x]) => s(t, x)), ...SETUP, ...TROUBLE.map((x) => ({ ...x, title: `Fix: ${x.title}` }))],
  checklist: CHECKLIST,
});

export const CHEAT_SHEETS: Guide[] = [
  sheet("hip-hop", "Hip-Hop and Rap", [["Leave headroom", "Rap has loud consonants; keep peaks well under 0 dBFS and don't over-compress on the way in."], ["Separate the layers", "Record the lead, intentional doubles and ad-libs on separate tracks."], ["Punch in cleanly", "Punch in by line or phrase, matching mic distance and energy so the takes blend."]]),
  sheet("rnb-soul", "R&B and Soul", [["Keep distance steady", "Intimate leads need a consistent distance so the tone doesn't change line to line."], ["Stack by part", "Record each harmony part on its own tracks, doubled, so they're easy to balance."], ["Keep the breath", "Reduce loud breaths, but don't remove them all; they carry the emotion."]]),
  sheet("pop", "Pop", [["Comp from full takes", "Record several complete lead takes, then build the best one from the strongest lines."], ["Match the doubles", "Keep the same mic and placement for choruses and doubles so they sit together."], ["Tight timing", "Pop vocals are often edited tight; record clean starts and ends of phrases."]]),
  sheet("rock", "Rock and Alternative", [["Choose the right mic", "Dynamic mics handle loud singers and amps; condensers capture detail on quieter parts."], ["Check guitar phase", "When recording an amp mic and a DI together, check that they're in phase."], ["Watch the bleed", "Loud rooms leak into every mic; record parts separately at home when you can."]]),
  sheet("country-folk", "Country, Folk and Acoustic", [["Guitar mic", "Start near the 12th fret, a few inches away, not straight at the sound hole."], ["Voice and guitar together", "If you sing and play at once, check how much guitar leaks into the vocal mic."], ["Keep it natural", "Light compression and a little room sound suit acoustic music."]]),
  sheet("edm", "EDM and Electronic", [["Print your synths", "Record virtual instruments to audio as well as keeping the MIDI."], ["Mind latency", "Use a low buffer while playing parts in, then raise it to mix."], ["Check mono", "Wide stereo sounds great in headphones but can disappear on a club or phone speaker."]]),
  sheet("gospel-choir", "Gospel and Choir", [["Balance the groups", "Place singers so each section is balanced before you hit record."], ["Watch phase and bleed", "Multiple mics on a choir can cancel each other; check them together."], ["Leave extra headroom", "Big group moments peak suddenly; set levels on the loudest section."]]),
  sheet("jazz-blues", "Jazz and Blues", [["Capture the dynamics", "Don't over-compress; quiet and loud moments are part of the music."], ["Use the room", "A good room and few mics often sound better than many close mics."], ["Check bleed and phase", "When playing together, check how instruments leak into each other's mics."]]),
  sheet("reggae-afrobeats", "Reggae, Dancehall and Afrobeats", [["Lock to the groove", "Phrasing sits on the rhythm; record with a clear, loud-enough beat in the headphones."], ["Separate call and response", "Record the lead and the call-and-response parts on separate tracks."], ["Keep the low end clean", "Bass-heavy beats need clean vocals; cut rumble below the voice."]]),
  sheet("podcast", "Podcast and Spoken Word", [["Same distance every time", "Keep the mic a fist's width away and stay at the same distance for even volume."], ["Treat the room", "Record in a small, soft room; closets full of clothes work well."], ["Record each speaker separately", "For remote guests, have each person record their own local track when possible."]]),
];

export const GUIDES: Guide[] = [...BLUEPRINT_GUIDES, ...CHEAT_SHEETS];

/**
 * The checklist items the app can open, by guide id and then by the item's exact wording. Kept beside the guides so the
 * wording and its link can't drift apart, and checked by a test.
 */
export const GUIDE_LINKS: Record<string, Record<string, GuideLink>> = {
  "songwriter-placements": {
    "Work catalogued without a master": { label: "Open My Catalog", where: "catalog" },
    "Splits settled and sheet signed": { label: "Open Split Sheets", where: "splits" },
    "PRO registration and ISWC saved": { label: "Open your writer details", where: "profile" },
    "MLC registration": { label: "Open My Catalog for the MLC export", where: "catalog" },
    "Release credits added": { label: "Open My Catalog", where: "catalog" },
    "Credit check run": { label: "Open the Royalty Health Hub", where: "health" },
    "Differences fixed": { label: "Open the Royalty Health Hub", where: "health" },
    "Proof kept": { label: "Open My Catalog", where: "catalog" },
  },
  "beat-renegotiation": {
    "Deal recorded": { label: "Open My Catalog", where: "catalog" },
    "First reading entered": { label: "Open My Catalog", where: "catalog" },
    "Position checked": { label: "Open the Royalty Health Hub", where: "health" },
    "New terms filed": { label: "Open My Catalog", where: "catalog" },
    "Next check dated": { label: "Open the Royalty Health Hub", where: "health" },
  },
  "royalty-registration": {
    "PRO writer account": { label: "Open your writer details", where: "profile" },
    "IPI saved in My Catalog": { label: "Open your writer details", where: "profile" },
    "Publishing set up": { label: "Read the Publishing Company blueprint", where: "blueprint", guideId: "publishing-company" },
    "Songs registered with PRO": { label: "Open My Catalog", where: "catalog" },
    "The MLC": { label: "Open My Catalog for the MLC export", where: "catalog" },
    SoundExchange: { label: "Open My Catalog for the recordings", where: "catalog" },
    "Quarterly check": { label: "Open the Royalty Health Hub", where: "health" },
  },
};

/** The screen one checklist item opens, or nothing when that step happens outside the app. */
export const linkFor = (guideId: string, item: string): GuideLink | undefined => GUIDE_LINKS[guideId]?.[item];

/** The numbered step a checklist item points at, when that step exists. */
export function stepFor(g: Guide, index: number): number | undefined {
  const at = g.stepOf?.[index] ?? index;
  return at >= 0 && at < g.steps.length ? at : undefined;
}

/**
 * The numbered steps whose checklist items are all ticked, so the instructions above cross out as the list fills in
 * (founder, 2026-11-06). A step no item points at is never crossed out: the ticked checklist is the proof, not the reading.
 */
export function crossedSteps(g: Guide, checked: readonly string[]): Set<number> {
  const ticked = new Set(checked);
  const byStep = new Map<number, string[]>();
  (g.checklist ?? []).forEach((item, i) => {
    const at = stepFor(g, i);
    if (at !== undefined) byStep.set(at, [...(byStep.get(at) ?? []), item]);
  });
  const out = new Set<number>();
  for (const [step, items] of byStep) if (items.every((item) => ticked.has(item))) out.add(step);
  return out;
}
