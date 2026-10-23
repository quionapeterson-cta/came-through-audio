/**
 * Blueprints (step-by-step business guides) and home recording cheat sheets, shown in Contracts & Blueprints →
 * Blueprints for Catalog Management. Plain reading material: general information, not legal, tax or financial advice.
 */
export type GuideStep = { title: string; text: string };
export type Guide = { id: string; kind: "Blueprint" | "Cheat sheet"; title: string; summary: string; steps: GuideStep[]; checklist?: string[] };

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
    ],
    checklist: ["Name checked", "Business type chosen", "EIN or tax ID", "Business bank account", "PRO, MLC, SoundExchange", "Catalog up to date", "Contracts for every collaborator", "Monthly money check"],
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
    checklist: ["Publisher name approved", "PRO publisher account", "Publisher IPI saved", "Songs registered with shares", "The MLC", "Administrator decision"],
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
    checklist: ["Price list", "Contracts ready", "PRO writer account", "Backups in two places", "Catalog credits", "Client follow-up"],
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
      s("Check statements every quarter", "Compare what you're paid with what you released. Use Royalty Health Check to spot songs that aren't fully registered."),
    ],
    checklist: ["PRO writer account", "IPI saved in My Catalog", "Publishing set up", "Songs registered with PRO", "The MLC", "SoundExchange", "Quarterly check"],
  },
  {
    id: "copyright-protection", kind: "Blueprint", title: "Copyright and Intellectual Property Protection",
    summary: "Prove you own your music and art, and know what to do if someone uses it without permission.",
    steps: [
      s("Know what's protected", "A song (lyrics and music) and its recording are two separate copyrights. Your artist name and logo can be protected as trademarks."),
      s("Keep proof as you create", "Save dated drafts, voice memos, session files and split sheets. Use the AI Protection Hub to create time-stamped proof of your files."),
      s("Register important works", "In the US, registering with the Copyright Office is needed before you can sue, and gives you stronger remedies. Register finished songs and recordings that matter."),
      s("Put ownership in writing", "Paying someone doesn't automatically give you the copyright. Use contracts that say who owns what (see Copyright Assignment and the production contracts)."),
      s("Clear what you use", "Samples, beats, photos, fonts and footage need permission. Use the Sample Clearance and license contracts."),
      s("If someone copies you", "Save evidence, then send a takedown notice to the platform. If it's serious, talk to a music attorney before contacting them."),
    ],
    checklist: ["Proof of creation saved", "Key works registered", "Ownership in writing", "Everything used is cleared", "Takedown process known"],
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
