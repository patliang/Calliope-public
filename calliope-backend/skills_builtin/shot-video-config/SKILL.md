---
name: shot-video-config
description: "Use when configuring every shot/clip in a project with the correct reference assets, MiniMaxH3-Singularity-Continuity workflow, and chain-start flags. Selects the right workflow by reference count, pins character/location images to input slots, and marks scene boundaries as new chains."
version: 1.0.0
license: MIT
metadata:
  author: Calliope
  tags: [video, shots, clips, minimax-h3, singularity-continuity, references, workflow, chain]
  related_skills: [scene-to-video, h3-video-prompt-enhancer, character-consistency]
---

# Shot Video Config

## Overview

Batch-configure every clip in a project so each shot has:
1. The **correct reference assets** (character sheets + location image) pinned to its `(Input:image)` slots
2. The **correct workflow** from the MiniMaxH3-Singularity-Continuity family, matched to the number of references
3. The **`chain_start` flag** set at scene/location boundaries so the latent chain breaks where the story cuts

This skill is the planning + execution layer. It reads the project's scenes, clips,
characters, and locations, then applies the configuration to every clip.

## When to Use

- The user asks to "configure all shots", "set up references for every clip",
  "pick the right workflow per shot", or "prepare the project for rendering"
- A new project has been broken into shots and needs batch workflow assignment
- The user wants Singularity-Continuity workflows applied across the timeline
- Chain boundaries need to be marked at scene transitions

## Step 1 — Gather Project Data

Collect everything in one pass before touching any clip:

1. **`list_assets`** — compact asset inventory: every character, location,
   and item with `{id, name, path}`. The `path` is the image file to pin
   into `input_values`. **Use this, NOT `get_workspace`** — the full
   workspace payload is truncated at 4000 chars and the asset paths get cut
   off, which is the #1 cause of missing references.
2. **`list_scenes` with `compact: true`** — one call returns every scene as
   `{id, order, location_id, character_ids, clip_ids}`. This is the ONLY way
   to see all 84+ scenes in a single tool result. Do NOT page through
   `list_scenes` without `compact` — each full call is truncated and you will
   burn your context on 17+ calls before you ever configure a clip.
3. **`list_workflows`** — all available workflows. Each entry has an
   **`image_node_ids`** array (the `kind: "image"` node IDs, pre-extracted)
   and an `inputs` array with `{nodeId, kind, label}` per slot. Identify the
   **Singularity-Continuity** family by name pattern:
   `MiniMaxH3-Singularity-Continuity-{N}Ref1Latent-API` where N ∈ {1, 2, 3, 4, 5}.
   **Save the `image_node_ids` arrays** — those are the exact keys for
   `input_values` in Step 3.

> **Do not skip this step.** Every decision below depends on the actual
> character count per scene and the location image path.
>
> **⚠️ If `list_assets` returns a path of `null` for an asset, that asset
> has no image yet — skip it in the reference mapping (and reduce
> `ref_count` accordingly).**

## Step 2 — Per-Clip Decision Logic

For **each clip** in **each scene**, compute three values:

### 2a. Reference Count → Workflow Selection

Count the references this shot needs:

```
ref_count = (number of characters in the scene) + (1 if the scene has a location image)
```

- Characters come from the scene's `scene_characters` join (scene order).
- The location contributes **one** reference image (its `reference_image_path`).
- **Cap at 5.** If `ref_count > 5`, keep the first 4 characters + location
  (drop the lowest-priority character, i.e. the last one in scene order).

Select the workflow by `ref_count`:

| ref_count | Workflow name |
|-----------|---------------|
| 1 | `MiniMaxH3-Singularity-Continuity-1Ref1Latent-API` |
| 2 | `MiniMaxH3-Singularity-Continuity-2Ref1Latent-API` |
| 3 | `MiniMaxH3-Singularity-Continuity-3Ref1Latent-API` |
| 4 | `MiniMaxH3-Singularity-Continuity-4Ref1Latent-API` |
| 5 | `MiniMaxH3-Singularity-Continuity-5Ref1Latent-API` |

> **Why Singularity-Continuity?** These workflows have an `(Input:video)` latent
> slot that carries the previous clip's AV latent forward, giving frame-accurate
> continuity. The plain `video_minimax_h3_r2v_{N}ref_API` workflows lack the
> latent slot and are for standalone (non-chained) shots.

> **If no Singularity-Continuity workflow matches** (e.g. 0 refs), fall back to
> the plain `video_minimax_h3_r2v_{N}ref_API` family. If the scene has no
> characters and no location, use the 1-ref workflow with just the location
> or a generic reference.

### 2b. Chain Start Flag

Set `chain_start = true` when the clip is the **first in a new visual context**:

- **First clip of the project** (no previous clip exists) → `chain_start = true`
- **Scene change**: the previous clip belongs to a different scene → `chain_start = true`
- **Location change within a scene**: the clip's `location_id` differs from the
  previous clip's → `chain_start = true`
- **All other clips** (same scene, same location, continuous action) → `chain_start = false` (or omit)

> The chain mechanism (`queue/chain.py`) uses `chain_start` to decide whether
> to load the previous clip's latent. When `chain_start` is true, the latent
> slot is left empty and the shot starts fresh. When false, the worker
> auto-wires the previous clip's saved latent into the `(Input:video)` slot.

### 2c. Reference Asset Mapping

Map assets to `(Input:image)` slots **in node-id order** (lowest node id =
`<Subject 1>`):

1. **Characters first**, in scene order (the order they appear in
   `scene_characters`). Each character's `path` (from `list_assets`) goes
   into the next slot.
2. **Location last**, if the scene has a `location_id` with a non-null
   `path` (from `list_assets`).

Example: scene with characters [Xiao Bao, General Brick] + location "Brick Palace":
- Slot 1 (lowest node id) → Xiao Bao's `sheet_path`
- Slot 2 → General Brick's `sheet_path`
- Slot 3 → Brick Palace's `reference_image_path`

> The `resolve_h3_references()` function in `video_agent.py` does this
> automatically at enqueue time if `input_values` are not explicitly set.
> Setting them explicitly in `video_settings.input_values` **pins** the
> mapping so it survives workflow changes and is visible in the UI form.

## Step 3 — Apply Configuration (ONE call per clip)

For **each clip**, make a **single `update_clip` call** that sets the
`workflow_id` **and** `video_settings` together. Do NOT split this into
separate calls — the references will be missing if you only set `workflow_id`.

```
update_clip(
  clip_id=<id>,
  workflow_id=<selected_workflow_id>,
  video_settings={
    "chain_start": <true|false>,
    "input_values": {
      "<node_id_1>": "<character_1_sheet_path>",
      "<node_id_2>": "<character_2_sheet_path>",
      ...
      "<node_id_N>": "<location_reference_image_path>"
    }
  }
)
```

**Every clip MUST get all three values in one call:**
- `workflow_id` — the Singularity-Continuity variant (see 2a)
- `video_settings.chain_start` — `true` at boundaries, `false` otherwise (see 2b)
- `video_settings.input_values` — the pinned reference paths (see 2c)

> **⚠️ Setting only `workflow_id` without `video_settings.input_values` means
> the shot has NO references pinned.** The auto-resolver will fill them at
> enqueue time, but the mapping won't be visible in the UI form and won't
> survive workflow changes. Always include `input_values`.

### Finding the node IDs for `input_values`

The `list_workflows` response includes an **`image_node_ids`** array for each
workflow — the pre-extracted `kind: "image"` node IDs. **Use these directly
as the keys for `input_values`.**

**CRITICAL: Only `kind: "image"` entries go into `input_values`.**
Do NOT include `kind: "number"`, `kind: "textarea"`, `kind: "text"`,
`kind: "video"`, or `kind: "latent"` entries. Those are form fields
(duration, FPS, prompt text, latent slot) — putting their values into
`input_values` is the #1 cause of broken references.

Example from a 2-ref workflow:
```json
{
  "id": 10,
  "name": "MiniMaxH3-Singularity-Continuity-2Ref1Latent-API",
  "image_node_ids": ["424", "425"],
  "inputs": [
    {"nodeId": "420", "kind": "textarea", "label": "Text Prompt"},
    {"nodeId": "421", "kind": "number", "label": "Duration"},
    {"nodeId": "422", "kind": "textarea", "label": "Megapixels"},
    {"nodeId": "423", "kind": "number", "label": "FPS"},
    {"nodeId": "424", "kind": "image", "label": "Ref 1"},
    {"nodeId": "425", "kind": "image", "label": "Ref 2"},
    {"nodeId": "429", "kind": "latent", "label": "Latent"}
  ]
}
```
→ `image_node_ids: ["424", "425"]` → **only these** go into `input_values`.

Correct `input_values` for a scene with [Xiao Bao, location]:
```json
{"424": "G:\\...\\CharSheet_00005_.png", "425": "G:\\...\\Assets_00001_.png"}
```

WRONG (includes form fields — this is the bug):
```json
{"421": 8, "422": ".98", "423": 24}
```

> **Node IDs vary between workflow variants.** The 1-ref, 2-ref, … 5-ref
> workflows each have different node IDs. Always read the specific workflow's
> `inputs` array before mapping. Do NOT guess node IDs.

### Batch Efficiency

- **Gather once, then execute.** Step 1 is exactly 3 tool calls
  (`list_assets`, `list_scenes` with `compact: true`, `list_workflows`).
  After that you have everything — do NOT call `list_scenes` again per
  scene. The #1 failure mode is paging through scenes and running out of
  context before configuring a single clip.
- Process clips **scene by scene**, in `order_index` order
- One `update_clip` call per clip — all three values in the same call
- Fire 10–20 `update_clip` calls per reasoning step; do not re-read data
  between batches
- **Verify** at the end (Step 4), not after every batch

## Step 4 — Verify

After configuring all clips:

1. **Spot-check 3–5 clips** across different scenes via `list_clips`:
   - `workflow_id` matches the expected Singularity-Continuity variant
   - `video_settings.chain_start` is `true` only at scene boundaries
   - `video_settings.input_values` maps the correct assets to the correct slots
2. **Check chain continuity**: for a mid-scene clip, confirm `chain_start` is
   `false` (or absent) so the latent chain flows.
3. **Report a summary** to the user:
   - Total clips configured
   - Workflow distribution (e.g. "12× 3Ref, 8× 4Ref, 3× 5Ref")
   - Chain breaks (e.g. "8 chain starts at scene boundaries")
   - Any clips that needed fallback (no matching workflow, missing asset paths)

## Workflow Reference Table

| Workflow name | Refs | Latent | Use when |
|---|---|---|---|
| `MiniMaxH3-Singularity-Continuity-1Ref1Latent-API` | 1 | ✅ | 1 char, no loc / 1 char + no loc |
| `MiniMaxH3-Singularity-Continuity-2Ref1Latent-API` | 2 | ✅ | 1 char + loc / 2 chars |
| `MiniMaxH3-Singularity-Continuity-3Ref1Latent-API` | 3 | ✅ | 2 chars + loc / 3 chars |
| `MiniMaxH3-Singularity-Continuity-4Ref1Latent-API` | 4 | ✅ | 3 chars + loc / 4 chars |
| `MiniMaxH3-Singularity-Continuity-5Ref1Latent-API` | 5 | ✅ | 4 chars + loc / 5 chars |
| `video_minimax_h3_r2v_API` | 1 | ❌ | Fallback: standalone 1-ref |
| `video_minimax_h3_r2v_2ref_API` | 2 | ❌ | Fallback: standalone 2-ref |
| `video_minimax_h3_r2v_3ref_API` | 3 | ❌ | Fallback: standalone 3-ref |
| `video_minimax_h3_r2v_4ref_API` | 4 | ❌ | Fallback: standalone 4-ref |
| `video_minimax_h3_r2v_5ref_API` | 5 | ❌ | Fallback: standalone 5-ref |

## Failure Handling

- **Missing asset path**: if a character or location has `path: null` in
  `list_assets`, skip that reference and reduce the ref count. Note it in
  the summary.
- **No matching workflow**: if the Singularity-Continuity family is not
  installed, fall back to the plain `video_minimax_h3_r2v_{N}ref_API` family
  and note that chaining will not work (no latent slot).
- **PATCH fails**: if `run_command` with `curl` fails (backend not running,
  wrong port), report the error and suggest the user configure via the UI
  (clip form → workflow dropdown + "Start a new chain here" checkbox).
- **Node ID mismatch**: if the workflow JSON's `(Input:image)` node IDs don't
  match the expected count, re-read the workflow JSON and re-map. The node IDs
  are workflow-specific and vary between the 1-ref and 5-ref variants.

## Example Walkthrough

Project with 3 scenes:

**Scene 1** — "Brick Palace Throne Room" (location: Brick Palace)
- Characters: [Xiao Bao, King Rock]
- Clips: #1.1, #1.2, #1.3

→ ref_count = 2 chars + 1 loc = **3** → `3Ref1Latent`
→ #1.1: `chain_start=true` (first clip), input_values: {slot1: Xiao Bao, slot2: King Rock, slot3: Brick Palace}
→ #1.2: `chain_start=false`, same input_values
→ #1.3: `chain_start=false`, same input_values

**Scene 2** — "Obsidian Fortress" (location: Obsidian Fortress)
- Characters: [Emperor Obsidian, General Brick]
- Clips: #2.1, #2.2

→ ref_count = 2 + 1 = **3** → `3Ref1Latent`
→ #2.1: `chain_start=true` (scene change), input_values: {slot1: Emperor Obsidian, slot2: General Brick, slot3: Obsidian Fortress}
→ #2.2: `chain_start=false`, same input_values

**Scene 3** — "Brick Palace Throne Room" (location: Brick Palace)
- Characters: [Xiao Bao, Princess Luna, King Rock]
- Clips: #3.1, #3.2

→ ref_count = 3 + 1 = **4** → `4Ref1Latent`
→ #3.1: `chain_start=true` (scene change), input_values: {slot1: Xiao Bao, slot2: Princess Luna, slot3: King Rock, slot4: Brick Palace}
→ #3.2: `chain_start=false`, same input_values

**Summary**: 7 clips configured · 3× 3Ref, 2× 4Ref · 3 chain starts · 0 fallbacks
