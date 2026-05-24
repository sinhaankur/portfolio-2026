/**
 * Star Cleaver: Narrative + Story Context
 * The aliens are here. The fleet flies with you. Seven worlds.
 */

export interface WorldStory {
  id: string;
  name: string;
  number: number; // 1-7
  briefing: string; // short mission briefing
  story: string; // long-form narrative
  significance: string; // why this world matters
  threatLevel: 'critical' | 'high' | 'moderate';
  flavor: string; // atmospheric flavor text
  commanderMessage?: string; // optional command center message
}

export const WORLD_STORIES: WorldStory[] = [
  {
    id: 'earth',
    name: 'Earth',
    number: 1,
    briefing: 'Home. We stand our ground.',
    story:
      'The first wave arrived over the Pacific. No warning. No contact attempts. Just destruction. Earth orbits fill with wreckage. ' +
      'The Cleaver came online just in time. Now we hold the line. Our home will not fall.',
    significance: 'Humanity\'s cradle. Lose this and the war is over.',
    threatLevel: 'critical',
    flavor: 'DEFENDING HOME. ALL SYSTEMS STAND.',
    commanderMessage: 'All wings, this is Command. Earth shields are at critical. No retreat. No surrender.',
  },
  {
    id: 'mars',
    name: 'Mars',
    number: 2,
    briefing: 'Where we found it. Where it all began.',
    story:
      'The excavation team found the Cleaver buried 3 kilometers beneath Valles Marineris. ' +
      'Ancient beyond measure. No blueprints, no manual. Just dormant systems that responded to human contact. ' +
      'Two weeks later, the aliens arrived. Coincidence? We cannot afford to assume.',
    significance: 'Strategic crossroads. If Mars falls, Earth is flanked.',
    threatLevel: 'critical',
    flavor: 'ORIGINS UNDER FIRE. HOLD THE RUINS.',
    commanderMessage: 'We may never know who built the Cleaver, but we know why we need it. Mars must hold.',
  },
  {
    id: 'venus',
    name: 'Venus',
    number: 3,
    briefing: 'Scorched but strategic. Cannot fall.',
    story:
      'Venus was hell before the aliens arrived. Now it\'s a fortress. The extreme conditions make it nearly impenetrable. ' +
      'If we lose it, the aliens establish a supply depot in the inner system. We cannot allow it.',
    significance: 'Inner system anchor. Denies enemy resupply.',
    threatLevel: 'high',
    flavor: 'INFERNO DEFENSE. HOLD THE PERIMETER.',
  },
  {
    id: 'mercury',
    name: 'Mercury',
    number: 4,
    briefing: 'Small but vital. The key to the inner system.',
    story:
      'Mercury is a dark, lifeless rock, but it controls the inner solar system trade routes. ' +
      'The Cleaver can rain hellfire from here across the entire inner system. ' +
      'The aliens know this. They will not stop coming.',
    significance: 'Orbital artillery platform. Controls inner system.',
    threatLevel: 'high',
    flavor: 'SCORCHED STONE. HOLD AT ALL COSTS.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    number: 5,
    briefing: 'Gas giant. Ancient. Powerful.',
    story:
      'Jupiter\'s moons were humanity\'s outer frontier. Mining colonies, research stations, defensive platforms. ' +
      'The gas giant itself is a weapon—its magnetosphere, its storms, its sheer gravity. ' +
      'The aliens fear this world. Do not let them take it.',
    significance: 'Outer system anchor. Controls the gas giants.',
    threatLevel: 'moderate',
    flavor: 'ANCIENT GIANT STANDS. DEFEND THE MOONS.',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    number: 6,
    briefing: 'Rings of ice and stone. The line in the sand.',
    story:
      'Saturn\'s rings provide natural cover—asteroid fields, ice shields, gravitational anomalies. ' +
      'This is where we make our stand. Beyond this point, the outer colonies fall. ' +
      'Saturn is the line. We do not retreat past Saturn.',
    significance: 'Outer system bastion. Beyond here lies only void.',
    threatLevel: 'moderate',
    flavor: 'FROZEN FORTRESS. THE LINE HOLDS HERE.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    number: 7,
    briefing: 'The edge of known space. The final world.',
    story:
      'Neptune is distant, cold, and nearly forgotten by the inner system. But it is ours. ' +
      'If we hold all seven worlds, we control the solar system. If Neptune falls, we lose everything. ' +
      'This is the final battle. This is where humanity stands or falls.',
    significance: 'The final frontier. Lose this and we lose everything.',
    threatLevel: 'critical',
    flavor: 'EDGE OF THE ABYSS. THIS IS THE LINE.',
    commanderMessage:
      'Command to all forces. Neptune is the last. If this world falls, so does humanity. ' +
      'Defend. Endure. Victory will not be easy. But it will be ours.',
  },
];

export const OPENING_NARRATIVE = `
THE CLEAVER

We found it in the ruins beneath Mars.
Three kilometers down. Buried for millennia.
No one built it. No one we know.

It responded to us. Ancient systems, still alive.
We did not understand. We still do not.

But we know it works.

The aliens came two weeks later.
They came without warning.
Without mercy.

Now it flies.
The weapon. The Cleaver.
In your hands.

Seven worlds remain.
All that separates them from oblivion is you.

The fleet flies with you.
The fate of humanity rests with you.

We do not know who built the Cleaver.
We do not know why it was left for us to find.

All we know is that without it, we are lost.

FLY.
DEFEND.
SURVIVE.

Seven worlds.
One weapon.
One pilot.

The Cleaver awaits.
`;

export const COMMAND_CENTER_STATUS = {
  ready: 'All systems nominal. Ready to deploy.',
  defending: 'Shields up. Standing by for next wave.',
  victory: 'World secured. Fleet standing by.',
  defeated: 'Defensive grid failing. Evacuation in progress.',
};

export function getWorldStory(worldIndex: number): WorldStory {
  return WORLD_STORIES[worldIndex] || WORLD_STORIES[0];
}

export function getWorldBriefing(worldIndex: number, wave: number): string {
  const world = getWorldStory(worldIndex);
  return `${world.briefing}\n\nWave ${wave} incoming. Prepare defensive systems.`;
}
