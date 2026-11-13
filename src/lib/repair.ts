// Step-by-step repair guides with a 3D scene per step. The procedures follow Valve's official iFixit
// guides for each model (linked from every guide); the 3D Deck is illustrative, not to scale.
//
// Part ids are the ones the 3D scene knows: back-screws, back-cover, microsd, foil-tape,
// shield-screws, shield, battery-cable, interconnect, ssd-screw, ssd, ssd-new, tstick-cable,
// tstick-screws, tstick-r, tstick-r-new, fan-sticker, fan-cable, fan-screws, fan, fan-new.
import type { DeckSceneState } from '../deck3d/parts';

export interface RepairStep {
  title: string;
  body: string;
  tools: string[];
  caution: string | null;
  remove: string[];
  highlight: string[];
  focusX: number;
  focusZ: number;
  zoom: number;
  label: string;
  view: string;
  show?: string[];
  restore?: string[];
  screen?: string[];
  reassemble?: boolean;
}

export interface RepairGuide {
  id: string;
  title: string;
  summary: string;
  icon: string;
  difficulty: string;
  time: string;
  buy: string;
  tools: string[];
  officialUrl: string;
  replaced: string[];
  fitted: string[];
  steps: RepairStep[];
}

interface StepOptions { view?: string; show?: string[]; restore?: string[]; screen?: string[]; reassemble?: boolean }

function step(title: string, body: string, tools: string[], caution: string | null, remove: string[], highlight: string[],
  focusX: number, focusZ: number, zoom: number, label: string, opts: StepOptions = {}): RepairStep {
  return { title, body, tools, caution, remove, highlight, focusX, focusZ, zoom, label, view: opts.view ?? 'back', ...opts };
}

function guide(id: string, title: string, summary: string, icon: string, difficulty: string, time: string, buy: string,
  tools: string[], officialUrl: string, replaced: string[], fitted: string[], steps: RepairStep[]): RepairGuide {
  return { id, title, summary, icon, difficulty, time, buy, tools, officialUrl, replaced, fitted, steps };
}

// ───────────────────────── Shared steps ─────────────────────────

const StorageMode = step(
    "Put the battery to sleep",
    "Let the battery run down below 25%. Then, with the Deck powered off, hold Volume + and press the Power button to open the BIOS menu, choose Setup Utility › Power › Battery Storage Mode and confirm. The Deck switches off and the battery stays disconnected until you plug in a charger.",
    [], "Valve recommends this before any repair: it keeps the battery from powering anything while you work.",
    [], [], 0, -0.03, 3.0, "Battery Storage Mode", { view: "front", screen: ["SETUP UTILITY › POWER", "Battery Storage Mode: Enable", "The Deck powers off when you confirm"] });

const PrepareDesk = step(
    "Unplug, pop the microSD, flip it over",
    "Unplug every cable and take out the microSD card. Lay the Deck face-down, ideally in its case so the sticks and screen are protected.",
    [], "Opening the back with a microSD card still in can snap the card in half.",
    ["microsd"], ["microsd"], -0.75, 0.5, 2.1, "microSD out");

const BackScrewsLcd = step(
    "Remove the back-cover screws",
    "Remove the eight screws holding the back cover: four 9.5 mm coarse-thread screws and four 5.8 mm fine-thread screws. Keep them sorted, because the lengths matter when they go back in.",
    ["Phillips driver that fits snugly"], "Phillips sizes vary between units. Use the bit that fits tightest so you don't strip the heads.",
    ["back-screws"], ["back-screws"], 0, 0, 3.8, "8 × Phillips screws");

const BackScrewsOled = step(
    "Remove the back-cover screws",
    "Remove the eight 5.8 mm screws holding the back cover with a T6 Torx driver.",
    ["T6 Torx driver"], null,
    ["back-screws"], ["back-screws"], 0, 0, 3.8, "8 × T6 Torx, 5.8 mm");

const BackCoverLcd = step(
    "Unclip the back cover",
    "Push an opening pick into the seam at one of the grips and pry gently to release the clips. Work the pick around the edges until the cover is loose, then lift it off.",
    ["Opening pick"], null,
    ["back-cover"], ["back-cover"], 0, 0, 4.2, "Back cover");

const BackCoverOled = step(
    "Unclip the back cover",
    "Insert an opening pick at an upward angle between the back cover and the front shell near a trigger. Slide it along the edge of the handle to release the clips, then along the top and bottom edges until the cover is loose. Lift it off.",
    ["Opening pick"], "If the pick won't go in near the trigger, start along the top or bottom edge and slide toward the handle.",
    ["back-cover"], ["back-cover"], 0, 0, 4.2, "Back cover");

const ShieldScrewsLcd = step(
    "Unscrew the board shield",
    "Original Steam Decks hide one shield screw under a piece of foil tape. Peel it back with tweezers. Remove the three shield screws: one 3.4 mm and two 3.7 mm. Refreshed units have only two.",
    ["Phillips driver", "Tweezers"], null,
    ["foil-tape", "shield-screws"], ["foil-tape", "shield-screws"], -0.57, 0.0, 2.6, "Shield screws");

const ShieldLiftLcd = step(
    "Lift off the board shield",
    "Lift the shield straight up. It can stick to the thermal pads underneath, so ease it off rather than yanking it.",
    [], "When it goes back on, make sure the fan cable lies beside the shield and isn't pinched underneath it.",
    ["shield"], ["shield"], -0.57, 0.0, 2.9, "Board shield");

const BatteryLcd = step(
    "Disconnect the battery",
    "Grip the battery cable by its pull tab and pull it straight away from the motherboard. You can also push the connector out with the flat end of a spudger.",
    ["Spudger"], "Always disconnect the battery before touching any other connector.",
    ["battery-cable"], ["battery-cable"], -0.3, 0.26, 1.4, "Battery connector");

const BatteryOled = step(
    "Disconnect the battery",
    "Grip the battery cable's pull tab and pull it straight toward the battery, away from the motherboard shield. If it resists, re-grip close to the connector and rock it gently side to side.",
    [], "Always disconnect the battery before touching any other connector.",
    ["battery-cable"], ["battery-cable"], -0.3, 0.26, 1.4, "Battery connector");

const InterconnectOled = step(
    "Move the interconnect cable",
    "Flip up the white locking flap on the right button board's ZIF connector with a spudger, then slide the interconnect cable (labelled C-R) out with tweezers. Separate its adhesive from the shield with an opening pick, fold it over the battery and tape it out of the way.",
    ["Spudger", "Tweezers", "Opening pick"], "ZIF flaps are tiny and hinge on one side. Flip, don't pull.",
    ["interconnect"], ["interconnect"], -0.7, -0.4, 1.7, "C-R interconnect");

const ShieldOled = step(
    "Remove the board shield",
    "Remove the two 3.8 mm T6 screws at the top-left and bottom-left of the shield. If the speaker cable is taped to the shield, peel it free, then lift the shield off.",
    ["T6 Torx driver"], null,
    ["shield-screws", "shield"], ["shield-screws", "shield"], -0.57, 0.0, 2.8, "Board shield");

// ───────────────────────── SSD ─────────────────────────

const SsdLcd = guide(
    "ssd", "SSD upgrade", "Swap in a bigger drive, then reinstall SteamOS.", "hard-drive", "Moderate", "20–30 min",
    "A single-sided M.2 2230 NVMe SSD, plus a USB drive (8 GB or more) for the SteamOS recovery image.",
    ["Phillips driver", "Opening pick", "Tweezers", "Spudger"],
    "https://www.ifixit.com/Guide/Steam+Deck+SSD+Replacement/148989",
    ["ssd"], ["ssd-new"],
    [
        StorageMode, PrepareDesk, BackScrewsLcd, BackCoverLcd, ShieldScrewsLcd, ShieldLiftLcd, BatteryLcd,
        step("Remove the SSD screw",
            "Remove the 3.4 mm screw at the end of the SSD. Once it's out, the SSD pops up at a shallow angle.",
            ["Phillips driver"], null, ["ssd-screw"], ["ssd-screw", "ssd"], -0.6, 0.355, 1.2, "3.4 mm SSD screw"),
        step("Pull out the old SSD",
            "Grip the raised end of the SSD and pull it straight out of its M.2 connector.",
            [], null, ["ssd"], ["ssd"], -0.47, 0.355, 1.3, "M.2 2230 SSD"),
        step("Move the shielding to the new drive",
            "The SSD wears a foil ESD sleeve. Slide it off the old drive and onto the new one. It's thin, so go slowly.",
            [], "Use a single-sided M.2 2230 drive. Double-sided drives are too thick for the slot.",
            [], ["ssd-new"], -0.47, 0.355, 1.3, "ESD sleeve", { show: ["ssd-new"] }),
        step("Fit the new SSD",
            "Slide the new SSD into the M.2 connector at a slight angle, press it flat against the screw post and refit the 3.4 mm screw.",
            ["Phillips driver"], "Snug is enough. Overtightening strips the post.",
            [], ["ssd-new", "ssd-screw"], -0.5, 0.355, 1.3, "New SSD", { restore: ["ssd-screw"] }),
        step("Close up and reinstall SteamOS",
            "Reassemble in reverse: battery, shield (fan cable beside it), back cover, screws. Then follow Valve's Steam Deck recovery instructions: make a recovery USB, hold Volume − and press Power to open the boot manager, boot from the USB and choose Re-image.",
            [], "After re-imaging, buttons, sticks and trackpads may not respond at first. Let the updates download, then restart.",
            [], ["ssd-new"], 0, 0, 3.6, "Done", { reassemble: true }),
    ]);

const SsdOled = guide(
    "ssd", "SSD upgrade", "Swap in a bigger drive, then reinstall SteamOS.", "hard-drive", "Moderate", "25–35 min",
    "A single-sided M.2 2230 NVMe SSD, plus a USB drive (8 GB or more) for the SteamOS recovery image.",
    ["T6 Torx driver", "Opening pick", "Tweezers", "Spudger"],
    "https://www.ifixit.com/Guide/Steam+Deck+OLED+SSD+Replacement/168255",
    ["ssd"], ["ssd-new"],
    [
        StorageMode, PrepareDesk, BackScrewsOled, BackCoverOled, BatteryOled, InterconnectOled, ShieldOled,
        step("Remove the SSD screw",
            "Remove the 3.3 mm T6 screw at the end of the SSD. It pops up slightly once the screw is out.",
            ["T6 Torx driver"], null, ["ssd-screw"], ["ssd-screw", "ssd"], -0.6, 0.355, 1.2, "3.3 mm T6 screw"),
        step("Pull out the old SSD",
            "Grip the end of the SSD and pull it straight out of its M.2 connector.",
            [], null, ["ssd"], ["ssd"], -0.47, 0.355, 1.3, "M.2 2230 SSD"),
        step("Move the shielding to the new drive",
            "Carefully slide the foil ESD sleeve off the old SSD and onto the new one.",
            [], "Use a single-sided M.2 2230 drive. Double-sided drives are too thick for the slot.",
            [], ["ssd-new"], -0.47, 0.355, 1.3, "ESD sleeve", { show: ["ssd-new"] }),
        step("Fit the new SSD",
            "Insert the new SSD at a slight angle, hold it against the screw post and refit the 3.3 mm screw.",
            ["T6 Torx driver"], "Don't overtighten. The screws strip easily.",
            [], ["ssd-new", "ssd-screw"], -0.5, 0.355, 1.3, "New SSD", { restore: ["ssd-screw"] }),
        step("Close up and reinstall SteamOS",
            "Reassemble in reverse. Slide the battery connector back in with the flat end of a spudger. Then follow Valve's recovery instructions: make a recovery USB, hold Volume − and press Power to open the boot manager, boot from the USB and choose Re-image.",
            [], "After re-imaging, the controls may not respond at first. Let the updates download, then restart.",
            [], ["ssd-new"], 0, 0, 3.6, "Done", { reassemble: true }),
    ]);

// ───────────────────────── Right thumbstick ─────────────────────────

const StickLcd = guide(
    "thumbstick", "Right thumbstick", "Fix stick drift with a new stick module.", "gamepad-2", "Moderate", "30–45 min",
    "A right thumbstick module of the matching type. Check Settings › System for your Controller ID: MEDA means Type A, MHDA means Type B.",
    ["Phillips driver", "Opening pick", "Tweezers", "Spudger"],
    "https://www.ifixit.com/Guide/Steam+Deck+Right+Thumbstick+Replacement/148895",
    ["tstick-r"], ["tstick-r-new"],
    [
        StorageMode, PrepareDesk, BackScrewsLcd, BackCoverLcd, ShieldScrewsLcd, ShieldLiftLcd, BatteryLcd,
        step("Disconnect the stick cable",
            "Lift the small locking flap on the thumbstick cable's ZIF connector with the point of a spudger. Then slide the cable out with tweezers, holding it by the blue pull tab.",
            ["Spudger", "Tweezers"], null, ["tstick-cable"], ["tstick-cable"], -0.95, -0.22, 1.3, "ZIF connector"),
        step("Unscrew the module",
            "Remove the three 5.2 mm Phillips screws holding the thumbstick module.",
            ["Phillips driver"], null, ["tstick-screws"], ["tstick-screws"], -1.04, -0.33, 1.5, "3 × 5.2 mm screws"),
        step("Lift out the old stick",
            "Lift the thumbstick module out of the Deck.",
            [], "The stick and its board are one part. Replace them together.", ["tstick-r"], ["tstick-r"], -1.04, -0.33, 1.7, "Thumbstick module"),
        step("Fit the new stick",
            "Place the new module, then refit the three screws while holding the Deck off the table so nothing presses on the new stick. Slide the cable back into the ZIF connector and close the flap.",
            ["Phillips driver", "Tweezers"], "Make sure it's the same type (A or B) as the one you took out.",
            [], ["tstick-r-new"], -1.04, -0.33, 1.6, "New thumbstick", { show: ["tstick-r-new"], restore: ["tstick-screws", "tstick-cable"] }),
        step("Close up and calibrate",
            "Reassemble in reverse: battery, shield (fan cable beside it), back cover, screws. Turn the Deck on and calibrate the new stick in Settings › Controller › Calibration & Advanced Settings.",
            [], "A new stick needs calibrating before it reads correctly.",
            [], ["tstick-r-new"], 0, 0, 3.6, "Done", { reassemble: true }),
    ]);

const StickOled = guide(
    "thumbstick", "Right thumbstick", "Fix stick drift with a new stick module.", "gamepad-2", "Easy", "20–30 min",
    "A right thumbstick module for the Steam Deck OLED.",
    ["T6 Torx driver", "Opening pick", "Tweezers", "Spudger"],
    "https://www.ifixit.com/Guide/Steam+Deck+OLED+Right+Thumbstick+Replacement/168609",
    ["tstick-r"], ["tstick-r-new"],
    [
        StorageMode, PrepareDesk, BackScrewsOled, BackCoverOled, BatteryOled,
        step("Disconnect the stick cable",
            "Flip up the small locking flap on the right thumbstick's ZIF connector with the point of a spudger, then slide the connector straight out with tweezers.",
            ["Spudger", "Tweezers"], null, ["tstick-cable"], ["tstick-cable"], -0.95, -0.22, 1.3, "ZIF connector"),
        step("Unscrew the module",
            "Remove the three 5.9 mm T6 screws holding the thumbstick module.",
            ["T6 Torx driver"], null, ["tstick-screws"], ["tstick-screws"], -1.04, -0.33, 1.5, "3 × T6, 5.9 mm"),
        step("Lift out the old stick",
            "Grip the edges of the thumbstick board and rotate it clockwise to clear the trigger, then lift it out.",
            [], "The stick and its board are one part. Replace them together.", ["tstick-r"], ["tstick-r"], -1.04, -0.33, 1.7, "Thumbstick module"),
        step("Fit the new stick",
            "Rotate the new module into place, then refit the three screws while holding the Deck off your work surface so it doesn't rest on the new stick. Reconnect the ZIF cable and close the flap.",
            ["T6 Torx driver", "Tweezers"], null,
            [], ["tstick-r-new"], -1.04, -0.33, 1.6, "New thumbstick", { show: ["tstick-r-new"], restore: ["tstick-screws", "tstick-cable"] }),
        step("Close up and calibrate",
            "Reconnect the battery, refit the back cover and its eight screws. Turn the Deck on and calibrate the new stick in Settings › Controller › Calibration & Advanced Settings.",
            [], "A new stick needs calibrating before it reads correctly.",
            [], ["tstick-r-new"], 0, 0, 3.6, "Done", { reassemble: true }),
    ]);

// ───────────────────────── Fan ─────────────────────────

const FanLcd = guide(
    "fan", "Fan replacement", "Replace a noisy or failing fan, or take it out to clean.", "fan", "Moderate", "25–35 min",
    "A replacement fan. The Steam Deck LCD has shipped with two fan versions, so check which one yours has before ordering.",
    ["Phillips driver", "Opening pick", "Tweezers", "Spudger"],
    "https://www.ifixit.com/Guide/Steam+Deck+Fan+Replacement/148903",
    ["fan"], ["fan-new"],
    [
        StorageMode, PrepareDesk, BackScrewsLcd, BackCoverLcd, ShieldScrewsLcd, ShieldLiftLcd, BatteryLcd,
        step("Peel off the heatsink sticker",
            "Use tweezers to peel the sticker off the top edge of the fan, where it meets the heatsink.",
            ["Tweezers"], null, ["fan-sticker"], ["fan-sticker"], 0.02, -0.5, 1.5, "Heatsink sticker"),
        step("Disconnect the fan",
            "Grip the edges of the fan connector with tweezers and pull up to disconnect it from the motherboard.",
            ["Tweezers"], "Pull on the connector, never on the wires.", ["fan-cable"], ["fan-cable"], -0.3, -0.12, 1.2, "Fan connector"),
        step("Remove the fan screws",
            "Remove the two 3.7 mm screws holding the fan. Its other two screws were back-cover screws, so they're already out.",
            ["Phillips driver"], null, ["fan-screws"], ["fan-screws"], 0.02, -0.05, 1.7, "2 × 3.7 mm screws"),
        step("Lift out the fan",
            "Lift the fan out of the Deck.",
            [], null, ["fan"], ["fan"], 0.02, -0.27, 1.8, "Fan"),
        step("Fit the new fan",
            "Seat the new fan, refit the two screws, reconnect the connector and put the heatsink sticker back over the gap.",
            ["Phillips driver", "Tweezers"], "Stick the fan cable down where the old one was so it can't get pinched.",
            [], ["fan-new"], 0.02, -0.27, 1.8, "New fan", { show: ["fan-new"], restore: ["fan-screws", "fan-cable", "fan-sticker"] }),
        step("Close up",
            "Reassemble in reverse: battery, shield, back cover, screws. Make sure the fan cable lies beside the shield and isn't pinched underneath.",
            [], null, [], ["fan-new"], 0, 0, 3.6, "Done", { reassemble: true }),
    ]);

const FanOled = guide(
    "fan", "Fan replacement", "Replace a noisy or failing fan, or take it out to clean.", "fan", "Moderate", "30–40 min",
    "A replacement fan for the Steam Deck OLED.",
    ["T6 Torx driver", "Opening pick", "Tweezers", "Spudger", "Hair dryer (optional)"],
    "https://www.ifixit.com/Guide/Steam+Deck+OLED+Fan+Replacement/168674",
    ["fan"], ["fan-new"],
    [
        StorageMode, PrepareDesk, BackScrewsOled, BackCoverOled, BatteryOled, InterconnectOled, ShieldOled,
        step("Peel off the heatsink sticker",
            "A black sticker joins the heatsink to the fan. Warm it slightly to soften the adhesive, then peel it off carefully. Keep it, because it goes back on.",
            ["Tweezers"], null, ["fan-sticker"], ["fan-sticker"], 0.02, -0.5, 1.5, "Heatsink sticker"),
        step("Disconnect the fan",
            "Grip the edges of the fan connector with blunt tweezers and walk it side to side out of its socket.",
            ["Tweezers"], "Grip the connector body, never the wires.", ["fan-cable"], ["fan-cable"], -0.3, -0.12, 1.2, "Fan connector"),
        step("Remove the fan screws",
            "Remove the two 3.8 mm T6 screws holding the fan. The other two fan screws doubled as back-cover screws.",
            ["T6 Torx driver"], null, ["fan-screws"], ["fan-screws"], 0.02, -0.05, 1.7, "2 × T6, 3.8 mm"),
        step("Lift out the fan",
            "Lift the top edge of the fan out of its recess in the midframe, then remove it.",
            [], null, ["fan"], ["fan"], 0.02, -0.27, 1.8, "Fan"),
        step("Fit the new fan",
            "Seat the new fan and refit the screws. Plug the connector in with its exposed coloured wires facing away from the fan, then put the heatsink sticker back.",
            ["T6 Torx driver", "Tweezers"], "Never force the connector. Bent pins kill the socket.",
            [], ["fan-new"], 0.02, -0.27, 1.8, "New fan", { show: ["fan-new"], restore: ["fan-screws", "fan-cable", "fan-sticker"] }),
        step("Close up",
            "Reassemble in reverse: shield and its two screws, interconnect cable back into its ZIF connector, battery, back cover and its eight screws.",
            [], null, [], ["fan-new"], 0, 0, 3.6, "Done", { reassemble: true }),
    ]);

export const GUIDE_IDS = ['ssd', 'thumbstick', 'fan'] as const;

export function getGuide(id: string, generation: 'lcd' | 'oled'): RepairGuide {
  if (id === 'ssd') return generation === 'lcd' ? SsdLcd : SsdOled;
  if (id === 'thumbstick') return generation === 'lcd' ? StickLcd : StickOled;
  return generation === 'lcd' ? FanLcd : FanOled;
}

// Everything removed so far (minus what later steps put back), what's been fitted, and where to look.
export function sceneFor(g: RepairGuide, index: number): DeckSceneState {
  const s = g.steps[Math.min(Math.max(index, 0), g.steps.length - 1)];
  if (s.reassemble) {
    return { removed: g.replaced, shown: g.fitted, highlight: s.highlight, focus: [s.focusX, s.focusZ], zoom: s.zoom, view: s.view, label: s.label, screen: s.screen ?? [] } as DeckSceneState;
  }
  let removed: string[] = [];
  const shown: string[] = [];
  for (const x of g.steps.slice(0, index + 1)) {
    removed.push(...x.remove);
    if (x.restore) removed = removed.filter((r) => !x.restore!.includes(r));
    if (x.show) shown.push(...x.show);
  }
  return { removed: [...new Set(removed)], shown: [...new Set(shown)], highlight: s.highlight, focus: [s.focusX, s.focusZ], zoom: s.zoom, view: s.view, label: s.label, screen: s.screen ?? [] } as DeckSceneState;
}
