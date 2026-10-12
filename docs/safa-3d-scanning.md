# Turning a real safa into a 3D one

The virtual mirror can wear two kinds of safa. Today it wears a photograph
bent over a curve, which is convincing from the front and gives itself away
at a sharp angle. A **scanned** safa is a solid object: it has a real
silhouette from every side, and nothing about it is faked.

Scanning one costs nothing. You photograph a safa you already own, and this
Mac rebuilds it — Apple's own photogrammetry, built into every Apple Silicon
Mac. Nothing is uploaded; the safa never leaves the shop or the computer.

---

## What you need

- One safa, on a stand — a mannequin head is ideal, a bowl or a box will do.
- A phone camera. Any recent phone is plenty.
- A plain, **matte** background: a bedsheet on a wall, a tablecloth. Not glass,
  not a mirror, nothing shiny.
- Even, soft light. Two lamps either side, or open shade outdoors on a cloudy
  day. **No direct sun and no flash** — hard highlights are the single most
  common reason a scan comes out lumpy.

Pick the **least shiny safa first** for the trial. Heavy zari and metallic
thread are the hardest thing in photogrammetry: the sparkle moves as you move,
and the software cannot tell whether a bright speck is a thread or a
reflection. Velvet is next hardest. A brocade or chanderi safa in a flat
colour will come out best, and tells you whether the lighting is right before
you spend time on your best piece.

---

## Taking the photographs

Put the safa on the stand at about chest height, in the middle of the plain
background, with space all around it.

**Move around the safa. Do not turn the safa.** Turning it moves the shadows
with it, and the software reads that as the object changing shape.

Walk a full circle three times:

| Ring | Where you stand | Photos |
|---|---|---|
| 1 | Crouched, looking slightly **up** at it | ~20 |
| 2 | Standing, **level** with it | ~20 |
| 3 | Reaching up, looking **down** on it | ~20 |

That is about **60 photographs**. Fifty is enough; eighty is better than
forty. Each photo should overlap the one before it by most of the frame —
take a step, take a picture, take a step.

The third ring matters more than it sounds: a safa sits on a head, so the
mirror shows the top of it constantly. Get above it.

A few rules that decide whether it works:

- The whole safa in every frame, nothing cropped.
- Tap to focus once, then **lock focus and exposure** so every photo matches.
- Don't zoom. Walk closer or further instead.
- Keep your own shadow off it.
- If the kalgi or brooch is very glittery, take it off and scan it separately —
  it can be placed back on the model afterwards.

Put every photo into one folder, with nothing else in it.

---

## Making the model

Copy the folder onto the Mac, then run:

```bash
tools/safa-scan/scan.sh ~/Desktop/jodhpuri-photos jodhpuri
```

The second word is the name the safa gets. It takes a while — on this Mac
expect twenty minutes or so, and the fan will run.

It writes `public/models/jodhpuri.glb`.

This Mac has 8 GB of memory, so the script asks for `reduced` detail, which is
the right trade for something worn on a head at phone-screen size. For a
sharper model on a bigger machine:

```bash
tools/safa-scan/scan.sh ~/Desktop/jodhpuri-photos jodhpuri medium
```

---

## Putting it in the mirror

In `src/components/landing/SafaFittingStage.tsx`, add `model` to that safa:

```ts
{ id: 'jodhpuri', name: 'Jodhpuri Neel Zari', color: 'Royal Blue',
  src: '/tryon/safa-jodhpuri.webp', model: '/models/jodhpuri.glb',
  bookingStyle: 'Jodhpuri' },
```

That is the whole change. The mirror wears the scanned safa where it can, and
falls back to the photograph on a phone with no WebGL — so nobody is left
without a try-on either way.

---

## If it comes out badly

| What you see | What it usually is |
|---|---|
| Lumpy, melted-looking surface | Light was too hard, or the safa moved between shots |
| Holes in the top | Not enough photographs from above |
| A blob with the stand fused into it | Background too busy — use a plain sheet |
| Sparkly parts missing or spiky | Zari. Soften the light; or scan a plainer safa first |
| "Found 12 photographs" | They are in a sub-folder, or in a format the tool skipped |

A failed scan costs nothing but the time. Re-shoot with softer light before
changing anything else — it is nearly always the light.
