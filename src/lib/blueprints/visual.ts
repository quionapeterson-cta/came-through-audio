import { CLAUSE, DATE, FEE, PAY_WHEN, SONG, STATE, doc, field, general, need, type Blueprint } from "./common";

const SHOOT = need("shootDate", "Shoot date(s)", "When filming or the shoot happens.", { date: "many", placeholder: "April 5, 2027" });
const PROJECT = (value: string) => field("project", "Project", "What it's for.", { value });

export const RELEASE_TERMS = `PHOTO, VIDEO & TESTIMONIAL RELEASE

This release is made on {{effectiveDate}} between {{party:Company}} ("Company") and {{party:Participant}} ("Participant").

1. PERMISSION
Participant grants Company and its successors the irrevocable, perpetual, worldwide, royalty-free right to use, reproduce, publish, display and distribute the following, in whole or in part: {{materials}} (the "Materials").

2. TESTIMONIAL
Participant approves this written testimonial for use with the Materials: {{testimonial}}. Company will not change its meaning.

3. USES
Company may use the Materials in any media now known or later developed, including {{uses}}, to advertise and promote Company and its services.

4. EDITING
Company may crop, edit, shorten, caption and combine the Materials with other content, as long as the meaning of Participant's statements is not changed.

5. CREDIT
Where a name appears, Participant will be credited as {{credit}}. Company may also use the Materials without a name.

6. CONSIDERATION
In exchange for this release, Participant receives: {{consideration}}. Participant agrees this is the full compensation, and no royalties or further payments are owed.

7. OWNERSHIP AND APPROVAL
Company owns any photos and recordings it creates of Participant. Participant waives any right to inspect or approve final versions, except that the written testimonial will not be changed in meaning.

8. NO OBLIGATION
Company is allowed, but never required, to use the Materials.

9. RELEASE OF CLAIMS
Participant releases Company from claims for invasion of privacy, right of publicity or defamation arising from uses permitted here.

10. AGE
Participant confirms they are 18 or older. If not, a parent or legal guardian must also sign this release on their behalf.

`;

export const VISUAL: Blueprint[] = [
  {
    id: "videographer",
    name: "Music Video Director & Videographer Agreement",
    category: "Visual Production",
    summary: "A director or videographer shoots and edits your music video: dates, fee, deliverables and who owns the footage.",
    whenToUse: "Use it for any music video, visualizer or performance video you hire someone to make.",
    keyTerms: ["You own the footage and the final video once paid.", "Two rounds of edits included.", "Final cut is yours.", "They get releases from cast and locations."],
    roles: ["Artist", "Director"],
    fields: [
      DATE, SONG, SHOOT, FEE("Fee", "$2,000", "The total paid to the director."), PAY_WHEN("50% on signing and 50% when the final video is delivered"),
      field("deliverables", "Deliverables", "Everything they hand over.", { value: "a final 16:9 video in 4K, three vertical clips for social media, and the raw footage", multiline: true }),
      field("deliveryDays", "Delivered within", "When the final video is due.", { value: "30 days after the shoot" }),
      field("credit", "Credit line", "How they're credited. Leave blank for the usual credit.", { placeholder: "Directed by Jane Doe", fallback: "\"Directed by\" with Director's name" }),
      STATE,
    ],
    body: doc("Music Video Agreement", ["Artist", "Director"], [
      ["SERVICES", "Director will plan, shoot and edit a music video for \"{{songTitle}}\" on {{shootDate}}, and deliver {{deliverables}} within {{deliveryDays}}."],
      ["FEE", "Artist pays Director {{fee}}, {{paySchedule}}. The fee covers Director's crew and equipment unless agreed otherwise in writing."],
      ["EDITS", "Two rounds of changes are included. Artist has the final say on the finished video."],
      ["OWNERSHIP", "Once paid, Artist owns the video and all footage. Director may show the video in their portfolio and reel after release."],
      ["RELEASES", "Director gets signed releases from everyone who appears on camera and from every location, and gives Artist copies."],
      ["CREDIT", "Artist will credit Director as {{credit}} in the video description where practical."],
      CLAUSE.confidential, CLAUSE.noAI,
    ]),
  },
  {
    id: "photography",
    name: "Photography Services Agreement",
    category: "Visual Production",
    summary: "A photographer shoots your press photos or cover: fee, how many edited photos, and how you can use them.",
    whenToUse: "Use it for press photos, cover shoots, behind-the-scenes and promo shoots.",
    keyTerms: ["You may use the photos for all promotion and covers, forever.", "The photographer may use them in their portfolio.", "Number of edited photos and delivery time."],
    roles: ["Artist", "Photographer"],
    fields: [
      DATE, SHOOT, FEE("Fee", "$500", "The total paid."),
      field("photos", "Edited photos", "How many finished photos are delivered.", { value: "20" }),
      field("deliveryDays", "Delivered within", "When the edited photos are due.", { value: "14 days" }),
      STATE,
    ],
    body: doc("Photography Services Agreement", ["Artist", "Photographer"], [
      ["SHOOT", "Photographer will photograph Artist on {{shootDate}} and deliver {{photos}} edited, high-resolution photos within {{deliveryDays}}."],
      ["FEE", "Artist pays Photographer {{fee}}, half to book and half on delivery."],
      ["USE", "Artist may use the photos worldwide and forever for anything promoting Artist, including covers, press, social media, merchandise, ads and websites. Photographer keeps the copyright and may use the photos in their portfolio."],
      ["CREDIT", "Artist will credit Photographer where practical, for example in a caption or liner notes."],
      ["RETOUCHING", "Photographer does normal color and skin retouching. Artist won't share unedited photos without Photographer's OK."],
      CLAUSE.cancel48,
    ]),
  },
  {
    id: "cover-art",
    name: "Graphic Design & Cover Artwork Agreement",
    category: "Visual Production",
    summary: "A designer makes your cover art or graphics. You own it once paid.",
    whenToUse: "Use it for single, EP and album covers, logos, flyers and merch designs.",
    keyTerms: ["You own the artwork once paid.", "Files: 3000×3000 cover plus source files.", "Fonts and stock images must be licensed."],
    roles: ["Artist", "Designer"],
    fields: [
      DATE, need("project", "What's being designed", "The artwork you need.", { placeholder: "Cover art for the single \"Song Title\"" }),
      FEE("Fee", "$250", "The total paid."), PAY_WHEN(),
      field("revisions", "Revision rounds", "Rounds of changes included.", { value: "2" }),
      field("deliveryDays", "Delivered within", "When the final artwork is due.", { value: "14 days" }),
      STATE,
    ],
    body: doc("Graphic Design and Cover Artwork Agreement", ["Artist", "Designer"], [
      ["SERVICES", "Designer will create {{project}} (the \"Artwork\") and deliver it within {{deliveryDays}}, with {{revisions}} rounds of changes."],
      ["FILES", "Designer delivers a 3000×3000 pixel JPG and PNG (the size streaming services need), any other agreed sizes, and the editable source files."],
      ["FEE", "Artist pays Designer {{fee}}, {{paySchedule}}."],
      ["OWNERSHIP", "Once paid, Designer assigns all rights in the Artwork to Artist. Designer may show it in their portfolio after release."],
      ["LICENSED MATERIAL", "Designer uses only fonts, images and elements that are original or licensed for commercial use, and gives Artist the license details."],
      CLAUSE.noAI,
    ]),
  },
  {
    id: "model-release",
    name: "Photo & Video Model Release",
    category: "Visual Production",
    summary: "Someone who appears in your photos or videos gives permission to use their image, voice and name.",
    whenToUse: "Use it for anyone on camera in your videos, covers or promo: models, extras, dancers, friends.",
    keyTerms: ["Worldwide and forever.", "No payment owed unless you add one.", "Nothing sexual, defamatory or a fake endorsement.", "Under 18: a parent or guardian signs too."],
    roles: ["Artist", "Model"],
    fields: [
      DATE, PROJECT("Artist's music, music videos, artwork and promotion"),
      field("consideration", "What they receive", "A fee, a gift or nothing.", { value: "credit and the chance to appear in the project, with no payment" }),
      field("uses", "Where it may appear", "Where the photos and video can be used.", { value: "anywhere, in any media, worldwide" }),
      field("exclusions", "Things it won't be used for", "Any use the model doesn't allow.", { fallback: "Nothing else is excluded." }),
      STATE,
    ],
    body: doc("Photo and Video Model Release", ["Artist", "Model"], [
      ["PERMISSION", "Model allows Artist to photograph, film and record Model for {{project}}, and to use Model's image, likeness, voice and name in those photos and recordings."],
      ["WHERE IT MAY BE USED", "Artist may use the photos and recordings {{uses}}, forever, including on streaming services, social media, websites, ads, artwork and press. Artist may edit, crop and combine them with other material, but will not use them in a way that is sexual, defamatory or suggests Model endorses something they haven't agreed to. {{exclusions}}"],
      ["WHAT MODEL RECEIVES", "Model receives {{consideration}}. No other payment or royalty is owed."],
      ["OWNERSHIP", "Artist owns the photos and recordings. Model does not need to approve the final versions."],
      ["NO OBLIGATION", "Artist may use the material, but doesn't have to."],
      ["RELEASE OF CLAIMS", "Model releases Artist from claims of invasion of privacy, right of publicity or defamation arising from the uses allowed here."],
      ["AGE", "Model confirms they are 18 or older. If not, a parent or legal guardian signs too."],
    ]),
  },
  {
    id: "photo-video-release",
    name: "Photo, Video & Testimonial Release",
    category: "Visual Production",
    summary: "Someone gives you permission to use their photo, video, voice, name and written testimonial, forever, in exchange for a gift or fee.",
    whenToUse: "Use it before you post a customer testimonial, a fan video, behind-the-scenes footage or any photo of a person in your marketing.",
    keyTerms: [
      "Perpetual and worldwide: you can keep using the material with no end date, anywhere.",
      "What's covered: photos, video, audio, their name, likeness and the exact written testimonial.",
      "Consideration: what they receive in return (a gift, product or fee). Something of value makes the release stronger.",
      "Editing: you may crop, edit and shorten, but not change the meaning of what they said.",
      "Minors: anyone under 18 needs a parent or guardian to sign too.",
    ],
    roles: ["Company", "Participant"],
    fields: [
      DATE,
      field("materials", "Materials covered", "Everything the person is giving you permission to use.", { value: "photos, video recordings, voice, name, likeness and written testimonial", multiline: true }),
      field("testimonial", "Written testimonial", "The exact words they approved. Leave blank if it isn't written yet.", { multiline: true, placeholder: "Paste their testimonial exactly as approved", fallback: "any written testimonial Participant approves in writing later" }),
      field("consideration", "What they receive", "The gift or payment they get in return for the release.", { placeholder: "One year of Catalog Plus at no cost", fallback: "the chance to be featured" }),
      field("uses", "Where it may appear", "The places you plan to use the material. \"Any media\" is broadest.", { value: "websites, social media, ads, email, presentations and press" }),
      field("credit", "How they are credited", "How the person's name appears next to their testimonial, if at all.", { value: "their first name and city" }),
      STATE,
    ],
    body: `${RELEASE_TERMS}${general(11)}`,
  },
  {
    id: "video-crew",
    name: "Video Production Crew Agreement",
    category: "Visual Production",
    summary: "Hire crew for a shoot day: role, day rate, overtime, and who owns the footage.",
    whenToUse: "Use it for camera operators, gaffers, sound, grips and production assistants.",
    keyTerms: ["Day rate with overtime after 10 hours.", "You own all footage.", "Safety lead's calls are followed."],
    roles: ["Producer", "Crew Member"],
    fields: [
      DATE, need("role", "Crew role", "Their job on set.", { placeholder: "Camera operator" }),
      need("rate", "Day rate", "What they're paid per day, up to 10 hours.", { placeholder: "$350 per day" }), SHOOT,
      field("equipment", "Equipment they bring", "Any gear they supply.", { fallback: "no equipment" }),
      STATE,
    ],
    body: doc("Video Production Crew Agreement", ["Producer", "Crew Member"], [
      ["WORK", "Crew Member will work as {{role}} on {{shootDate}}, bringing {{equipment}}."],
      ["PAY", "Producer pays {{rate}} for up to 10 hours, and 1.5 times the hourly equivalent after that, within 7 days of the shoot."],
      ["OWNERSHIP", "All footage and recordings are owned by Producer. Crew Member may show short clips in their reel after release."],
      ["SAFETY", "Crew Member follows the safety lead's instructions and reports hazards. Nobody is asked to do anything unsafe."],
      CLAUSE.contractor, CLAUSE.confidential, CLAUSE.cancel48,
    ]),
  },
  {
    id: "location-release",
    name: "Video Location Release",
    category: "Visual Production",
    summary: "A property owner lets you film at their place, and show it in the video forever.",
    whenToUse: "Use it for any house, business, studio or venue you shoot in that isn't yours.",
    keyTerms: ["You may show the property forever.", "Leave it as you found it.", "You pay for any damage."],
    roles: ["Producer", "Property Owner"],
    fields: [
      DATE, need("address", "Location address", "The property's address.", { placeholder: "123 Main St, Atlanta, GA" }), SHOOT,
      field("fee", "Location fee", "What the owner is paid, if anything.", { fallback: "no fee" }),
      field("hours", "Hours", "When you can be there.", { value: "8:00 am to 8:00 pm" }),
      STATE,
    ],
    body: doc("Location Release", ["Producer", "Property Owner"], [
      ["PERMISSION", "Property Owner allows Producer and its crew to film at {{address}} (the \"Location\") on {{shootDate}}, {{hours}}, for {{fee}}."],
      ["USE", "Producer may show the Location, including its name, signs and interior, in the finished work and its promotion, worldwide and forever."],
      ["CARE", "Producer will leave the Location as it was found and pay to repair any damage its crew causes."],
      ["AUTHORITY", "Property Owner confirms they have the right to give this permission."],
    ]),
  },
  {
    id: "video-editor",
    name: "Video Editor & Post-Production Agreement",
    category: "Visual Production",
    summary: "An editor cuts your footage into the final video, with color and sound. You own the result.",
    whenToUse: "Use it when you hire someone to edit footage you already have.",
    keyTerms: ["Two rounds of changes.", "You get the project files too.", "You own everything once paid."],
    roles: ["Artist", "Editor"],
    fields: [
      DATE, need("project", "Project", "What's being edited.", { placeholder: "Music video for \"Song Title\"" }),
      FEE("Fee", "$600", "The total paid."), PAY_WHEN(),
      field("deliveryDays", "Delivered within", "When the final edit is due.", { value: "14 days of receiving the footage" }),
      STATE,
    ],
    body: doc("Video Editing and Post-Production Agreement", ["Artist", "Editor"], [
      ["SERVICES", "Editor will edit, color and mix the sound for {{project}}, and deliver it within {{deliveryDays}}, with two rounds of changes."],
      ["FILES", "Editor delivers 4K and 1080p MP4 files, vertical cuts if asked, and the project files."],
      ["FEE", "Artist pays Editor {{fee}}, {{paySchedule}}."],
      ["OWNERSHIP", "Artist owns the footage and finished edit. Editor may show it in their reel after release."],
      CLAUSE.confidential, CLAUSE.noAI,
    ]),
  },
];
