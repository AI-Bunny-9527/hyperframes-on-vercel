# Renderer incident mitigation and validation

This change is **not a verified fix for the V8 native crash**. The supplied stack
ends in `Runtime_RegExpExecMultiple` before the first completed frame. Neither a
heap increase nor fewer workers is proven to resolve it.

## Changes

- Pin the renderer to 0.8.127 in both fresh sandboxes and restored snapshots.
  This is the current registry release, not a demonstrated known-good release.
- Use one worker in both synchronous and detached paths (a containment measure;
  the reported incident already used one worker).
- Before stopping a failed detached sandbox, emit selected native diagnostics to
  Function logs with sandbox/command IDs. Do not persist narration, composition
  HTML, arbitrary logs or credentials in public Blob storage.
- Preserve a larger error tail for the authenticated caller's job database.
- Do not report a stopped sandbox as still running or automatically blame video
  length. Transient status lookup errors remain retryable by polling.

## Required release gate

1. Recover the failing generated composition and assets from the website's job
   database, together with the actual historical Node/renderer versions. Do not
   commit user content to this repository.
2. Replay the exact 73–85 second input in a non-production sandbox; compare against
   short representative inputs. Check first-frame progress, full completion,
   duration, captions, narration and background music.
3. If the crash persists, retain the complete log and composition privately and
   trace the renderer's JavaScript regexp caller; patch the actual operation or
   validate a different fixed release. Do not increase heap blindly.
4. Only deploy to production after the replay passes. This PR does not add global
   multi-user queueing or change the main website's credit ledger.

Production builds also run scripts/create-snapshot.ts, which creates cloud
resources. Local validation deliberately uses `next build` only.
