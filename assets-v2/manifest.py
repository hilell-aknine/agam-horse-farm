# -*- coding: utf-8 -*-
"""מניפסט נכסי החווה: לכל קובץ, הנושא הוויזואלי שלו.
הסגנון נעול ב-STYLE-BIBLE.md ולא חוזר כאן."""

OPAQUE = "opaque"  # אייקוני אפליקציה, לא ספרייט שקוף

HORSE = "a cute cartoon {c} horse standing, full body side-on with the head turned to the viewer, big friendly eyes, small smile."
FOAL  = "a cute cartoon {c} foal, a baby horse with a large head and short legs, standing, big friendly eyes, small smile."

HORSE_COLORS = {
    "black":   "black with a charcoal mane",
    "brown":   "warm chestnut brown with a dark brown mane",
    "golden":  "golden palomino with a cream mane",
    "gray":    "soft dapple grey with a silver mane",
    "pink":    "pastel pink with a magenta mane",
    "spotted": "white with brown patches and a brown mane",
    "white":   "pure white with a cream mane",
    "rainbow": "white with a mane and tail in soft rainbow stripes",
    "unicorn": "white with a lilac mane and a single golden spiral horn on its forehead",
}

ASSETS = {}
for c, desc in HORSE_COLORS.items():
    ASSETS[f"horse_{c}"] = HORSE.format(c=desc)
    if c != "rainbow":
        ASSETS[f"foal_{c}"] = FOAL.format(c=desc)

ASSETS.update({
    "horse_run":   "a cute cartoon chestnut brown horse galloping, side view, all four legs off the ground, mane and tail streaming backwards.",
    "horse_jump":  "a cute cartoon chestnut brown horse leaping upward over an unseen obstacle, side view, front legs tucked, tail lifted.",
    "horse_sleep": "a cute cartoon chestnut brown horse lying down asleep, curled with its legs folded under it, eyes closed as two happy curved lines.",
    "pony":        "a cute cartoon stocky little pony with short legs and a thick cream mane, standing, big friendly eyes.",
    # תוספות שהגיעו מג'מיני
    "_gemini_extra/goat_alt":            "a cute cartoon white goat with small curved horns and a little beard, standing, big friendly eyes.",
    "_gemini_extra/horse_sleep_palomino":"a cute cartoon golden palomino horse lying down asleep, curled with its legs folded under it, eyes closed as two happy curved lines.",
    "_gemini_extra/pony_spotted":        "a cute cartoon stocky little pony, white with brown patches and a thick brown mane, standing, big friendly eyes.",
})

# ---------- חיות משק ונוף ----------
ASSETS.update({
    "cow":       "a cute cartoon cow, white with black patches, standing, big friendly eyes, small pink udder.",
    "sheep":     "a cute cartoon sheep with a fluffy cream wool body and a dark face, standing, big friendly eyes.",
    "goat":      "a cute cartoon brown goat with small curved horns and a little beard, standing, big friendly eyes.",
    "pig":       "a cute cartoon pink pig with a round snout and a curly tail, standing, big friendly eyes.",
    "chicken":   "a cute cartoon white hen with a red comb, standing, big friendly eyes.",
    "duck":      "a cute cartoon yellow duck with an orange bill, standing, big friendly eyes.",
    "turkey":    "a cute cartoon turkey with a brown body and a fanned tail, standing, big friendly eyes.",
    "peacock":   "a cute cartoon peacock with a blue body and a fully fanned tail of teal and green feather eyes, standing.",
    "dog":       "a cute cartoon golden puppy sitting, floppy ears, tongue out, big friendly eyes.",
    "cat":       "a cute cartoon orange tabby kitten sitting, tail curled around its paws, big friendly eyes.",
    "rabbit":    "a cute cartoon white rabbit sitting, long ears upright, big friendly eyes.",
    "fox":       "a cute cartoon orange fox sitting, bushy white-tipped tail, big friendly eyes.",
    "deer":      "a cute cartoon light brown fawn with white spots standing, small antlers, big friendly eyes.",
    "penguin":   "a cute cartoon small penguin standing, orange beak and feet, big friendly eyes.",
    "butterfly": "a cute cartoon butterfly with symmetrical pastel pink and blue wings, seen from directly above.",
})

# ---------- דמויות ----------
ASSETS.update({
    "npc_baker":  "a cute cartoon friendly baker character, a smiling woman in a white apron and chef hat holding a tray of bread, full body, simple rounded proportions.",
    "npc_vet":    "a cute cartoon friendly veterinarian character, a smiling woman in a light blue coat holding a small medical bag, full body, simple rounded proportions.",
    "shopkeeper": "a cute cartoon friendly shopkeeper character, a smiling man in dungarees and a straw hat waving, full body, simple rounded proportions.",
})

# ---------- מבנים ----------
ASSETS.update({
    "barn":      "a classic red farm barn with a cream gambrel roof and white double doors, seen straight on.",
    "barn_big":  "a large red farm barn with a cream gambrel roof, white double doors and a hayloft window, wider and taller than a small barn, seen straight on.",
    "cottage":   "a small cosy cottage with cream walls, a red tiled roof, a wooden door and two shuttered windows, seen straight on.",
    "bakery":    "a small village bakery shop with cream walls, a striped awning and a bread-shaped hanging sign with no letters on it, seen straight on.",
    "silo":      "a tall cylindrical farm grain silo, light grey with a domed metal roof, seen straight on.",
    "windmill":  "a farm windmill with a white tower and four wooden sails, seen straight on.",
    "well":      "a round stone wishing well with a small wooden roof and a bucket on a rope.",
    "doghouse":  "a small wooden dog kennel with a red roof and a round entrance hole, seen straight on.",
    "farm_gate": "a wooden farm gate with two posts and a crossbeam, closed, seen straight on.",
    "cave":      "a small rocky cave entrance in a grey stone mound, dark opening, seen straight on.",
    "fountain":  "a small round stone garden fountain with water arcing from its centre tier.",
})

# ---------- צמחייה ונוף ----------
ASSETS.update({
    "tree":         "a rounded leafy green tree with a brown trunk.",
    "oak_tree":     "a broad oak tree with a thick brown trunk and a wide rounded canopy of green leaves.",
    "pine_tree":    "a tall conical pine tree, dark green, with a short brown trunk.",
    "bush":         "a small rounded green bush.",
    "flower_bush":  "a small rounded green bush dotted with little pink and yellow flowers.",
    "flowers_wild": "a small cluster of wild flowers, pink, yellow and white, on green stems.",
    "grass_tuft":   "a small tuft of green grass blades.",
    "mushroom":     "a single cartoon mushroom with a red cap, white spots and a cream stem.",
    "pond":         "a small oval pond of blue water with a green grassy rim, seen from a high angle.",
    "rock":         "a single rounded grey boulder.",
    "rainbow":      "a clean semicircular rainbow arc in the classic colour order.",
    "cloud":        "a single fluffy white cartoon cloud.",
})

# ---------- יבולים ומזון ----------
ASSETS.update({
    "apple":      "a single shiny red apple with a green leaf on its stem.",
    "carrot":     "a single orange carrot with a green leafy top.",
    "corn":       "a single ear of yellow corn with its green husk partly peeled back.",
    "wheat":      "a small bundle of golden wheat stalks tied with twine.",
    "strawberry": "a single red strawberry with a green leafy top.",
    "pumpkin":    "a single round orange pumpkin with a short green stem.",
})

# ---------- ציוד וחפצים ----------
ASSETS.update({
    "saddle":       "a brown leather riding saddle seen from a three-quarter angle.",
    "brush":        "a wooden horse grooming brush with cream bristles.",
    "water_bucket": "a metal bucket filled with blue water.",
    "watering_can": "a green metal watering can with a spout and handle.",
    "trough":       "a wooden farm trough filled with blue water.",
    "feed_sack":    "an open cream sack of animal feed with grain spilling over its rim.",
    "hay_bale":     "a golden cylindrical hay bale bound with twine.",
    "horseshoe":    "a single silver horseshoe with nail holes, seen straight on, open end downward.",
    "coin":         "a single shiny gold coin seen straight on, blank face with a plain raised rim.",
    "gem":          "a single faceted pink gemstone, cut diamond shape, sparkling.",
    "trophy":       "a golden two-handled trophy cup on a small base.",
    "balloons":     "a small bunch of three party balloons, red, yellow and blue, with their strings tied together.",
    "bench":        "a wooden park bench with a backrest, seen from a three-quarter angle.",
    "lamp_post":    "a black cast-iron lamp post with a glowing warm lantern at the top.",
    "signpost":     "a wooden signpost with a single blank arrow-shaped board and no letters on it.",
    "scarecrow":    "a friendly cartoon scarecrow on a wooden post, straw hat, patched shirt, stitched smile.",
    "weathervane":  "a rooster-shaped weathervane on a metal rod with the four direction arms, no letters on it.",
    "cone":         "a single orange and white traffic training cone.",
})

# ---------- מסך ואייקונים ----------
ASSETS.update({
    "title_farm": "a wide cheerful farm scene banner: a red barn on the left, a green rolling hill, a cute brown horse standing on the right, a blue sky with two fluffy clouds. Wide horizontal composition. This one asset may contain several objects.",
    "icon-512": ("a rounded square app icon: a cute cartoon brown horse head facing the viewer, centred on a warm sunny yellow background with a soft green hill behind it.", OPAQUE),
    "icon-192": ("a rounded square app icon: a cute cartoon brown horse head facing the viewer, centred on a warm sunny yellow background with a soft green hill behind it.", OPAQUE),
    "icon-180": ("a rounded square app icon: a cute cartoon brown horse head facing the viewer, centred on a warm sunny yellow background with a soft green hill behind it.", OPAQUE),
})
