#!/usr/bin/env python3
"""Build public/guide/guide.json and public/guide/pros.json.

Every fact here was checked against its source page on 2026-09-22 (two
research passes; URLs re-verified by title, not just status). Edit this file,
not the JSON, and re-run:  python3 scripts/build-guide.py
Dates in schedule rows are ISO (start/end) so the page can grey out the past.
"""
import json, pathlib
ASOF = "2026-09-22"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "guide"

MLP_SCHED = "https://majorleaguepickleball.co/news/major-league-pickleball-announces-full-2026-may-august-season-schedule-event-tickets-now-on-sale-via-tixr-and-ticketmaster-2/"
PPA_SCHED = "https://ppatour.com/schedule/"
L = lambda name, url, what, kind="": {"name": name, "url": url, "what": what, "kind": kind}
F = lambda fact, source: {"fact": fact, "source": source}
S = lambda start, end, dates, event, city, venue, source: {"start": start, "end": end, "dates": dates, "event": event, "city": city, "venue": venue, "source": source}

# ── shared lists ───────────────────────────────────────────────
RULES = [
    L("Official USA Pickleball Rulebook", "https://usapickleball.org/rules/", "The 2026 rulebook for sanctioned amateur play, with the PDF and the change log.", "official"),
    L("USA Pickleball rules summary", "https://usapickleball.org/rules/summary/", "Serving, two-bounce, the kitchen, faults and scoring in plain language.", "summary"),
    L("UPA-A Official Rulebook", "https://upaa.unitedpickleball.com/official-rulebook/", "The rulebook for PPA Tour and MLP matches, in effect since May 22, 2026.", "pro rules"),
    L("Pickleheads: 7 simple rules", "https://www.pickleheads.com/guides/how-to-play-pickleball", "Read this before your first open play.", "beginner"),
]
LEARN = [
    L("Better Pickleball", "https://www.youtube.com/@BetterPickleball", "Long-running lesson library aimed at players over 50: strokes, footwork, strategy. New video almost daily.", "youtube"),
    L("ThatPickleballGuy · Kyle Koszuta", "https://www.youtube.com/@thatpickleballguy", "A pro's drills, strategy breakdowns and mindset lessons. One of the biggest instruction channels.", "youtube"),
    L("John Cincola Pickleball", "https://www.youtube.com/@johncincolapickleball", "Technique tutorials and advanced doubles strategy, weekly.", "youtube"),
    L("Ed Ju", "https://www.youtube.com/@edjupickleball", "Clear, beginner-friendly how-tos and drill ideas.", "youtube"),
    L("tanner.pickleball", "https://www.youtube.com/@tanner.pickleball", "Tips under a minute. One idea per session.", "youtube"),
    L("Zane Navratil Pickleball", "https://www.youtube.com/@ZaneNavratilPickleball", "A touring pro's match analysis, tips and drills.", "youtube"),
    L("Pickleball Kitchen", "https://www.youtube.com/@PickleballKitchen", "Fundamentals-first lessons across the whole game; updates are occasional now.", "youtube"),
    L("PrimeTime Pickleball", "https://www.youtube.com/@PrimeTimePickleball", "Big back catalog of stroke and positioning lessons. No new uploads since March 2025.", "youtube · archive"),
    L("Third Shot Sports", "https://www.youtube.com/@ThirdShotSports", "Nearly 900 lesson and drill videos. Archive only since January 2025.", "youtube · archive"),
    L("USA Pickleball: Pickleball Skills", "https://usapickleball.org/pickleball-skills/", "Free skill articles tagged Level One to Three, so you can work up in order.", "free course"),
    L("USA Pickleball: How to Play", "https://usapickleball.org/pickleball-skills/level-one/how-to-play-pickleball/", "Court, serve, scoring and the kitchen for day one.", "free course"),
    L("Pickleheads Guides", "https://www.pickleheads.com/guides", "Free guides on rules, shots, strategy and gear.", "free course"),
]
COACH = [
    L("PPR: Find a Pro", "https://pprpickleball.org/find-a-pro/", "Search the Professional Pickleball Registry's certified teaching pros.", "directory"),
    L("PCI: Member Directory", "https://www.pickleballcoachinginternational.com/pages/member-directory", "Pickleball Coaching International's certified coaches.", "directory"),
    L("IPTPA", "https://iptpa.com/", "International Pickleball Teaching Professional Association: what the certification means.", "certifier"),
    L("RSPA Pickleball Certification", "https://rspa.net/pickleball-certification/", "What an RSPA credential on a coach's bio means.", "certifier"),
    L("USA Pickleball: Coach Education", "https://usapickleball.org/coaching/", "Which certifications USA Pickleball recognizes (PCI, PPR, RSPA). There is no national directory.", "official"),
]
GEAR = [
    L("John Kew Pickleball", "https://www.youtube.com/@JohnKewPickleball", "Lab-style paddle testing: measured power, spin and swing weight, not just feel.", "youtube"),
    L("John Kew: test data", "https://www.johnkewpickleball.com/", "His paddle test numbers and reviews in one place.", "site"),
    L("Pickleball Effect", "https://www.youtube.com/@PickleballEffect", "Braydon Unsicker's in-depth, play-tested reviews and comparisons.", "youtube"),
    L("Pickleball Effect: Find Your Paddle", "https://pickleballeffect.com/", "Searchable reviews and specs, side by side.", "site"),
    L("Pickleball Studio", "https://www.youtube.com/@PickleballStudio", "Chris Olson's reviews, first looks and gear news.", "youtube"),
    L("Pickleball Studio: paddle finder", "https://pickleballstudio.com/", "Match a paddle to your game.", "site"),
    L("Matt's Pickleball", "https://www.youtube.com/@MattsPickleball", "Test-and-data reviews of new paddles, posted often.", "youtube"),
    L("Pickleball Pursuit", "https://www.youtube.com/@PickleballPursuit", "Detailed single-paddle reviews for when you're down to a few.", "youtube"),
    L("STS Pickleball", "https://www.youtube.com/@stspickleball", "Polished paddle reviews and roundups.", "youtube"),
]
WATCH = [
    L("PickleballTV", "https://pickleballtv.com/", "Streams every round of every PPA event and every MLP match. Subscription.", "streaming"),
    L("Pickleball.com: Where to Watch", "https://pickleball.com/watch-now", "One page showing where upcoming pro matches air.", "listings"),
    L("PPA Tour on YouTube", "https://www.youtube.com/channel/UCSP6HlrMmRqogym2aHBPHpw", "Official channel: replays, highlights, streamed courts.", "youtube"),
    L("PPA Tour: Watch", "https://www.ppatour.com/watch/", "The tour's own page for where each event airs.", "listings"),
    L("Major League Pickleball on YouTube", "https://www.youtube.com/@MajorLeaguePickleball", "Full MLP matches posted after each match day.", "youtube"),
    L("APPTV (APP Tour on YouTube)", "https://www.youtube.com/@TheAPPTour", "The APP's official channel: tour and collegiate matches. (The @APPTour handle is a Swiss tourism board.)", "youtube"),
]
LISTEN = [
    L("PicklePod", "https://podcasts.apple.com/us/podcast/picklepod/id1584931417", "Weekly pro-tour news, gossip and interviews from The Dink.", "podcast"),
    L("The Dink", "https://www.thedinkpickleball.com/", "Daily news on pros, gear and events.", "news"),
    L("The Dink Newsletter", "https://newsletter.thedinkpickleball.com/", "The week's news in one email.", "newsletter"),
    L("The Kitchen Pickleball", "https://thekitchenpickle.com/", "News, reviews and commentary, several times a week.", "news"),
    L("Pickleball Studio Podcast", "https://podcasts.apple.com/us/podcast/pickleball-studio-podcast/id1627542550", "Weekly gear and industry talk.", "podcast"),
    L("Pickleball Therapy", "https://podcasts.apple.com/us/podcast/pickleball-therapy/id1523311733", "Tony Roig on the mental side and decision-making.", "podcast"),
    L("Everything But The Kitchen Dink", "https://podcasts.apple.com/us/podcast/everything-but-the-kitchen-dink-pickleball-podcast/id1650123243", "Rec-player chat show about the whole scene.", "podcast"),
    L("Dinks On Tap", "https://podcasts.apple.com/us/podcast/dinks-on-tap-the-happy-hour-pickleball-podcast/id1776366798", "Light social-player podcast, happy-hour format.", "podcast"),
    L("Pickleball Magazine", "https://www.pickleballmagazine.com/", "Magazine features and instruction articles.", "magazine"),
]
FIND = [
    L("Pickleheads Court Finder", "https://www.pickleheads.com/courts", "Map of 19,000+ US courts with open-play info. USA Pickleball's official finder.", "courts"),
    L("PickleballTournaments.com", "https://pickleballtournaments.com/", "Search and register for tournaments. PickleballBrackets now redirects here.", "tournaments"),
    L("DUPR", "https://www.dupr.com/", "Log matches, get rated, find level-matched leagues and events.", "ratings · leagues"),
    L("PlayTime Scheduler", "https://playtimescheduler.com/", "Free sign-up sheets many local groups use for open play.", "open play"),
    L("USA Pickleball: Places to Play", "https://usapickleball.org/places-to-play/", "The governing body's court finder (routes to Pickleheads).", "courts"),
]
RATINGS_TABLE = {"type": "table", "cols": ["rating", "scale", "what it is", "who uses it"], "rows": [
    {"cells": ["DUPR", "2.000–8.000", "Results-based; separate singles and doubles. New players start unrated.", "PPA, MLP, and (since Dec 2025) every USA Pickleball-owned event"], "url": "https://www.dupr.com/", "source": "https://usapickleball.org/skill-level/ratings/"},
    {"cells": ["UTR-P", "1.0–10.0", "Age- and gender-neutral, updated daily. Provisional until seven matches.", "The APP Tour's official rating; USA Pickleball's from 2024 until Dec 2025"], "url": "https://www.utrsports.net/pages/how-utr-p-works", "source": "https://support.universaltennis.com/en/support/solutions/articles/9000225234-faq-pickleball"},
    {"cells": ["UTPR", "1.0–6.0", "USA Pickleball's older tournament rating.", "Legacy; replaced"], "url": "https://usapickleball.org/skill-level/ratings/", "source": "https://www.utrsports.net/pages/how-utr-p-works"},
    {"cells": ["WPR", "points", "A pro ranking, not a skill rating: PPA points over 52 weeks, weighted 50% gender doubles, 35% mixed, 15% singles.", "PPA Tour worldwide"], "url": "https://ppatour.com/rankings/", "source": "https://ppatour.com/rankings/"},
    {"cells": ["Rally", "2.00–8.00", "Say your number, then only countersigned matches move it. Open integer Elo on a public ledger.", "You and your crew"], "url": "/#your-number"},
]}
MONEY = [
    F("Pros earn from four places: UPA contracts (guaranteed salary), prize money, MLP team contracts, and equipment deals (paddle, ball, apparel). The UPA says 2026 shifts pay from salary toward prize money.", "https://pickleball.com/news/upa-works-to-extend-pro-contracts-will-pay-out-millions-in-prize-money"),
    F("The UPA's plan: up to $31M in player earnings starting 2026: $11M guaranteed, $15M domestic prize money (PPA + MLP), $5M international.", "https://pickleball.com/news/upa-works-to-extend-pro-contracts-will-pay-out-millions-in-prize-money"),
    F("In the 2026 MLP draft the St. Louis Shock paid $1.23 million for Anna Bright and the New Jersey 5s paid $800,000 for Jorja Johnson. A salary cap and floor are expected for 2027.", "https://www.thedinkpickleball.com/the-new-jersey-fives-take-home-the-2026-mlp-championship/"),
    F("Anna Leigh Waters left Paddletek for a long-term Franklin deal in January 2026. Terms weren't disclosed; the $10M figure going around is podcast speculation.", "https://pickleballrookie.com/the-biggest-paddle-deal-in-pickleball-history-contract-drama-rocks-the-pro-tour-and-mlp-heads-to-disney-world"),
    F("APP pro prize money: $1.5M across 2026, doubling to $3M in 2027 across 12 events.", "https://www.theapp.global/news/app-tour-doubles-professional-prize-money-expands-2027-tour-schedule"),
    F("The 2026 US Open in Naples drew more than 500 pros for a purse of more than $160,000.", "https://www.marconews.com/story/sports/2026/04/10/2026-us-open-pickleball-championships-gets-underway-in-east-naples/89561007007/"),
    F("UPA-A paddle certification costs a brand $10,000 a year plus $3,000 per paddle (valid 24 months), with paid rush options up to $7,500.", "https://upaa.unitedpickleball.com/paddle-testing/2026-upa-a-certification/"),
]
GOVERNANCE = [
    F("MLP and the PPA Tour merged in 2024 under the United Pickleball Association (UPA), which runs both.", MLP_SCHED),
    F("In May 2024 the UPA replaced USA Pickleball as its governing body with its own UPA of America (UPA-A). USA Pickleball had been the only US governing body since 1984.", "https://www.thedinkpickleball.com/upa-severs-ties-with-usa-pickleball/"),
    F("Two paddle rulebooks now: UPA-A certification (performance-tested: power and spin, after break-in) is required for PPA and MLP pro play since Sept 1, 2025. Amateur divisions just need the paddle on USA Pickleball's approved list.", "https://upaa.unitedpickleball.com/paddle-testing/2026-upa-a-certification/"),
    F("UPA contracts are exclusive. In Dec 2025 it terminated three pros' contracts for playing unsanctioned events in Japan; they appealed.", "https://www.thedinkpickleball.com/upa-terminates-contracts-of-ignatowich-fu-glozman-following-participation-in-unsanctioned-event/"),
    F("USA Pickleball still sanctions the US Open in Naples and runs its own National Championships, and partners with the APP on Golden Ticket qualifiers.", "https://www.thedinkpickleball.com/dupr-is-now-the-official-ratings-partner-of-usa-pickleball/"),
    F("The senior pro league (50+) formerly called the National Pickleball League is now Champions Series Pickleball, licensed since March 2026 as the MLP Champions Series, with 16 teams.", "https://majorleaguepickleball.co/news/major-league-pickleball-announces-partnership-with-pro-senior-pickleball-league-champions-series-pickleball-csp/"),
]

# rest-of-2026 across everyone
AHEAD = [
    S("2026-09-14", "2026-09-20", "Sep 14–20", "PPA Arizona Open", "Mesa, AZ", "Arizona Athletic Grounds", "https://ppatour.com/watch/tv/"),
    S("2026-09-17", "2026-09-20", "Sep 17–20", "APP Overland Park Open", "Overland Park, KS", "", "https://www.theapp.global/news/sunday-broadcast-overland-park-2026"),
    S("2026-09-28", "2026-10-04", "Sep 28–Oct 4", "PPA Las Vegas Open", "Las Vegas, NV", "Darling Tennis Center", PPA_SCHED),
    S("2026-10-01", "2026-10-04", "Oct 1–4", "APP Columbus Open ($125K)", "Columbus, OH", "Pickle & Chill", "https://www.theapp.global/tour-schedule/2026-app-columbus-open"),
    S("2026-10-05", "2026-10-11", "Oct 5–11", "PPA Chicago Cup", "Chicago, IL", "Life Time North Shore", PPA_SCHED),
    S("2026-10-08", "2026-10-11", "Oct 8–11", "MLP Champions Series (50+)", "Columbus, OH", "", "https://www.nplpickleball.com/"),
    S("2026-10-12", "2026-10-18", "Oct 12–18", "PPA Virginia Beach Open", "Virginia Beach, VA", "Pickleball Virginia Beach", PPA_SCHED),
    S("2026-10-13", "2026-10-18", "Oct 13–18", "PPA Australia Pickleball Cup", "Brisbane, QLD", "Queensland Tennis Centre", PPA_SCHED),
    S("2026-10-15", "2026-10-18", "Oct 15–18", "APP Louisville Open ($125K)", "Louisville, KY", "Kentucky International Convention Center", "https://www.theapp.global/tour-schedule/2026-app-louisville"),
    S("2026-10-19", "2026-10-25", "Oct 19–25", "PPA Asia Hong Kong Slam", "Hong Kong", "Kai Tak Arena", PPA_SCHED),
    S("2026-10-30", "2026-11-01", "Oct 30–Nov 1", "MLP Nations Cup (first ever)", "Dallas, TX", "Brookhaven Country Club", "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/"),
    S("2026-10-31", "2026-11-08", "Oct 31–Nov 8", "USA Pickleball National Championships", "San Diego, CA", "Barnes Tennis Center", "https://usapickleball.org/tournaments/us-open-pickleball-championships/"),
    S("2026-11-02", "2026-11-08", "Nov 2–8", "PPA Pickleball World Championships (Major)", "Farmers Branch, TX", "Brookhaven Country Club", "https://ppatour.com/events/2026/pickleball-world-championships/"),
    S("2026-11-12", "2026-11-15", "Nov 12–15", "APP Arizona Open ($125K)", "Mesa, AZ", "Arizona Athletic Grounds", "https://www.theapp.global/tour-schedule/2026-app-arizona"),
    S("2026-11-16", "2026-11-22", "Nov 16–22", "PPA Daytona Beach Open", "Holly Hill, FL", "", PPA_SCHED),
    S("2026-12-03", "2026-12-06", "Dec 3–6", "APP Tour Championships", "Fort Lauderdale, FL", "The Fort", "https://www.theapp.global/tour-schedule/2026-app-tour-championships"),
    S("2026-12-14", "2026-12-20", "Dec 14–20", "PPA Malibu Showcase", "Malibu, CA", "", PPA_SCHED),
    S("2027-01-11", "2027-01-17", "Jan 11–17, 2027", "PPA Pickleball Masters (Major)", "Rancho Mirage, CA", "", PPA_SCHED),
    S("2027-04-17", "2027-04-24", "Apr 17–24, 2027", "US Open Pickleball Championships", "Naples, FL", "East Naples Community Park", "https://usapickleball.org/tournaments/us-open-pickleball-championships/"),
    S("2027-05-10", "2027-05-16", "May 10–16, 2027", "PPA Finals", "San Clemente, CA", "", PPA_SCHED),
]

SOUTH_BAY = [
    ("California Smash", "El Segundo · 815 N. Nash St", "Nine padded indoor courts, no membership required, daily open play and classes, and a bar and restaurant.", "https://calismash.com/"),
    ("El Segundo Recreation Park", "El Segundo · 401 Sheldon St", "The city's team pickleball leagues: women's, mixed, men's and 4.5+, eight-week seasons. For other court use call 310-524-2700.", "https://www.elsegundorecparks.gov/programs-services/recreation-programs-activities/adult-sports/pickleball"),
    ("Holly Glen Park", "Hawthorne · 5255 W. 137th St", "Four hybrid tennis/pickleball courts. The city says bring your own net and equipment.", "https://www.cityofhawthorne.org/departments/community-services/tennis-pickleball-courts"),
    ("Betty Ainsworth Sports Center", "Hawthorne · 3851 W. El Segundo Blvd", "Four hybrid courts where the city supplies nets and equipment. Easiest if you have no gear.", "https://www.cityofhawthorne.org/departments/community-services/tennis-pickleball-courts"),
    ("Manhattan Heights Park", "Manhattan Beach · 1600 Manhattan Beach Blvd", "Weekday 8am–noon drop-in with a monthly pass. Courts here and at Live Oak Park book online, 4 days ahead for residents, 3 for everyone else.", "https://www.manhattanbeach.gov/departments/parks-and-recreation/tennis"),
    ("Alta Vista Park Racquet Center", "Redondo Beach · 715 Julia Ave", "Four lighted courts; $25 annual membership plus hourly fees, reservations up to 7 days ahead. Perry, Franklin, Anderson and Dale Page parks have shared first-come courts (bring a net).", "https://www.redondo.org/business_detail_T14_R115.php"),
    ("Walteria Park", "Torrance · 3855 242nd St", "Six free first-come courts with open play and senior sessions.", "https://discovertorrance.com/pickleball-in-torrance/"),
    ("South Bay Tennis & Pickleball Center", "Torrance · 25924 Rolling Hills Rd", "Nine dedicated courts, $5 open play, adult leagues, social nights and lessons.", "https://www.sbtcpickleball.com/"),
    ("City of Torrance: Pickleball & Tennis", "Torrance · citywide", "Book courts and sign up for open play, group lessons and private lessons.", "https://www.torranceca.gov/Our-Community/Classes-and-Programs/Classes-Programs/Pickleball-and-Tennis"),
]
TRIPS = [
    ("Naples, FL", "East Naples Community Park", "Home of the US Open Pickleball Championships, ten years running. Next one: April 17–24, 2027.", "https://www.usopenpickleball.com/", "https://www.airbnb.com/s/Naples--FL/homes", "https://www.usopenpickleball.com/"),
    ("San Diego, CA", "Barnes Tennis Center", "19 pickleball courts; hosts the USA Pickleball National Championships, Oct 31–Nov 8, 2026. Two hours down the 5.", "https://www.barnestenniscenter.com/", "https://www.airbnb.com/s/San-Diego--CA/homes", "https://usapickleball.org/usap-news/nationals/usa-pickleball-national-championships-return-to-barnes-tennis-center-in-2026/"),
    ("Daytona Beach area, FL", "Pictona at Holly Hill", "A 49-court club open to visitors on a $15 day pass, with a free Pickleball 101 class.", "https://pictona.org/", "https://www.airbnb.com/s/Daytona-Beach--FL/homes", "https://pictona.org/overview/"),
    ("Fort Lauderdale, FL", "The Fort", "43 courts (14 weatherproof) and what it calls the first pickleball stadium. Hosts the APP Tour Championships Dec 3–6.", "https://playthefort.com/", "https://www.airbnb.com/s/Fort-Lauderdale--FL/homes", "https://playthefort.com/"),
    ("Orange Beach, AL", "Orange Beach Pickleball Complex", "New public complex (opened May 2026): 14 lighted courts, open 7am–10pm daily, plus 6 indoor courts nearby.", "https://www.orangebeachal.gov/1657/Pickleball-Complex", "https://www.airbnb.com/s/Orange-Beach--AL/homes", "https://www.orangebeachal.gov/1657/Pickleball-Complex"),
    ("St. George, UT", "Little Valley Pickleball Complex", "24 lighted outdoor courts; pickleball at the Huntsman World Senior Games every October. Zion is next door.", "https://greaterzion.com/venues/little-valley-pickleball-complex/", "https://www.airbnb.com/s/St.-George--UT/homes", "https://seniorgames.net/sports/pickleball"),
    ("Los Barriles, Baja, Mexico", "Tres Palapas Baja Pickleball Resort", "A pickleball resort: 10 courts, casitas and villas on site, open play most days ($20 day rate), Baja Classic tournament Nov 18–22, 2026.", "https://www.trespalapasbaja.com/", "https://www.airbnb.com/s/Los-Barriles--Baja-California-Sur--Mexico/homes", "https://www.trespalapasbaja.com/"),
    ("Brisbane, Australia", "Queensland Tennis Centre", "PPA Tour Australia's Australian Pickleball Cup, Oct 13–18, 2026, at Pat Rafter Arena.", "https://ppatour.com.au/", "https://www.airbnb.com/s/Brisbane--Queensland--Australia/homes", "https://ppatour.com.au/"),
    ("Greater Kuala Lumpur, Malaysia", "9Pickle Setia Alam", "Hosted the PPA Tour Asia Kuala Lumpur Open in May 2026, with amateur divisions alongside the pros.", "https://www.ppatour-asia.com/tournament/2026/kuala-lumpur-open/", "https://www.airbnb.com/s/Shah-Alam--Selangor--Malaysia/homes", "https://www.ppatour-asia.com/tournament/2026/kuala-lumpur-open/"),
]

RALLY_TOOLS = {"type": "cards", "items": [
    {"title": "What's your number?", "sub": "no wallet", "body": "Pick the line that sounds like you. Make it official when you want it on the ladder.", "links": [{"label": "Find my number", "url": "/#your-number"}]},
    {"title": "The open play desk", "sub": "tonight · no accounts", "body": "Names in, fair rotating rounds out, scores, standings, a recap card for the group chat.", "links": [{"label": "Keep score tonight", "url": "/tonight/"}]},
    {"title": "The score caller", "sub": "one game", "body": "Tap who won the rally. It keeps the server, the side, the 0-0-2 start, and says the call out loud.", "links": [{"label": "Call a game", "url": "/score/"}]},
    {"title": "The bag", "sub": "your paddles", "body": "Log paddle hours and wear. Send a wear report to the public register.", "links": [{"label": "Open the bag", "url": "/bag/"}]},
    {"title": "The paddle calendar", "sub": "2026 releases", "body": "Every paddle release this year, sourced.", "links": [{"label": "See the calendar", "url": "/paddle-calendar/"}]},
    {"title": "The paddle fund", "sub": "crew money game", "body": "Ten seats, $20 a week, a $200 paddle every week.", "links": [{"label": "Play the sprint", "url": "/paddle-fund/"}]},
    {"title": "The ladder", "sub": "the record", "body": "Only matches every player countersigns move it. Anyone can replay the math.", "links": [{"label": "See the ladder", "url": "/#board"}, {"label": "MCP for agents", "url": "/api/mcp"}]},
]}

cards = lambda rows: {"type": "cards", "items": rows}
guide = {
    "asOf": ASOF,
    "method": "Two research passes on 2026-09-22; every link opened and checked by page title, every number checked against its source page. Summaries have gotten pickleball facts wrong before, so anything we couldn't confirm is left out.",
    "chapters": [
        {"id": "game", "short": "The game", "title": "The game in a minute", "dek": "Enough to walk into open play tonight.", "blocks": [
            {"type": "quick", "items": [
                {"big": "20 × 44 ft", "small": "the court, for singles and doubles"},
                {"big": "7 ft", "small": "the kitchen (non-volley zone) on each side of the net: no volleys while you're in it or on its line"},
                {"big": "36 / 34 in", "small": "net height at the sidelines / at the center"},
                {"big": "2 bounces", "small": "the return must bounce, then the serving side's third shot must bounce, before anyone volleys"},
                {"big": "Underhand", "small": "serve diagonally, clearing the kitchen"},
                {"big": "11, by 2", "small": "a normal game; only the serving side scores"},
            ]},
            {"type": "note", "text": "The basics above are from the USA Pickleball rulebook. Pro events (PPA, MLP) play the UPA-A rulebook, and some formats use rally scoring."},
            {"heading": "Rulebooks", "type": "links", "items": RULES},
            {"heading": "Keep the call straight", "type": "cards", "items": [RALLY_TOOLS["items"][2]]},
        ]},
        {"id": "gear", "short": "Gear", "title": "Paddles and the people who test them", "dek": "There are now two paddle rulebooks, dozens of releases a year, and a handful of independent testers worth trusting.", "blocks": [
            {"type": "cards", "items": [
                {"title": "The Paddle Register", "sub": "pointcast.xyz · 92 paddles", "body": "On-sale dates, prices, USA Pickleball and UPA-A status, construction, to-scale drawings. Links out to each lab instead of copying numbers.", "links": [{"label": "Browse", "url": "https://pointcast.xyz/paddles"}, {"label": "Compare", "url": "https://pointcast.xyz/paddles/compare"}, {"label": "Which paddles are legal where", "url": "https://pointcast.xyz/paddles/legal"}, {"label": "What the pros use", "url": "https://pointcast.xyz/paddles/pros"}]},
                RALLY_TOOLS["items"][4], RALLY_TOOLS["items"][3],
            ]},
            {"heading": "Independent testers and reviewers", "type": "links", "items": GEAR},
        ]},
        {"id": "ratings", "short": "Ratings", "title": "What the numbers mean", "dek": "Four rating systems, one ranking, and which events care about which. DUPR is the one you'll be asked for.", "blocks": [RATINGS_TABLE]},
        {"id": "learn", "short": "Learn", "title": "Get better", "dek": "Free lessons that are actually good, and how to check a coach's credentials.", "blocks": [
            {"heading": "Videos and free courses", "type": "links", "items": LEARN},
            {"heading": "Find a certified coach", "type": "links", "items": COACH},
        ]},
        {"id": "watch", "short": "Watch", "title": "Watch and listen", "dek": "Where the pros stream, and the shows and newsletters that cover the sport.", "blocks": [
            {"type": "cards", "items": [{"title": "The Pro desk", "sub": "PPA · MLP · APP", "body": "Every pro event for the rest of 2026, MLP's format and 20 teams, current rankings, and where each event airs.", "links": [{"label": "Open the Pro desk", "url": "/pros/"}]}]},
            {"heading": "Streams and channels", "type": "links", "items": WATCH},
            {"heading": "Podcasts, news, newsletters", "type": "links", "items": LISTEN},
        ]},
        {"id": "calendar", "short": "Pro calendar", "title": "Pro calendar, rest of 2026", "dek": "Every tour on one list. The highlighted row is next up.", "blocks": [
            {"type": "schedule", "rows": AHEAD},
            {"type": "note", "text": "PPA = the UPA's tour. APP = the independent tour. USA Pickleball runs the amateur Nationals and sanctions the US Open. Full detail on the Pro desk."},
        ]},
        {"id": "play", "short": "Play", "title": "Find a game, a league, a tournament", "dek": "From tonight's open play to a sanctioned bracket.", "blocks": [
            {"type": "links", "items": FIND},
            {"type": "facts", "items": [
                F("USA Pickleball's amateur National Championships run Oct 31–Nov 8, 2026 at Barnes Tennis Center in San Diego.", "https://usapickleball.org/tournaments/us-open-pickleball-championships/"),
                F("The next US Open in Naples runs April 17–24, 2027. It's sanctioned by USA Pickleball, not the PPA or APP.", "https://usapickleball.org/tournaments/us-open-pickleball-championships/"),
            ]},
            {"heading": "Run your own night", "type": "cards", "items": [RALLY_TOOLS["items"][1]]},
        ]},
        {"id": "business", "short": "The business", "title": "The money, the tours, the politics", "dek": "Who owns what, how pros get paid, and why there are two paddle rulebooks.", "blocks": [
            {"heading": "How pros get paid", "type": "facts", "items": MONEY},
            {"heading": "Who runs the sport", "type": "facts", "items": GOVERNANCE},
        ]},
        {"id": "southbay", "short": "South Bay", "title": "South Bay courts", "dek": "El Segundo to Torrance, from the official pages. Drop-in and reservation details only where the city or club says so.", "blocks": [
            cards([{"title": n, "sub": sub, "body": body, "links": [{"label": "Official page", "url": u}]} for n, sub, body, u in SOUTH_BAY]),
            {"type": "note", "text": "Looking for a local pro? Every club above runs lessons; check a coach's certification in the Learn chapter. We don't list individual coaches we can't verify."},
        ]},
        {"id": "travel", "short": "Trips", "title": "Trips worth taking", "dek": "Places where the courts are the reason to go. Each has an official page and a ready Airbnb search for the town.", "blocks": [
            cards([{"title": p, "sub": v, "body": why, "source": src, "links": [{"label": "The venue", "url": vu}, {"label": "Stays nearby", "url": ab}]} for p, v, why, vu, ab, src in TRIPS]),
            {"type": "note", "text": "Airbnb links open a plain search for the town. No affiliate links anywhere in this guide."},
        ]},
        {"id": "rally", "short": "Rally tools", "title": "Rally's own tools", "dek": "Free, no sign-up, everything stays on your phone unless you choose to sign it onto the ledger.", "blocks": [RALLY_TOOLS]},
    ],
}

MLP_TEAMS = ["Atlanta Bouncers", "Bay Area Breakers", "Brooklyn Pickleball Team", "California Black Bears", "Carolina Hogs", "Chicago Slice", "Columbus Sliders", "Dallas Flash", "Florida Smash", "Las Vegas Night Owls", "Los Angeles Mad Drops", "Miami Pickleball Club", "New Jersey 5s", "Orlando Squeeze", "Palm Beach Royals", "Phoenix Flames", "SoCal Hard Eights", "St. Louis Shock", "Texas Ranchers", "Utah Black Diamonds"]
MLP_2026 = [
    S("2026-05-22", "2026-05-25", "May 22–25", "Regular season #1", "Dallas, TX", "Pickler Universe – Carrollton", MLP_SCHED),
    S("2026-05-28", "2026-05-31", "May 28–31", "Regular season #2", "Columbus, OH", "Pickle & Chill", MLP_SCHED),
    S("2026-06-04", "2026-06-07", "Jun 4–7", "Regular season #3", "St. Louis, MO", "Chaifetz Arena", MLP_SCHED),
    S("2026-06-11", "2026-06-14", "Jun 11–14", "Regular season #4", "Austin, TX", "Austin Pickle Ranch", MLP_SCHED),
    S("2026-06-17", "2026-06-21", "Jun 17–21", "Regular season #5", "St. Petersburg, FL", "St. Pete Athletic", MLP_SCHED),
    S("2026-06-25", "2026-06-28", "Jun 25–28", "Regular season #6", "New York, NY", "Sportime Randall's Island", MLP_SCHED),
    S("2026-07-08", "2026-07-12", "Jul 8–12", "Mid-Season Tournament", "Grand Rapids, MI", "Bellknap Park", MLP_SCHED),
    S("2026-07-16", "2026-07-19", "Jul 16–19", "Regular season #7", "San Diego, CA", "Barnes Tennis Center", MLP_SCHED),
    S("2026-07-23", "2026-07-26", "Jul 23–26", "Regular season #8", "Chicago, IL", "Life Time North Shore", MLP_SCHED),
    S("2026-07-30", "2026-08-02", "Jul 30–Aug 2", "Regular season #9 (finale)", "Orlando, FL", "ESPN Wide World of Sports", MLP_SCHED),
    S("2026-08-06", "2026-08-09", "Aug 6–9", "Playoffs: first round", "Dallas, TX", "Pickler Universe – DFW", MLP_SCHED),
    S("2026-08-13", "2026-08-16", "Aug 13–16", "Playoffs: quarterfinals", "Newport Beach, CA", "Tennis and Pickleball Club", MLP_SCHED),
    S("2026-08-28", "2026-08-30", "Aug 28–30", "Semifinals & Finals: New Jersey 5s d. St. Louis Shock", "New York, NY", "CityPickle at Wollman Rink", "https://www.thedinkpickleball.com/the-new-jersey-fives-take-home-the-2026-mlp-championship/"),
    S("2026-10-30", "2026-11-01", "Oct 30–Nov 1", "MLP Nations Cup (first ever): USA, Canada, Asia, Western Europe, Eastern Europe, South America, Australia", "Dallas, TX", "Brookhaven Country Club", "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/"),
]
RANK_SRC = "https://ppatour.com/rankings/"
PB = "https://pickleball.com/rankings?ranking_type=currentSeed&page=1&type="
def ranks(title, src, rows): return {"heading": title, "type": "table", "cols": ["#", "player", "points"], "rows": [{"cells": [str(i + 1), n, p], "source": src} for i, (n, p) in enumerate(rows)]}

pros = {
    "asOf": ASOF,
    "method": "Official tour and league pages, checked 2026-09-22. Rankings move weekly; the date on each table is the date we read it.",
    "chapters": [
        {"id": "map", "short": "Who's who", "title": "Three tours and a league", "dek": "The pro game is split in two, with the amateur governing body off to one side.", "blocks": [
            {"type": "cards", "items": [
                {"title": "UPA: PPA Tour + MLP", "sub": "the big one", "body": "The United Pickleball Association owns the Carvana PPA Tour (individual events, split season Aug 2026 → May 2027) and Major League Pickleball (the team league, May–Aug). Exclusive player contracts; its own rulebook and paddle standard, UPA-A.", "source": MLP_SCHED, "links": [{"label": "PPA Tour", "url": "https://ppatour.com/"}, {"label": "MLP", "url": "https://majorleaguepickleball.co/"}]},
                {"title": "APP Tour", "sub": "independent", "body": "The Association of Pickleball Players: tournaments open to pros and amateurs, AARP Champions (50+) and Masters (60+) pro divisions. Ten US events and $1.5M in pro prize money in 2026.", "source": "https://www.theapp.global/news/app-tour-doubles-professional-prize-money-expands-2027-tour-schedule", "links": [{"label": "APP", "url": "https://www.theapp.global/"}]},
                {"title": "USA Pickleball", "sub": "amateur governing body", "body": "Runs the amateur Nationals, sanctions the US Open in Naples, keeps the approved-paddle list, and uses DUPR for ratings since Dec 2025.", "source": "https://usapickleball.org/skill-level/ratings/", "links": [{"label": "USA Pickleball", "url": "https://usapickleball.org/rules/"}]},
                {"title": "MLP Champions Series", "sub": "50+ pros", "body": "The senior pro team league, formerly the National Pickleball League, licensed under the MLP brand since March 2026. 16 teams.", "source": "https://majorleaguepickleball.co/news/major-league-pickleball-announces-partnership-with-pro-senior-pickleball-league-champions-series-pickleball-csp/", "links": [{"label": "Champions Series", "url": "https://www.nplpickleball.com/"}]},
            ]},
        ]},
        {"id": "next", "short": "Next up", "title": "Every pro event, rest of 2026", "dek": "All tours on one list. The highlighted row is next.", "blocks": [{"type": "schedule", "rows": AHEAD}]},
        {"id": "mlp", "short": "MLP", "title": "Major League Pickleball", "dek": "Coed teams, four games a match, and a singles relay when it's tied. The 2026 season is done; the New Jersey 5s won it.", "blocks": [
            {"type": "facts", "items": [
                F("New Jersey 5s beat the St. Louis Shock in the 2026 Finals at CityPickle at Wollman Rink in Central Park on Aug 30, their first MLP title. Federico Staksrud was Finals MVP.", "https://www.thedinkpickleball.com/the-new-jersey-fives-take-home-the-2026-mlp-championship/"),
                F("Up next: the first MLP Nations Cup, Oct 30–Nov 1 in Dallas, with regional teams. It opens the PPA World Championships week. Every match on PickleballTV.", "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/"),
            ]},
            {"heading": "How a match works", "type": "facts", "items": [
                F("A team match is four games: women's doubles, men's doubles, then two mixed doubles. Tied 2–2 means a fifth game, the DreamBreaker.", "https://majorleaguepickleball.co/faq/"),
                F("DreamBreaker: singles where each team rotates its players every four points, rally scoring to 21, win by two. The home team names its order first.", "https://majorleaguepickleball.co/faq/"),
                F("Doubles games use side-out scoring to 11, win by 2.", "https://majorleaguepickleball.co/abcs-of-mlp/"),
                F("20 teams in 2026, all in one league. At each regular-season event 11 teams play round-robin Thursday to Saturday, and Sunday head-to-heads award standings points.", "https://majorleaguepickleball.co/abcs-of-mlp/"),
                F("Top 12 make the playoffs; seeds 1–4 get byes. First round in Dallas, quarterfinals in Newport Beach, semis and finals in New York.", "https://majorleaguepickleball.co/abcs-of-mlp/"),
            ]},
            {"heading": "The 20 teams", "type": "quick", "items": [{"big": t.split(" ")[-1] if False else t, "small": ""} for t in MLP_TEAMS]},
            {"type": "note", "text": "Closest to the South Bay: the Los Angeles Mad Drops, SoCal Hard Eights and California Black Bears. Team list from majorleaguepickleball.co/mlp-teams."},
            {"heading": "The 2026 season", "type": "schedule", "rows": MLP_2026},
            {"heading": "Where to watch", "type": "links", "items": [
                L("PickleballTV", "https://pickleballtv.com/", "Every MLP match, plus the app.", "streaming"),
                L("MLP on YouTube", "https://www.youtube.com/@MajorLeaguePickleball", "Full matches posted after each match day.", "youtube"),
                L("MLP Nations Cup", "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/", "Format, teams, tickets for Oct 30–Nov 1.", "event"),
            ]},
        ]},
        {"id": "ppa", "short": "PPA", "title": "The PPA Tour", "dek": "The 2026–27 season runs from late August to the PPA Finals in May. Events are tiered: Majors carry 2,000–3,000 ranking points, Cups 1,500, Opens 500–1,000.", "blocks": [
            {"type": "schedule", "rows": [r for r in AHEAD if r["event"].startswith("PPA")] + [S("2026-08-31", "2026-09-06", "Aug 31–Sep 6", "PPA National Championships (Major)", "Cary, NC", "Cary Tennis Park", "https://ppatour.com/watch/tv/")]},
            {"heading": "Where to watch", "type": "links", "items": [
                L("PickleballTV", "https://pickleballtv.com/", "Every round of every PPA event.", "streaming"),
                L("Tennis Channel", "https://www.tennischannel.com/", "Semifinal and championship windows.", "tv"),
                L("PPA TV listings", "https://ppatour.com/watch/tv/", "FOX Sports FS1/FS2, CBS and other windows, event by event.", "listings"),
                L("PPA Tour on YouTube", "https://www.youtube.com/channel/UCSP6HlrMmRqogym2aHBPHpw", "Replays and highlights.", "youtube"),
            ]},
        ]},
        {"id": "app", "short": "APP", "title": "The APP Tour", "dek": "The independent tour: pros and amateurs at the same event, big senior pro divisions, and a doubled purse coming in 2027.", "blocks": [
            {"type": "schedule", "rows": [r for r in AHEAD if r["event"].startswith("APP")]},
            {"type": "facts", "items": [
                F("APP Next (23 and under) stops: Overland Park Oct 23–25, Allen TX Nov 20–22, Fort Lauderdale Dec 11–13.", "https://www.theapp.global/tour?upcoming_category_equal=APP+Tour"),
                F("Broadcast: ESPN+ and ESPN2 windows on championship days; every court on APPTV.", "https://www.theapp.global/news/sunday-broadcast-overland-park-2026"),
            ]},
            {"heading": "Where to watch", "type": "links", "items": [L("APPTV on YouTube", "https://www.youtube.com/@TheAPPTour", "Livestreams and replays.", "youtube")]},
        ]},
        {"id": "rankings", "short": "Rankings", "title": "Who's on top", "dek": "The PPA's world ranking (WPR) blends singles, gender doubles and mixed. Read Sept 22, 2026; the discipline lists are pickleball.com's current seeds for the week of Sept 21.", "blocks": [
            ranks("Men · world ranking", RANK_SRC, [("Ben Johns", "17,832.5"), ("Gabriel Tardio", "13,291.3"), ("Christian Alshon", "11,827.5"), ("Federico Staksrud", "10,797.5"), ("Hayden Patriquin", "10,392.5")]),
            ranks("Women · world ranking", RANK_SRC, [("Anna Leigh Waters", "20,710"), ("Anna Bright", "15,655"), ("Jorja Johnson", "10,672.5"), ("Tyra Hurricane Black", "9,530"), ("Parris Todd", "8,822.5")]),
            ranks("Men's doubles", PB + "5", [("Gabriel Tardio", "21,300"), ("Ben Johns", "20,700"), ("Andrei Daescu", "14,200"), ("Christian Alshon", "14,000"), ("Federico Staksrud", "13,200")]),
            ranks("Women's doubles", PB + "4", [("Anna Leigh Waters", "22,100"), ("Anna Bright", "21,300"), ("Tyra Hurricane Black", "14,300"), ("Parris Todd", "13,100"), ("Rachel Rohrabacher", "12,300")]),
            ranks("Men's singles", PB + "2", [("Christopher Haworth", "16,100"), ("Federico Staksrud", "14,450"), ("Hunter Johnson", "11,275"), ("Christian Alshon", "6,750"), ("Roscoe Bellamy", "5,850")]),
            ranks("Women's singles", PB + "1", [("Anna Leigh Waters", "17,500"), ("Kate Fahey", "14,700"), ("Kaitlyn Christian", "13,100"), ("Brooke Buckner", "10,450"), ("Lea Jansen", "7,650")]),
            ranks("Women's mixed", PB + "3", [("Anna Leigh Waters", "20,100"), ("Anna Bright", "14,300"), ("Jorja Johnson", "12,500"), ("Rachel Rohrabacher", "7,400"), ("Tyra Hurricane Black", "6,800")]),
            {"type": "note", "text": "Men's mixed seeds couldn't be read on the day, so they're left out rather than guessed."},
        ]},
        {"id": "money", "short": "The money", "title": "The money and the politics", "dek": "Contracts, prize money, draft prices, and the rulebook split.", "blocks": [
            {"type": "facts", "items": MONEY},
            {"heading": "Who runs what", "type": "facts", "items": GOVERNANCE},
        ]},
    ],
}
# the teams block wants names only
for c in pros["chapters"]:
    for b in c["blocks"]:
        if b.get("heading") == "The 20 teams":
            b["items"] = [{"big": t, "small": ""} for t in MLP_TEAMS]

for name, data in (("guide.json", guide), ("pros.json", pros)):
    (OUT / name).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    print(name, sum(len(b.get("items", b.get("rows", []))) for c in data["chapters"] for b in c["blocks"]), "entries")
