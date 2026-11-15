# Image-generation brief — the GNN news anchor

> **Status:** seven poses in use (`assets/art/gnn/gnn-anchor-<pose>.webp`, normalised onto one 1760x1536 canvas so her face keeps
> its size and place; the wide canvas leaves room for the presenting gesture): neutral (title, diplomacy, council), serious (losses,
> war, disasters, deep-space threats), encouraging (colonies, science, the economy), breaking (breaking news, leaning in to the camera), urgent (alerts: monsters, raids, novas, the Guardian), presenting (charts and
> the rankings, a hand toward the video wall) and wry (galaxy life, espionage). New poses: same framing, lighting and transparent
> background, hands above the bottom 15%.

One recurring presenter for the Galactic News Network screen (`js/ui/gnn.js`), in three expressions. The game composites the
anchor into the existing studio photo (`assets/art/gnn/race-neutral-gnn-studio-background.webp`) between the starfield window and
the video wall, and draws the studio desk in front of the anchor's lower body. So the anchor is delivered **on its own**, not in a
studio, and the three expressions must line up pixel for pixel.

## The character

A neutral presenter: GNN is the one voice every empire trusts, so the anchor belongs to **none of the ten playable races**. They
are a member of an invented, non-playable species, the **Veyl**, a quiet people of professional translators and archivists who
have reported the galaxy's news for centuries.

- **Build:** humanoid and slender, with long neck and shoulders; reads as calm, intelligent and composed. Clearly alien but with a
  readable face, because the expressions carry the story.
- **Face:** smooth, matte blue-grey skin; a high, elegant cranial crest sweeping back over the skull instead of hair; large dark
  eyes with a faint silver ring (large but natural, not cartoon-big); a narrow nose ridge; thin expressive lips. Two fine lines of
  faint cyan bioluminescent freckles run along the cheekbones and down the side of the neck.
- **Dress:** a tailored deep-indigo high-collar presenter's jacket with a thin worn-brass hairline trim along the collar and lapel
  seam. Small circular brass lapel pin of a ringed planet (no letters). Slight sheen, impeccable but not flashy.
- **Manner:** a seasoned anchor, trustworthy and dryly witty. Never a mascot.

## Technical requirements (the same for all three images)

- **Size:** portrait 2:3, **1024 × 1536 or larger** (1536 × 2304 ideal). PNG.
- **Background:** **transparent** if your generator supports it. Otherwise a perfectly **flat, solid, very dark navy (#0B0F24)**:
  no gradient, no studio, no props, no floor, no vignette, so the game can cut the figure out cleanly.
- **Framing:** a medium shot from about **mid-chest up**. The head's top sits ~8% below the top edge and the figure is centred
  horizontally, with even margin left and right. Arms rest at the sides and the **hands are out of frame** (the game's desk covers
  the bottom ~15%, so keep nothing important there).
- **Pose and camera:** camera straight on at eye level. Shoulders turned about 15° toward the **viewer's right** (where the
  video wall is); head and eyes face the camera, addressing the viewer.
- **Lighting (must match the studio):** soft ivory softbox key light from the **upper left**, a cool cyan-blue rim light on the
  right edge of the head and shoulders, low warm brass bounce from below. Deep but readable shadows, no blown highlights.
- **Style:** cinematic, photorealistic, grounded hard sci-fi, 85 mm lens, subtle film grain, muted filmic grade.
- **No** text, letters, logos, microphone, desk, chair, hands, or other characters.

## Prompt 1 — neutral (make this first)

> Cinematic photorealistic portrait of an original alien news anchor for a hard science-fiction strategy game, the trusted
> presenter of the Galactic News Network. A member of an invented non-playable species: slender humanoid with a long neck, smooth
> matte blue-grey skin, a high elegant cranial crest sweeping back over the skull instead of hair, large dark eyes with a faint
> silver ring (natural proportions, not cartoonish), narrow nose ridge, thin expressive lips, two fine lines of faint cyan
> bioluminescent freckles along the cheekbones and down the side of the neck. Wearing a tailored deep-indigo high-collar
> presenter's jacket with a thin worn-brass hairline trim and a small round brass ringed-planet lapel pin. Calm, composed,
> professional expression with the faintest hint of dry wit: a seasoned anchor about to read the evening news. Medium shot from
> mid-chest up, figure centred, top of head about 8% below the top edge, arms at sides with hands out of frame. Camera straight on
> at eye level; shoulders turned about 15 degrees toward the viewer's right, head and eyes facing the camera. Soft ivory softbox
> key light from the upper left, cool cyan-blue rim light on the right edge of head and shoulders, subtle warm brass bounce from
> below, deep readable shadows. 85 mm lens, shallow depth of field, subtle film grain, muted filmic colour grade. Isolated on a
> transparent background (or a perfectly flat solid very dark navy #0B0F24 background with no gradient). Portrait 2:3, 1536×2304.
> No text, no logo, no microphone, no desk, no chair, no hands, no other characters.

## Prompts 2 and 3 — expressions (edit the neutral image)

Use the **neutral image as the reference / input image** in edit mode, so the face, crest, clothing, pose, framing, lighting and
background stay identical. Change **only the expression**:

> **Grave** (wars, disasters, defeats): Keep everything identical: same character, clothing, pose, framing, camera, lighting and
> background. Change only the facial expression to grave and solemn: brows drawn slightly together and lowered, eyes steady and
> serious, lips pressed into a firm line, the cheek bioluminescence dimmed. Delivering sombre news with dignity.

> **Pleased** (new colonies, treaties, discoveries, booms): Keep everything identical: same character, clothing, pose, framing,
> camera, lighting and background. Change only the facial expression to quietly pleased: a warm, restrained closed-mouth smile,
> eyes softened and slightly crinkled, brows relaxed and lifted a little, the cheek bioluminescence a touch brighter. Sharing good
> news, professional, not grinning.

## Negative prompt (if your generator has one)

cartoon, anime, cel shading, illustration, comic, toy, plastic, waxy skin, uncanny valley, mascot, cute, chibi, oversized eyes,
human, hair, ears, fur, scales, horns, armour, helmet, microphone, headset, desk, chair, hands, fingers, text, letters, logo,
watermark, signature, caption, border, frame, studio background, gradient background, vignette, extra limbs, deformed face,
rainbow colours, oversaturated, blown highlights

## Delivery

Three files, the same size, the figure in exactly the same place in each:

- `gnn-anchor-neutral.png`
- `gnn-anchor-grave.png`
- `gnn-anchor-pleased.png`

Add them to the session (or the repository root). The game will convert them to WebP in `assets/art/gnn/`, cut out the
background if it is not transparent, feather the edges, and frame them for desktop, phone portrait and phone sideways. The race
portraits stay as the fallback.
