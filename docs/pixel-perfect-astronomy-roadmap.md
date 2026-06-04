# Pixel-Perfect Astronomy Roadmap

This list covers the named galaxies and bright stars currently present in the universe engine catalog. The goal is to make each object feel as close as possible to real published imagery and known morphology, while keeping the scene performant and readable.

## Priority Order

1. Objects with the most recognizable real imagery.
2. Objects with strongly documented morphology.
3. Compact objects that benefit from layered structure and color accuracy.
4. Extremely distant or faint objects that should stay restrained but still physically plausible.

## Galaxies

1. Andromeda Galaxy (M31)
- Canonical target for realism.
- Key cues: extended stellar halo, bright nucleus, inner bar, tilted disc, dust lanes, companion galaxies.
- Best reference style: Hubble, JWST, and deep amateur wide-field composites.

2. Triangulum Galaxy (M33)
- Open, clumpy spiral with loose arms and prominent H II regions.
- Key cues: lower bulge prominence, patchy star-forming knots, airy disc structure.

3. Large Magellanic Cloud (LMC)
- Irregular satellite galaxy with a broken spiral feel.
- Key cues: asymmetric bar, patchy nebula-rich structure, uneven outer envelope.

4. Small Magellanic Cloud (SMC)
- Dwarf irregular with a more disturbed profile.
- Key cues: compact core, diffuse envelope, less symmetry than the LMC.

5. GN-z11
- Extremely distant, very compact, and faint.
- Key cues: tiny high-redshift blob, restrained size, no overdrawn structure.

6. Stephan's Quintet
- Compact interacting group.
- Key cues: multiple distinct members, tidal interaction language, group-scale composition.

7. NGC 1300
- Barred spiral exemplar.
- Key cues: strong central bar, defined arms, balanced spiral geometry.

8. Cartwheel Galaxy
- Ring galaxy formed by collision.
- Key cues: bright star-forming ring, sparse central region, obvious impact-driven structure.

9. Sombrero Galaxy (M104)
- Edge-on spiral with a dominant dust lane.
- Key cues: bright bulge, razor dust band, hat-like silhouette.

10. Whirlpool Galaxy (M51)
- Textbook interacting spiral.
- Key cues: clean arm structure, companion tugging on the main disc, high-contrast spiral pattern.

## Bright Stars

1. Sirius
- Brightest night-sky star.
- Key cues: blue-white A-type colour, crisp point source, subtle companion context.

2. Betelgeuse
- Red supergiant with strong variability.
- Key cues: warm red-orange colour, slightly irregular presence, oversized apparent brightness.

3. Rigel
- Blue supergiant.
- Key cues: cool blue-white glow, high contrast, less saturated than Sirius.

4. Vega
- Photometric reference star.
- Key cues: clean white tone, balanced halo, very stable presentation.

5. Antares
- Deep red supergiant.
- Key cues: orange-red saturation, soft giant-like aura, strong contrast with nearby cooler stars.

6. Aldebaran
- Orange giant.
- Key cues: amber colour, gentle bloom, slightly warmer than Sirius/Vega.

7. VY Canis Majoris
- Extreme red hypergiant.
- Key cues: deep red tone, visually heavy glow, but still physically restrained.

8. Eta Carinae
- Luminous blue variable.
- Key cues: blue-white core with subtle bipolar energy language, avoiding overexposed bloom.

## Refinement Rules

- Match shape first, then colour, then brightness.
- Use real-world image cues for each object instead of a generic spiral or star shader.
- Keep each object identifiable at a glance when hovered.
- Avoid over-blooming faint objects just to make them feel dramatic.
- Prefer layered geometry and texture variation over bigger particle counts.
- Preserve performance by keeping the most detailed treatment for the currently focused object.

## Next Pass Suggestions

- Add object-specific morphology controls for galaxies in `components/universe-engine/scene.tsx`.
- Add star-class-specific bloom and halo rules for bright stars in the same scene.
- Attach real image-reference notes to each catalog entry for later visual tuning.
