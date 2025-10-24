import { TheDynastyBA } from "./thedynastyba.js";
import { SunbeltNetwork } from "./sunbeltnetwork.js";
import { TWorld } from "./tworld.js";
import { TheCBAGroup } from "./thecbagroup.js";
import { BizBuySell } from "./bizbuysell.js";
import { Enlign } from "./enlign.js";
import { VRBusinessBrokers } from "./vrbusinessbrokers.js";
import { FCBB } from "./fcbb.js";
import { VikingMergers } from "./vikingmergers.js";
import { BeaconAdvisors } from "./beaconadvisors.js";
import { Midstreet } from "./midstreet.js";
import { BAMA } from "./bama.js";
import { BatonMarket } from "./batonmarket.js";
import { MorganWestfield } from "./morganwestfield.js";
import { BaseScrapeObject } from "./base.js";

type ScrapeConstructor = new () => BaseScrapeObject;

class Registry {
  private entries: Map<string, ScrapeConstructor>;

  constructor() {
    const sites = [
      TheDynastyBA,
      SunbeltNetwork,
      TWorld,
      TheCBAGroup,
      BizBuySell,
      Enlign,
      VRBusinessBrokers,
      FCBB,
      VikingMergers,
      BeaconAdvisors,
      Midstreet,
      BAMA,
      BatonMarket,
      MorganWestfield,
    ];
    this.entries = new Map();
    for (const site of sites) {
      this.entries.set(site.name, site);
    }
  }

  get(key: string): BaseScrapeObject | undefined {
    const c = this.entries.get(key);
    if (c) {
      return new c();
    }
  }

  list(keys: string[]): BaseScrapeObject[] {
    const results = [];
    for (const key of keys) {
      if (this.entries.has(key)) {
        results.push(this.get(key)!);
      }
    }
    return results;
  }

  all(): BaseScrapeObject[] {
    return [...this.entries.values()].map((c) => new c());
  }
}

export const registry = new Registry();
