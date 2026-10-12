# Race art by text-to-image

`races.json` holds the shared style block, the negative prompt, and a detailed prompt per race (written from `js/data/races.js`:
description, traits and the race's UI colours). Three races so far: Silicoid, Mrrshan, Psilon.

## Ways to use it
* **Hosted tool** (Midjourney, an OpenAI/Google image model, Firefly, Flux via a web service): paste `style` + a race `prompt`, set the aspect
  to 3:4 (1024x1344), put `negative` in the negative-prompt box if the tool has one. Generate 4-8 candidates per race.
* **Your own GPU:** `python3 tools/art/generate.py --race all --n 4 --upscale` (needs `torch diffusers transformers accelerate`). Not run in
  the dev sandbox — its network policy blocks Hugging Face — so treat the script as untested until its first run.
* **Optional structural guides:** `python3 tools/render/<race>_model.py --guides DIR` renders depth / normal / line / mask / clay passes of the
  base models at card framing, for ControlNet-style tools that can lock pose and silhouette.

## After generation
Choose the best candidate per race, then upscale/clean, grade to the race palette, composite with `tools/render/race-card.js`
(it takes any portrait PNG), and export WebP/AVIF for the game. Keep the seed and prompt next to each chosen image.
